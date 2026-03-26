import { state } from '../state';
import { generateMorningBriefing } from '../agents/briefing';
import { exportKeyAuthorized } from '../owner/keyExport';
import { formatStatus, formatEmergencyStatus, formatSuccess, formatKeysExportAuthFail } from './formatter';
import { config } from '../config';
import Database from 'better-sqlite3';

export class TelegramInterface {
  private db: Database.Database;
  private envAuthToken: string;
  private envPrivKey: string;
  
  // We decouple the actual bot implementation from logic mapping so we can mock the router easily
  constructor(db: Database.Database, envAuthToken: string, envPrivKey: string) {
    this.db = db;
    this.envAuthToken = envAuthToken;
    this.envPrivKey = envPrivKey;
  }

  public async handleCommand(cmdRaw: string): Promise<string> {
    const parts = cmdRaw.trim().split(' ');
    const cmd = parts[0].toLowerCase();

    try {
      switch (cmd) {
        case '/status':
          return formatStatus(state.walletBalanceSol, state.positions.size, state.paused);
        case '/pause':
          state.paused = true;
          return formatSuccess('Hunter execution paused.');
        case '/resume':
          state.paused = false;
          return formatSuccess('Hunter execution resumed.');
        case '/emergency':
          state.paused = true;
          // In real implementation this fires Meteora close calls async here
          return formatEmergencyStatus();
        case '/briefing':
          return generateMorningBriefing(this.db);
        case '/exportkey':
          const tokenArg = parts[1] || '';
          const key = exportKeyAuthorized(tokenArg, this.envAuthToken, this.envPrivKey);
          if (!key) return formatKeysExportAuthFail();
          return `EPHEMERAL KEY (DELETING SOON):\\n${key}`;
        default:
          return `🧠 OpenRouter Agent routed: Free-form echo for '${cmdRaw}'.`;
      }
    } catch (e: any) {
      return `❌ System Error: ${e.message}`;
    }
  }
}
