import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../logger';
import { calculateMetrics } from './metrics';

export function evolveThresholds(db: Database.Database, configPath: string) {
  logger.info('LEARNING', 'Starting threshold evolution check...');

  const closedCountRow = db.prepare("SELECT COUNT(*) as count FROM positions WHERE status = 'closed'").get() as any;
  if (!closedCountRow || closedCountRow.count < 5) {
    logger.info('LEARNING', 'Not enough closed positions (<5) to evolve thresholds safely.');
    return;
  }

  // Reload config
  const configRaw = fs.readFileSync(configPath, 'utf8');
  const userConfig = JSON.parse(configRaw);

  const targets = ['minFeeActiveTvlRatio', 'minOrganic', 'minHolders'];
  let configChanged = false;

  for (const t of targets) {
    const currentVal = userConfig[t];

    const aboveMetrics = calculateMetrics(db, t, currentVal, true);
    const belowMetrics = calculateMetrics(db, t, currentVal, false);

    // Mock evolution delta simulation
    // If we've got higher win rates, trend toward it
    // In V3 MVP test logic, we force a winRate change
    
    // For deterministic testing:
    let delta = 0;
    if (aboveMetrics.winRate > belowMetrics.winRate + 0.1) {
      // higher is strictly 10% better -> increase target
      delta = currentVal * 0.10;
    } else if (belowMetrics.winRate > aboveMetrics.winRate + 0.1) {
      // lower is strictly 10% better -> decrease target
      delta = -(currentVal * 0.10);
    }

    if (delta !== 0) {
      const oldVal = userConfig[t];
      userConfig[t] = oldVal + delta;
      
      // Enforce bounds
      if (t === 'minOrganic' && userConfig[t] > 100) userConfig[t] = 100;

      logger.info('LEARNING', `Evolved ${t}: ${oldVal.toFixed(3)} -> ${userConfig[t].toFixed(3)}`);
      configChanged = true;
    }
  }

  if (configChanged) {
    fs.writeFileSync(configPath, JSON.stringify(userConfig, null, 2));
    logger.info('LEARNING', 'Updated user-config.json successfully');

    // Unpin stale lessons
    db.prepare("UPDATE agent_memory SET pinned = 0 WHERE agent_role = 'shared' AND pinned = 1").run();
    logger.info('LEARNING', 'Stale memory pins dropped due to macro evolutionary pivot');
  } else {
    logger.info('LEARNING', 'No statistically viable evolutions found.');
  }
}
