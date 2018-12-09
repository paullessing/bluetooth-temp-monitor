import axios from 'axios';
import { API_KEY, API_URL } from './config';

export class ApiClient {
  public static async updateSensor(name: string, friendlyName: string, value: number | null): Promise<void> {
    if (value === null) {
      return;
    }
    await axios.post(`${API_URL}/api/states/sensor.${name}`, {
      state: value,
      attributes: {
        friendly_name: friendlyName,
        unit_of_measurement: '°C',
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
  }
}
