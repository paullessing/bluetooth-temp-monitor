import noble, { Peripheral, Service } from 'noble';
import { ify } from './util';

let isInitialised = false;
noble.on('stateChange', (state) => {
  console.log('state change', state);
  if (state === 'poweredOn') {
    init();
  }
});

const result: any = {};

function init(): void {
  console.log('initialising');
  if (isInitialised) {
    return;
  }
  isInitialised = true;

  let sensor;
  noble.startScanning();
  noble.on('discover', (peripheral: Peripheral) => {
    if (peripheral.address === '0c:ae:7d:e7:67:b1') {
      console.log('found', peripheral.uuid);
      sensor = peripheral;
      result.sensor = sensor;
      noble.stopScanning();

      connect(peripheral);
    }
  });
}

async function connect(sensor): Promise<void> {
  console.log('connecting');

  await ify(sensor.connect.bind(sensor));
  console.log('connected');
  const [services]= await ify<[Service[]]>(sensor.discoverServices.bind(sensor), ['fff0']); //, ['1000']);
  console.log(`got ${services.length} services`);
  if (services.length === 0) {
    return;
  }
  for (let service of services) {
    console.log(service.name, service.uuid, service.type, service.toString());
  }
  const service = result.service = services[0];
  console.log(service.uuid);
  await ify(service.discoverCharacteristics.bind(service), ['fff1', 'fff2', 'fff4', 'fff5']); //, ['1002']);
  console.log('got characteristics, waiting for data...');

  const fff1 = service.characteristics.find((char) => char.uuid === 'fff1');
  await ify(fff1.subscribe.bind(fff1));
  console.log('subscribed fff1');
  fff1.on('data', (data, isNotification) => {
    if (isNotification) {
      console.log('N', fff1.uuid, data);
    }
  });

  const fff2 = service.characteristics.find((char) => char.uuid === 'fff2');
  // pair
  // fff2.write(Buffer.from(new Uint8Array([32, 7, 6, 5, 4, 3, 2, 1, 1, 1, 1, 1, 0, 0, 0])), true, (err) => err ? console.log('err fff2', err.toString()) : null);
  // autopair
  fff2.write(Buffer.from(new Uint8Array([33, 7, 6, 5, 4, 3, 2, 1, -72, 34, 0, 0, 0, 0, 0])), true, (err) => err ? console.log('err fff2', err.toString()) : null);

  const fff4 = service.characteristics.find((char) => char.uuid === 'fff4');
  await ify(fff4.subscribe.bind(fff4));
  console.log('subscribed fff4');

  function getShort(temps: Buffer, sensor: number) {
    console.log(temps[sensor * 2 + 1], temps[sensor * 2])
    return temps[sensor * 2 + 1] << 8 | temps[sensor * 2] & 255;
  }

  fff4.on('data', (data, isNotification) => {
    if (isNotification) {
      // console.log('T', fff4.uuid, data);
      // const a = [];
      // for (let i = 0; i < data.byteLength; i++) {
      //   a.push(data[i]);
      // }
      //
      // const short = a[3] << 8 | a[2] & 255;
      //
      // console.log('T', a[3], a[3] << 8, a[3] << 8 | a[2], short);

      const temps = [];
      for (let i = 0; i < data.byteLength / 2; i++) {
        const raw = getShort(data, i);
        if (raw !== 65535) {
          temps.push(Math.floor(raw));
        } else {
          temps.push(-1)
        }
      }
      console.log('T', temps); // 65535
    }
  });
  const fff5 = service.characteristics.find((char) => char.uuid === 'fff5');
  console.log('write temp req');
  // Magic value - start returning temperatures on fff4
  fff5.write(Buffer.from(new Uint8Array([11, 1, 0, 0, 0, 0])), true, (err) => err ? console.log('err fff5', err.toString()) : null);

  // FFF1 is the status characteristic. See BleService.onCharacteristicChanged for the different statuses
  // FFF2 is for connecting - there seem to be pair and autopair constants NOTE what's the difference?
  // FFF4 contains temperatures
  // FFF5 is the control characteristic - it sends what it wants to read


  //
  // service.characteristics.forEach(async (char) => {
  //   console.log(char.name, char.uuid);
  //   // char.subscribe()
  //   // const [descriptors] = await ify(char.discoverDescriptors.bind(char));
  //
  //   if (char.uuid === 'fff1') {
  //     await ify(char.subscribe.bind(char));
  //     console.log('subscribed');
  //     char.on('data', (data, isNotification) => {
  //       if (isNotification) {
  //         console.log('N', char.uuid, data);
  //       }
  //     });
  //   } else if (char.uuid === '')
  //   // descriptors && descriptors.forEach((d: Descriptor) => {
  //   //   console.log('D', char.uuid, d.name, d.uuid);
  //   //   if (d.uuid === '2902') {
  //   //     // // console.log('setting descriptor to 1');
  //   //     // d.on('valueRead', (err, data) => {
  //   //     //   if (err) {
  //   //     //     console.log('descriptor read error', err.toString());
  //   //     //   } else {
  //   //     //     console.log('descriptor read value', data.toString());
  //   //     //   }
  //   //     // });
  //   //     d.readValue((err, data) => {
  //   //       if (err) {
  //   //         console.log('descriptor 1 read error', err);
  //   //       } else {
  //   //         console.log('descriptor 1 read value', data.toString());
  //   //       }
  //   //     });
  //   //     d.writeValue()
  //   //   }
  //   // });
  // })
  // const tempData = service.characteristics[0];
  // tempData.on('data', (data, isNotification) => {
  //   if (!result.data) {
  //     // console.log('got one', isNotification, data.toString());
  //     result.data = data;
  //   }
  //
  //   const converted = convertBytes(data);
  //
  //   if (!result.paused) console.log(converted, extract(converted));
  // });
}

function extract(bytes: number[]): [number, number] {
  return [
    100 * bytes[4] + 10 * bytes[5] + bytes[6],
    100 * bytes[11] + 10 * bytes[12] + bytes[13],
  ];
}

function convertBytes(data: Buffer): number[] {
  const arr = [];
  for (let i = 3; i < data.byteLength; i++) {
    arr.push(data[i]);
  }

  return arr.map((value) => result.convertFn(value, arr));
}

result.convertBySubtracting = result.convertFn = (byte: number, bytes: number[]) => {
  return Math.abs(byte - bytes[bytes.length - 1]);
};

result.init = init;

export = result;
