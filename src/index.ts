import { Peripheral } from 'noble';
import { BluetoothThermometer } from './bluetooth-thermometer';
import { ApiClient } from './api-client';
import { throttleTime } from 'rxjs/operators';
import { DeviceNotFoundError } from './device-not-found-error';
import { readyNoble } from './ready-noble';
import { Noble } from './noble';
import { timeout } from './util';

export const SENSOR_MAC_ADDRESS = '0c:ae:7d:e7:67:b1';
export const ADAPTER_WAIT_TIMEOUT_SECONDS = 2; // 20
export const PERIPHERAL_WAIT_TIMEOUT_SECONDS = 2; // 20
export const RETRY_DELAY_SECONDS = 5; // 60

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
        process.stdout.write('\n');
        console.log(e.message);
        console.log(`Retrying in ${RETRY_DELAY_SECONDS}s`);
        await delay(RETRY_DELAY_SECONDS);
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
  process.stdout.write('Waiting for Bluetooth...');
  const noble = await waitForAdapter();
  process.stdout.write(' OK\n');

  process.stdout.write('Finding thermometer...');
  const peripheral = await findPeripheral(noble);
  process.stdout.write(' OK\n');

  const thermometer = await BluetoothThermometer.create(peripheral);

  console.log('Attempting to pair');
  await thermometer.pair();
  console.log('Paired');


  console.log('Asking for data...');
  await thermometer.startListening();

  return new Promise<void>((_, reject) => {
    let dataCount: number;

    thermometer.temperatures$.pipe(
      throttleTime(5000),
    ).subscribe((temps) => {
      process.stdout.write('X');
      if (dataCount % 12 === 0) {
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
    }, (e) => {
      reject(e);
    });
  });
}

function waitForAdapter(): Promise<Noble> {
  return timeout(readyNoble.waitUntilReady(), ADAPTER_WAIT_TIMEOUT_SECONDS * 1000, DeviceNotFoundError);
}

function findPeripheral(noble: Noble): Promise<Peripheral> {
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
        reject(new DeviceNotFoundError(`Could not find sensor within ${PERIPHERAL_WAIT_TIMEOUT_SECONDS}s`));
      }
    }, PERIPHERAL_WAIT_TIMEOUT_SECONDS * 1000);
  });
}
