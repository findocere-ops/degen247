import cron from 'node-cron';
import { Connection } from '@solana/web3.js';
import { initDb, closeDb } from './db/database';
import { config } from './config';
import { logger } from './logger';
import { state } from './state';
import { loadWallet } from './wallet';
import { MeteoraClient } from './positions/meteoraClient';

// Core workflows
import { hunterReActLoop } from './agents/hunterAgent';
import { healerReActLoop } from './agents/healerAgent';
import { healthCheck } from './agents/healthCheck';
import { generateMorningBriefing } from './agents/briefing';
import { evolveThresholds } from './learning/thresholdEvolution';
import * as path from 'path';

export async function bootstrap() {
  logger.info('SYSTEM', 'Booting DEGEN247 v3.0 (Meridian Architecture)');
  
  if (config.dryRun) {
    logger.warn('SYSTEM', '⚠️ DRY RUN MODE ACTIVE ⚠️');
  }

  // 1. Storage & State
  const db = initDb();
  state.walletBalanceSol = 0; // Fetch from RPC in real run
  state.highWaterMark = 0;
  
  // 2. Net & Exec
  const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
  const wallet = loadWallet();
  const meteoraClient = new MeteoraClient(connection, wallet, config.dryRun);
  
  // Initial Health Check
  await healthCheck(db, connection);

  // 3. Routing via Cron
  logger.info('SYSTEM', `Registering cron: Hunter [${config.screeningIntervalMin}m], Healer [${config.managementIntervalMin}m]`);

  // Healer: fast loop
  cron.schedule(`*/${config.managementIntervalMin} * * * *`, async () => {
    if (state.paused) return;
    try { await healerReActLoop(db, connection, meteoraClient); }
    catch (e: any) { logger.error('HEALER', e.message); }
  });

  // Hunter: slow loop
  cron.schedule(`*/${config.screeningIntervalMin} * * * *`, async () => {
    if (state.paused) return;
    try { await hunterReActLoop(db, connection, meteoraClient); }
    catch (e: any) { logger.error('HUNTER', e.message); }
  });

  // Health: hourly
  cron.schedule('0 * * * *', async () => {
    try { await healthCheck(db, connection); }
    catch (e: any) { logger.error('RISK', e.message); }
  });

  // Learning / Threshold Evolve: Daily Midnight
  cron.schedule('0 0 * * *', () => {
    try { evolveThresholds(db, path.join(__dirname, '..', 'user-config.json')); }
    catch (e: any) { logger.error('LEARNING', e.message); }
  });

  // Morning Briefing: Daily 8am
  cron.schedule(`0 ${config.briefingHour} * * *`, () => {
    try {
      const b = generateMorningBriefing(db);
      logger.info('OWNER', b);
    } catch (e: any) {
      logger.error('OWNER', e.message);
    }
  });

  logger.info('SYSTEM', 'All cron schedules registered. Degen247 is LIVE.');

  // Handle exits
  process.on('SIGINT', () => {
    logger.info('SYSTEM', 'Graceful shutdown initiated...');
    closeDb();
    process.exit(0);
  });
}

// Auto-boot if not imported
if (require.main === module) {
  bootstrap().catch(err => {
    console.error('CRITICAL BOOT FAILURE:', err);
    process.exit(1);
  });
}
