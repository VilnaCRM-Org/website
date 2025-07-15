const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(...args);
    }
  },
};

export default logger;
