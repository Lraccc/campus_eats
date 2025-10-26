const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const logger = {
  log: (...args: any[]) => { if (isDev) console.log(...args); },
  info: (...args: any[]) => { if (isDev) console.info(...args); },
  warn: (...args: any[]) => { if (isDev) console.warn(...args); },
  error: (...args: any[]) => { if (isDev) console.error(...args); },
};

export default logger;
