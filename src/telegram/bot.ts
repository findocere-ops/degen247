import { state } from '../state';
import { generateMorningBriefing } from '../agents/briefing';
import { formatStatus, formatEmergencyStatus, formatSuccess } from './formatter';
import { config } from '../config';
import Database from 'better-sqlite3';

export class TelegramInterface {
  private db: Database.Database;

  
  // We decouple the actual bot implementation from logic mapping so we can mock the router easily
  constructor(db: Database.Database) {
    this.db = db;
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

        default:
          return `🧠 OpenRouter Agent routed: Free-form echo for '${cmdRaw}'.`;
      }
    } catch (e: any) {
      return `❌ System Error: ${e.message}`;
    }
  }
}
