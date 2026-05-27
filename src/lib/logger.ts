import pino from 'pino';

const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
const isNode = typeof window === 'undefined';

export const logger = pino({
  level: typeof process !== 'undefined' && process.env?.LOG_LEVEL ? process.env.LOG_LEVEL : 'info',
  ...(isProduction || !isNode
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }),
});

export default logger;
