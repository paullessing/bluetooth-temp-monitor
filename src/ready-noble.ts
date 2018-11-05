import noble from 'noble';
import { Noble } from './noble';

class ReadyNoble {
  private isReady: boolean;
  private promise: Promise<Noble> | null = null;
  private resolve: ((nobleInstance: Noble) => void) | null = null;

  constructor() {
    this.isReady = noble.state === 'poweredOn';

    noble.on('stateChange', (state) => {
      this.isReady = state === 'poweredOn';
      if (this.resolve) {
        this.resolve(noble);
        this.promise = null;
        this.resolve = null;
      }
    });
  }

  public waitUntilReady(): Promise<Noble> {
    if (this.isReady) {
      return Promise.resolve(noble);
    }
    if (!this.promise) {
      this.promise = new Promise<Noble>((resolve) => {
        this.resolve = resolve;
      });
    }
    return this.promise;
  }
}

export const readyNoble = new ReadyNoble();
