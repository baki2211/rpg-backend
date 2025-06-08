import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logLevels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    
    // Only log WARN and above to console in production
    this.consoleLevel = process.env.NODE_ENV === 'production' ? this.logLevels.WARN : this.logLevels.INFO;
    
    // Create logs directory if it doesn't exist
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  writeToFile(level, message, context) {
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const formattedMessage = this.formatMessage(level, message, context) + '\n';
    
    fs.appendFileSync(logFile, formattedMessage);
  }

  log(level, message, context = null, forceConsole = false) {
    const levelValue = this.logLevels[level] || this.logLevels.INFO;
    
    // Always write to file if enabled
    if (process.env.ENABLE_FILE_LOGGING === 'true') {
      this.writeToFile(level, message, context);
    }
    
    // Only log to console based on level or force flag
    if (levelValue >= this.consoleLevel || forceConsole) {
      const formattedMessage = this.formatMessage(level, message, context);
      
      switch (level) {
        case 'ERROR':
        case 'CRITICAL':
          console.error(formattedMessage);
          break;
        case 'WARN':
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }

  debug(message, context = null) {
    this.log('DEBUG', message, context);
  }

  info(message, context = null) {
    this.log('INFO', message, context);
  }

  warn(message, context = null) {
    this.log('WARN', message, context);
  }

  error(message, context = null) {
    this.log('ERROR', message, context);
  }

  critical(message, context = null) {
    this.log('CRITICAL', message, context, true); // Always show critical errors
  }

  // Special methods for specific categories
  websocket(message, context = null) {
    this.debug(`[WebSocket] ${message}`, context);
  }

  database(message, context = null) {
    this.info(`[Database] ${message}`, context);
  }

  session(message, context = null) {
    this.info(`[Session] ${message}`, context);
  }

  character(message, context = null) {
    this.debug(`[Character] ${message}`, context);
  }

  skill(message, context = null) {
    this.debug(`[Skill] ${message}`, context);
  }

  // System startup messages (always show)
  startup(message, context = null) {
    this.log('INFO', `[Startup] ${message}`, context, true);
  }
}

export const logger = new Logger(); 