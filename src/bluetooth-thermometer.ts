import { Characteristic, Peripheral, Service } from 'noble';
import { ify, timeout } from './util';
import { Observable, ReplaySubject, Subject } from 'rxjs';

const SERVICE_UUID = 'fff0';
const STATUS_CHARACTERISTIC_UUID = 'fff1';
const PAIR_CHARACTERISTIC_UUID = 'fff2';
const DATA_CHARACTERISTIC_UUID = 'fff4';
const CONTROL_CHARACTERISTIC_UUID = 'fff5';

export type Temperatures = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null
];

const AUTOPAIR_COMMAND = new Uint8Array([33, 7, 6, 5, 4, 3, 2, 1, -72, 34, 0, 0, 0, 0, 0]);
const SEND_TEMPERATURES_CONTROL = new Uint8Array([11, 1, 0, 0, 0, 0]);

export class BluetoothThermometer {

  public get temperatures$(): Observable<Temperatures> {
    return this._temperature$.asObservable();
  }

  private _temperature$: Subject<Temperatures>;

  constructor(
    private service: Service,
    private statusChr:  Characteristic,
    private pairChr:    Characteristic,
    private dataChr:    Characteristic,
    private controlChr: Characteristic,
  ) {
    this._temperature$ = new ReplaySubject(1);
  }

  public static async create(sensor: Peripheral): Promise<BluetoothThermometer> {
    process.stdout.write('Connecting to thermometer...');
    await timeout(ify(sensor.connect.bind(sensor)), 10_000);
    process.stdout.write(' OK\n');

    process.stdout.write('Finding service...');
    const [service] = await timeout(ify<Service[]>(sensor.discoverServices.bind(sensor), [SERVICE_UUID]), 10_000);
    process.stdout.write(` OK\n`);

    if (!service) {
      throw new Error('No services found.');
    }

    process.stdout.write('Finding characteristics...');
    // FFF1 is the status characteristic. See BleService.onCharacteristicChanged for the different statuses
    // FFF2 is for connecting - there seem to be pair and autopair constants - NOTE: what's the difference?
    // FFF4 contains temperatures
    // FFF5 is the control characteristic - it sends what it wants to read
    await ify(service.discoverCharacteristics.bind(service), [
      STATUS_CHARACTERISTIC_UUID,
      PAIR_CHARACTERISTIC_UUID,
      DATA_CHARACTERISTIC_UUID,
      CONTROL_CHARACTERISTIC_UUID
    ]);

    const findCharacteristic = (uuid: string, service: Service): Characteristic => {
      const characteristic = service.characteristics.find((c) => c.uuid === uuid);
      if (!characteristic) {
        throw new Error('Could not find characteristic ' + uuid);
      }
      return characteristic;
    };

    const status =  findCharacteristic(STATUS_CHARACTERISTIC_UUID, service);
    const pair =    findCharacteristic(PAIR_CHARACTERISTIC_UUID, service);
    const data =    findCharacteristic(DATA_CHARACTERISTIC_UUID, service);
    const control = findCharacteristic(CONTROL_CHARACTERISTIC_UUID, service);
    process.stdout.write(' OK\n');

    return new BluetoothThermometer(
      service, status, pair, data, control
    );
  }

  public async pair(): Promise<void> {
    await ify(this.statusChr.subscribe.bind(this.statusChr));
    return new Promise<void>(async (resolve, reject) => {
      this.statusChr.once('data', (data: Buffer) => {
        console.log(data);
        // console.log('Status received', data);
        if (data[0] === 0x21) {
          resolve();
        } else {
          reject(new Error(`Unexpected status: ` + data));
        }
      });
      try {
        await ify(this.pairChr.write.bind(this.pairChr), Buffer.from(AUTOPAIR_COMMAND), true);
      } catch (e) {
        reject(e);
      }
    });
  }

  public async startListening(): Promise<void> {
    function getShort(temps: Buffer, sensor: number): number {
      // console.log(temps[sensor * 2 + 1], temps[sensor * 2])
      return temps[sensor * 2 + 1] << 8 | temps[sensor * 2] & 255;
    }

    this.dataChr.on('data', (data: Buffer, isNotification: boolean) => {
      if (isNotification) {
        const temps: Temperatures = [null, null, null, null, null, null];
        for (let i = 0; i < data.byteLength / 2; i++) {
          const raw = getShort(data, i);
          if (raw < 65000) {
            temps[i] = Math.floor(raw / 10);
          }
        }
        this._temperature$.next(temps);
      }
    });
    await ify(this.dataChr.subscribe.bind(this.dataChr));

    this.controlChr.write(Buffer.from(new Uint8Array([11, 1, 0, 0, 0, 0])), true, (err) => err ? console.log('err fff5', err.toString()) : null);
  }
}
