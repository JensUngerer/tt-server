import { configure, getLogger, Logger as Logger4js } from 'log4js';

import { ILogger } from './i-logger';

export class Logger implements ILogger {
  private static internalInstance: Logger;

  static get instance(): ILogger {
    if (!Logger.internalInstance) {
      Logger.internalInstance = new Logger();
    }

    return Logger.internalInstance;
  }

  private logger: Logger4js;

  constructor() {
    this.logger = getLogger();
    this.logger.level = 'debug';
  }

  static configureLogger(absolutePathToLoggingFile: string) {
    // setup logging
    configure({
      appenders: {
        timeTracker: { type: 'file', filename: absolutePathToLoggingFile },
        timeTrackerConsole: { type: 'console' },
      },
      categories: { default: { appenders: ['timeTracker', 'timeTrackerConsole'], level: 'debug' } },
    });
  }


  info(...message: any[]): void {
    this.logger.info(message);
  }

  error(...message: any[]): void {
    this.logger.error(message);
  }
}