import noble, { Peripheral } from 'noble';
import { BluetoothThermometer } from './bluetooth-thermometer';
import { timeout } from './util';
import { ApiClient } from './api-client';
import { throttleTime } from 'rxjs/operators';

export const SENSOR_MAC_ADDRESS = '0c:ae:7d:e7:67:b1';

class DeviceNotFoundError extends Error {
  constructor(message?: string) {
    super(`Device not found${message ? ': ' + message : ''}`);
  }
}

function delay(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

(async () => {
  while (true) {
    try {
      await run();
    } catch (e) {
      if (e instanceof DeviceNotFoundError) {
        console.log('Device not found, retrying in 60s');
        await delay(5);
      } else {
        throw e;
      }
    }
  }
})().catch((e) => {
  console.log('ERROR: ' + e.message);
  process.exit(1);
});

async function run(): Promise<void> {
  process.stdout.write('Waiting for adapter...');
  await timeout(waitForAdapter(), 20_000, DeviceNotFoundError);
  process.stdout.write(' OK\n');

  process.stdout.write('Finding thermometer...');
  const peripheral = await timeout(findPeripheral(), 20_000);
  process.stdout.write(' OK\n');

  const thermometer = await BluetoothThermometer.create(peripheral);

  console.log('Attempting to pair');
  await thermometer.pair();
  console.log('Paired');


  console.log('Asking for data...');
  await thermometer.startListening();

  let dataCount: number;

  thermometer.temperatures$.pipe(throttleTime(5000)).subscribe((temps) => {
    if (dataCount % 1000 === 0) {
      if (dataCount === 0) {
        console.log('Started getting data');
      }
      process.stdout.write(dataCount % 10000 === 0 ? ',' : '.');
    }
    dataCount++;

    // TODO extract to class
    const [ambient1, ambient2, internal1, internal2, internal3, internal4] = temps;

    ApiClient.updateSensor('bbq_temp_ambient1', 'BBQ Temp Ambient 1', ambient1);
    ApiClient.updateSensor('bbq_temp_ambient2', 'BBQ Temp Ambient 2', ambient2);
    ApiClient.updateSensor('bbq_temp_internal1', 'BBQ Temp Internal 1', internal1);
    ApiClient.updateSensor('bbq_temp_internal2', 'BBQ Temp Internal 2', internal2);
    ApiClient.updateSensor('bbq_temp_internal3', 'BBQ Temp Internal 3', internal3);
    ApiClient.updateSensor('bbq_temp_internal4', 'BBQ Temp Internal 4', internal4);
  });

  // console.log('Done.');
  // process.exit(0);
}

function waitForAdapter(): Promise<void> {
  let isOn = false;

  return new Promise((resolve) => {
    if (noble.state === 'poweredOn') {
      isOn = true;
      resolve();
      return;
    } else {
      const listener = (state: string) => {
        if (state === 'poweredOn') {
          isOn = true;
          noble.removeListener('stateChange', listener)
          resolve();
        }
      };
      noble.on('stateChange', listener);
    }
  });
}

function findPeripheral(): Promise<Peripheral> {
  let done = false;
  return new Promise((resolve, reject) => {
    noble.startScanning();
    noble.on('discover', (peripheral: Peripheral) => {
      if (!done && peripheral.address === SENSOR_MAC_ADDRESS) {
        // console.log('found', peripheral.uuid);
        noble.stopScanning();
        resolve(peripheral);
        done = true;
      }
    });
    setTimeout(() => {
      if (!done) {
        done = true;
        noble.stopScanning();
        reject(new Error('Could not find sensor within 60s.'));
      }
    }, 60_000);
  });
}
