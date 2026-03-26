import Database from 'better-sqlite3';
import { BlacklistedToken } from './types';
import { logger } from '../logger';

export class TokenBlacklist {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isBlacklisted(mintAddress: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM token_blacklist WHERE mint_address = ?').get(mintAddress);
    return !!row;
  }

  add(mintAddress: string, reason: string, by: string = 'system') {
    if (this.isBlacklisted(mintAddress)) return;
    
    this.db.prepare(`
      INSERT INTO token_blacklist (mint_address, reason, blacklisted_at, blacklisted_by)
      VALUES (?, ?, ?, ?)
    `).run(mintAddress, reason, Date.now(), by);
    
    logger.info('BLACKLIST', `Added ${mintAddress} to blacklist: ${reason}`);
  }

  remove(mintAddress: string) {
    this.db.prepare('DELETE FROM token_blacklist WHERE mint_address = ?').run(mintAddress);
    logger.info('BLACKLIST', `Removed ${mintAddress} from blacklist`);
  }

  getAll(): BlacklistedToken[] {
    const rows = this.db.prepare('SELECT * FROM token_blacklist ORDER BY blacklisted_at DESC').all() as any[];
    return rows.map(r => ({
      mintAddress: r.mint_address,
      reason: r.reason,
      blacklistedAt: r.blacklisted_at,
      blacklistedBy: r.blacklisted_by
    }));
  }
}
