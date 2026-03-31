import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { Connection } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { initDb, closeDb } from './db/database';
import { config } from './config';
import { logger } from './logger';
import { state } from './state';
import { loadWallet, getBalance } from './wallet';
import { MeteoraClient } from './positions/meteoraClient';
import { TelegramInterface } from './telegram/bot';

// Core workflows
import { hunterReActLoop } from './agents/hunterAgent';
import { healerReActLoop } from './agents/healerAgent';
import { healthCheck } from './agents/healthCheck';
import { generateMorningBriefing } from './agents/briefing';
import { evolveThresholds } from './learning/thresholdEvolution';

export async function bootstrap() {
  logger.info('SYSTEM', 'Booting DEGEN247 v3.0 (Meridian Architecture)');

  if (config.dryRun) {
    logger.warn('SYSTEM', '⚠️ DRY RUN MODE ACTIVE ⚠️');
  }

  // 0. Ensure required directories exist
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info('SYSTEM', 'Created logs/ directory');
  }

  // 1. Storage & State
  const db = initDb();

  // 2. Network & Execution
  const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
  const wallet = loadWallet();
  const meteoraClient = new MeteoraClient(connection, wallet, config.dryRun);

  // 3. Fetch real wallet balance at boot
  try {
    state.walletBalanceSol = await getBalance(connection);
    state.highWaterMark = state.walletBalanceSol;
    logger.info('SYSTEM', `Wallet: ${wallet.publicKey.toBase58()} | Balance: ${state.walletBalanceSol.toFixed(4)} SOL`);
  } catch (e: any) {
    logger.warn('SYSTEM', `Could not fetch wallet balance: ${e.message} — defaulting to 0`);
    state.walletBalanceSol = 0;
  }

  // 4. Initial Health Check
  await healthCheck(db, connection);

  // 5. Launch Telegram Bot (if token is configured)
  if (config.TELEGRAM_BOT_TOKEN) {
    try {
      const telegramInterface = new TelegramInterface(db);

      const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

      // Authorization middleware
      bot.use(async (ctx, next) => {
        if (!config.TELEGRAM_CHAT_ID || ctx.chat?.id.toString() !== config.TELEGRAM_CHAT_ID) {
          logger.warn('TELEGRAM', `Unauthorized access attempt from chat ID: ${ctx.chat?.id}`);
          return;
        }
        return next();
      });

      // Bot commands
      bot.command('start', ctx =>
        ctx.reply(
          '🤖 DEGEN247 Agent Online!\n\nCommands:\n/status — Portfolio status\n/pause — Pause trading\n/resume — Resume trading\n/emergency — Emergency close all\n/briefing — Morning report'
        )
      );

      bot.command('status', async ctx => {
        const reply = await telegramInterface.handleCommand('/status');
        ctx.reply(reply);
      });

      bot.command('pause', async ctx => {
        const reply = await telegramInterface.handleCommand('/pause');
        ctx.reply(reply);
      });

      bot.command('resume', async ctx => {
        const reply = await telegramInterface.handleCommand('/resume');
        ctx.reply(reply);
      });

      bot.command('emergency', async ctx => {
        const reply = await telegramInterface.handleCommand('/emergency');
        ctx.reply(reply);
      });

      bot.command('briefing', async ctx => {
        const reply = await telegramInterface.handleCommand('/briefing');
        ctx.reply(reply);
      });



      // Free-form text → route to agent (echoes reasoning for now)
      bot.on('text', async ctx => {
        const text = ctx.message.text ?? '';
        if (!text.startsWith('/')) {
          const reply = await telegramInterface.handleCommand(text);
          ctx.reply(reply);
        }
      });

      // Start bot in long-polling mode (no webhook, works without a public IP)
      bot.launch({ dropPendingUpdates: true }).catch(e =>
        logger.error('TELEGRAM', `Bot launch error: ${e.message}`)
      );

      // Graceful bot stop on exit
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));

      logger.info('SYSTEM', '✅ Telegram bot launched (long-polling)');
    } catch (e: any) {
      logger.warn('SYSTEM', `Telegram bot failed to start: ${e.message} — continuing without Telegram`);
    }
  } else {
    logger.warn('SYSTEM', 'TELEGRAM_BOT_TOKEN not set — Telegram control disabled');
  }

  // 6. Cron Schedules
  logger.info(
    'SYSTEM',
    `Registering cron: Hunter [${config.screeningIntervalMin}m], Healer [${config.managementIntervalMin}m]`
  );

  // Healer: fast loop
  cron.schedule(`*/${config.managementIntervalMin} * * * *`, async () => {
    if (state.paused) return;
    try {
      await healerReActLoop(db, connection, meteoraClient);
    } catch (e: any) {
      logger.error('HEALER', e.message);
    }
  });

  // Hunter: slow loop
  cron.schedule(`*/${config.screeningIntervalMin} * * * *`, async () => {
    if (state.paused) return;
    try {
      await hunterReActLoop(db, connection, meteoraClient);
    } catch (e: any) {
      logger.error('HUNTER', e.message);
    }
  });

  // Health + balance refresh: hourly
  cron.schedule('0 * * * *', async () => {
    try {
      state.walletBalanceSol = await getBalance(connection);
      await healthCheck(db, connection);
    } catch (e: any) {
      logger.error('RISK', e.message);
    }
  });

  // Learning / Threshold Evolve: Daily Midnight
  cron.schedule('0 0 * * *', () => {
    try {
      evolveThresholds(db, path.join(process.cwd(), 'user-config.json'));
    } catch (e: any) {
      logger.error('LEARNING', e.message);
    }
  });

  // Morning Briefing
  cron.schedule(`0 ${config.briefingHour} * * *`, () => {
    try {
      const b = generateMorningBriefing(db);
      logger.info('OWNER', b);
    } catch (e: any) {
      logger.error('OWNER', e.message);
    }
  });

  logger.info('SYSTEM', '🚀 All cron schedules registered. DEGEN247 is LIVE.');

  // 7. Graceful shutdown
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
