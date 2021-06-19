import dotenv from 'dotenv';
import { Peripheral } from 'noble';
import { BluetoothThermometer } from './bluetooth-thermometer';
import { DeviceNotFoundError } from './device-not-found-error';
import { MqttClient, MqttOptions } from './mqtt';
import { Noble } from './noble';
import { readyNoble } from './ready-noble';
import { TemperaturePoller } from './temperature-poller';
import { timeout } from './util';

dotenv.config();

export const SENSOR_MAC_ADDRESS = ensureString('SENSOR_MAC_ADDRESS');
export const ADAPTER_WAIT_TIMEOUT_SECONDS = ensureInt('ADAPTER_WAIT_TIMEOUT_SECONDS');
export const PERIPHERAL_WAIT_TIMEOUT_SECONDS = ensureInt('PERIPHERAL_WAIT_TIMEOUT_SECONDS');
export const RETRY_DELAY_SECONDS = ensureInt('RETRY_DELAY_SECONDS');

const mqttOptions: MqttOptions = {
  host: ensureString('MQTT_HOST'),
  port: ensureInt('MQTT_PORT'),
  username: ensureString('MQTT_USERNAME'),
  password: ensureString('MQTT_PASSWORD'),
};

function delay(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

function ensureString(envKey: string): string {
  if (!process.env.hasOwnProperty(envKey)) {
    throw new Error(`Environment variable "${envKey}" not found!`);
  }
  const envValue: string | undefined = process.env[envKey];
  if (typeof envValue === 'undefined' || envValue === null) {
    throw new Error(`Environment variable "${envKey}" was not set!`);
  }
  return envValue;
}

function ensureInt(envKey: string): number {
  if (!process.env.hasOwnProperty(envKey)) {
    throw new Error(`Environment variable "${envKey}" not found!`);
  }
  const envValue: string | undefined = process.env[envKey];
  if (typeof envValue === 'undefined' || envValue === null) {
    throw new Error(`Environment variable "${envKey}" was not set!`);
  }
  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable "${envKey}" was not a number!`);
  }
  return parsed;
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

  const mqttClient = new MqttClient(mqttOptions);
  await mqttClient.connect();

  const poller = new TemperaturePoller(mqttClient, thermometer.temperatures$);
  return poller.startPolling();
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
