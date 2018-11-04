export class DeviceNotFoundError extends Error {
  constructor(message?: string) {
    super(`Device not found${message ? ': ' + message : ''}`);
  }
}
