import MQTT, { IMqttClient } from 'async-mqtt';
import { Temperatures } from './temperatures.model';

export interface MqttOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string | undefined;
  readonly password: string | undefined;
}

const STATE_TOPIC = 'bluetooth_probe/state';
const EMPTY_TEMPERATURES: Temperatures = [null, null, null, null, null, null];

const DISCONNECTED_MESSAGE = {
  topic: STATE_TOPIC,
  payload: JSON.stringify(convertToState(EMPTY_TEMPERATURES)),
};

function convertToState(temps: Temperatures): { [key: string]: number | null } {
  const state: { [key: string]: number | null } = {};
  temps.forEach((temp, index) => { state[`probe_${index + 1}`] = temp });

  return state;
}

export class MqttClient {

  private client!: IMqttClient;

  constructor(
    private readonly options: MqttOptions
  ) {}

  public async connect(): Promise<void> {
    const { host, port, username, password } = this.options;
    this.client = await MQTT.connectAsync(`tcp://${host}:${port}`, { username, password, will: {
      topic: DISCONNECTED_MESSAGE.topic,
      payload: DISCONNECTED_MESSAGE.payload,
      qos: 0,
      retain: true,
      properties: {
        willDelayInterval: 10 // seconds
      }
    } });
  }

  public async disconnect(): Promise<void> {
    await this.client.publish(DISCONNECTED_MESSAGE.topic, DISCONNECTED_MESSAGE.payload, { retain: true });
    this.client.end();
  }

  public async setupDiscovery(): Promise<void> {
    await Promise.all([1,2,3,4,5,6].map((probeId) =>
      this.client.publish(`homeassistant/sensor/bluetoothProbe${probeId}/config`, JSON.stringify({
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: `Bluetooth Probe ${probeId}`,
        force_update: true,
        state_topic: STATE_TOPIC,
        value_template: `{{ value_json.probe_${probeId} }}`,
      }), { retain: true })
    ));
  }

  public async publishState(temps: Temperatures): Promise<void> {
    await this.client.publish(
      STATE_TOPIC,
      JSON.stringify(convertToState(temps)),
      { retain: true }
    );
  }
}
