import { config } from './config';
// We'll import db dynamically or use a dependency injection approach to avoid circular deps during boot
let dbModule: any = null;

export function setLogDatabase(db: any) {
  dbModule = db;
}

export const logger = {
  info: (component: string, message: string) => log('INFO', component, message),
  warn: (component: string, message: string) => log('WARN', component, message),
  error: (component: string, message: string) => log('ERROR', component, message),
  debug: (component: string, message: string) => {
    if (process.env.DEBUG === 'true' || !config.dryRun) log('DEBUG', component, message);
  }
};

function log(level: string, component: string, message: string) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logMsg = `[${timestamp}] [${level}] [${component}] ${message}`;

  if (level === 'ERROR') {
    console.error(logMsg);
  } else if (level === 'WARN') {
    console.warn(logMsg);
  } else {
    console.log(logMsg);
  }

  if (dbModule && dbModule.insertLog) {
    try {
      dbModule.insertLog(level, component, message);
    } catch (e) {
      // Ignore DB log failures
    }
  }
}
