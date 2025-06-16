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

    // Set up log rotation
    this.maxLogFiles = 7; // Keep 7 days of logs
    this.rotateLogs();
  }

  rotateLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      // Sort by date (newest first)
      logFiles.sort((a, b) => b.localeCompare(a));
      
      // Remove old log files
      if (logFiles.length > this.maxLogFiles) {
        logFiles.slice(this.maxLogFiles).forEach(file => {
          fs.unlinkSync(path.join(this.logDir, file));
        });
      }
    } catch (error) {
      console.error('Error rotating logs:', error);
    }
  }

  formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    // Only include non-empty context
    const contextStr = context && Object.keys(context).length > 0 
      ? ` [${JSON.stringify(context)}]` 
      : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  writeToFile(level, message, context) {
    // Skip debug logs in production
    if (process.env.NODE_ENV === 'production' && level === 'DEBUG') {
      return;
    }

    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const formattedMessage = this.formatMessage(level, message, context) + '\n';
    
    try {
      fs.appendFileSync(logFile, formattedMessage);
    } catch (error) {
      console.error('Error writing to log file:', error);
    }
  }

  shouldLog(level, context) {
    const levelValue = this.logLevels[level] || this.logLevels.INFO;
    
    // Always log critical errors
    if (level === 'CRITICAL') return true;
    
    // Skip debug logs in production
    if (process.env.NODE_ENV === 'production' && level === 'DEBUG') {
      return false;
    }
    
    // Skip certain noisy contexts in production
    if (process.env.NODE_ENV === 'production') {
      const noisyContexts = ['heartbeat', 'ping', 'pong', 'cleanup'];
      if (context && noisyContexts.some(nc => JSON.stringify(context).includes(nc))) {
        return false;
      }
    }
    
    return levelValue >= this.consoleLevel;
  }

  log(level, message, context = null, forceConsole = false) {
    if (!this.shouldLog(level, context) && !forceConsole) {
      return;
    }
    
    // Always write to file if enabled
    if (process.env.ENABLE_FILE_LOGGING === 'true') {
      this.writeToFile(level, message, context);
    }
    
    // Only log to console based on level or force flag
    if (this.logLevels[level] >= this.consoleLevel || forceConsole) {
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