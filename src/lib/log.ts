function timestamp(): string {
   return new Date().toISOString();
}

export const log = {
   info(...args: unknown[]): void {
      console.log(timestamp(), '[INFO]', ...args);
   },
   warn(...args: unknown[]): void {
      console.warn(timestamp(), '[WARN]', ...args);
   },
   error(...args: unknown[]): void {
      console.error(timestamp(), '[ERROR]', ...args);
   },
};
