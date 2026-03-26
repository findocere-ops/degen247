import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config';
import { MIGRATIONS } from './migrations';

let db: Database.Database | null = null;

export function initDb(): Database.Database {
  if (db) return db;

  const dbPath = path.resolve(process.cwd(), config.DB_PATH);
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('journal_size_limit = 1048576');

  // Run migrations
  db.exec('BEGIN EXCLUSIVE');
  try {
    for (const statement of MIGRATIONS) {
      db.exec(statement);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertLog(level: string, component: string, message: string) {
  if (!db) return;
  const stmt = db.prepare('INSERT INTO system_log (level, component, message) VALUES (?, ?, ?)');
  stmt.run(level, component, message);
}
