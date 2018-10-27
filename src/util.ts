export function ify<T>(func: (...args: any[]) => any, ...args: any[]): Promise<T> {
  return new Promise((resolve, reject) => {
    func(...args, (err, ...args) => {
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
