export function ify<T>(func: (...args: any[]) => any, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    func(...args, (err: any, ...args: any[]) => {
      if (err) {
        reject(err);
      } else {
        if (args.length === 0) {
          resolve();
        } else if (args.length === 1) {
          resolve(args[0]);
        } else {
          resolve(args as any);
        }
      }
    });
  });
}

export function timeout<T>(promise: Promise<T>, timeMs: number, errorType: new (message: string) => Error = Error): Promise<T> {
  let done = false;
  return new Promise<T>((resolve, reject) => {
    promise.then((data) => {
      done = true;
      resolve(data);
    }, (err) => {
      done = true;
      reject(err);
    });

    setTimeout(() => {
      done = true;
      reject(new errorType(`Timed out after ${(timeMs / 1000).toFixed(1)}ms`));
    }, timeMs);
  });
}
