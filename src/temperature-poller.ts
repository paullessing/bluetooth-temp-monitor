import { Observable } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { MqttClient } from './mqtt';
import { Temperatures } from './temperatures.model';

export class TemperaturePoller {
  constructor(
    private mqttClient: MqttClient,
    private temperatures$: Observable<Temperatures>
  ) {}

  public async startPolling(): Promise<void> {
    await this.mqttClient.setupDiscovery();

    let dataCount = 0;
    return new Promise((_, reject) => {
      this.temperatures$.pipe(
        throttleTime(3000),
      ).subscribe((temps) => {
        if (dataCount === 0) {
          console.log('Data connected');
        }
        dataCount++;
        if (dataCount % 100 === 0) {
          process.stdout.write(dataCount % 10000 === 0 ? ',' : '.');
        }

        this.mqttClient.publishState(temps);
      }, reject);
    });
  }
}
