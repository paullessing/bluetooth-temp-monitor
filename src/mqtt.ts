import MQTT, { IMqttClient } from 'async-mqtt';
import { Temperatures } from './temperatures.model';

export interface MqttOptions {
  readonly host: string;
  readonly port: number;
  readonly username: string | undefined;
  readonly password: string | undefined;
}

const STATE_TOPIC = 'bluetooth_probe/state';

export class MqttClient {

  private client!: IMqttClient;

  constructor(
    private readonly options: MqttOptions
  ) {}

  public async connect(): Promise<void> {
    const { host, port, username, password } = this.options;
    this.client = await MQTT.connectAsync(`tcp://${host}:${port}`, { username, password });
  }

  public async setupDiscovery(): Promise<void> {
    await Promise.all([1,2,3,4,5,6].map((probeId) =>
      this.client.publish(`homeassistant/sensor/bluetoothProbe${probeId}/config`, JSON.stringify({
        device_class: 'temperature',
        unit_of_measurement: '°C',
        name: `Bluetooth Probe ${probeId}`,
        state_topic: STATE_TOPIC,
        value_template: `{{ value_json.probe_${probeId} }}`,
      }))
    ));
  }

  public async publishState(temps: Temperatures): Promise<void> {
    const state: { [key: string]: number | null } = {};
    temps.forEach((temp, index) => { state[`probe_${index + 1}`] = temp });

    await this.client.publish(STATE_TOPIC, JSON.stringify(state));
  }
}
