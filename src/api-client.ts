import axios from 'axios';
import { API_KEY, API_URL } from './config';

export class ApiClient {
  public static async updateSensor(name: string, friendlyName: string, value: number): Promise<void> {
    await axios.post(`${API_URL}/api/states/sensor.${name}`, {
      state: value,
      attributes: {
        friendly_name: friendlyName
      }
    }, {
      headers: {
        'x-ha-access': API_KEY
      }
    });
  }
}
