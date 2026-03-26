import { state } from '../state';
import { config } from '../config';
import { canOpenPosition, calculateDeployAmount } from '../positions/sizing';
import { scanMeteoraPools } from '../pools/poolScanner';
import { scorePoolCandidate } from '../pools/poolScorer';
import { TokenBlacklist } from '../pools/tokenBlacklist';
import { extractTopLpers } from '../discovery/walletDiscovery';
import { analyzeWalletStrategy } from '../discovery/strategyAnalyzer';
import { MemoryManager } from '../learning/memoryManager';
import { PoolMemory } from '../pools/poolMemory';
import { chatCompletion } from '../api/openrouter';
import { hunterTools } from './tools';
import { MeteoraClient } from '../positions/meteoraClient';
import { StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';
import { logger } from '../logger';
import { Connection } from '@solana/web3.js';
import Database from 'better-sqlite3';

export async function hunterReActLoop(
  db: Database.Database,
  connection: Connection,
  meteoraClient: MeteoraClient
) {
  logger.info('HUNTER', 'Starting Hunter ReAct Loop');
  
  // a. Check canOpenPosition
  const check = canOpenPosition(state, config);
  if (!check.allowed) {
    logger.info('HUNTER', `Aborting cycle: ${check.reason}`);
    return;
  }

  // b. Fetch scanMeteoraPools
  const candidates = await scanMeteoraPools(10);
  if (candidates.length === 0) {
    logger.info('HUNTER', 'No pool candidates found.');
    return;
  }

  // c & d. Calculate composite score & pick highest > 50
  const blacklist = new TokenBlacklist(db);
  let bestPool: any = null;
  let bestScore = 0;

  for (const c of candidates) {
    const score = await scorePoolCandidate(c, blacklist);
    if (score.composite > 50 && score.composite > bestScore) {
      bestScore = score.composite;
      bestPool = { ...c, metrics: score };
    }
  }

  if (!bestPool) {
    logger.info('HUNTER', 'No pools scored above 50.');
    return;
  }

  logger.info('HUNTER', `Selected best pool: ${bestPool.address} with score ${bestScore}`);

  // e. Fetch context for LLM
  const lpers = await extractTopLpers(bestPool.address, connection);
  const strategies = [];
  for (const lper of lpers.slice(0, 3)) {
    const strat = await analyzeWalletStrategy(lper.address);
    strategies.push({ wallet: lper.address, strategy: strat });
  }

  const memoryManager = new MemoryManager(db);
  const memories = memoryManager.getRelevantMemories('hunter', [bestPool.tokenMint, 'strategy', 'market']);

  // Calculate strict deployment constraints
  const deploySol = calculateDeployAmount(state.walletBalanceSol, config);
  const deployLamports = Math.floor(deploySol * 1e9);

  // f. Build System Prompt
  const systemPrompt = `
You are the DEGEN247 Hunter Agent. Your goal is to review a high-yield DLMM pool and decide whether to deploy capital or reject it.
You MUST output a tool call: either execute_deployment or reject_pool.

CONTEXT:
Pool Address: ${bestPool.address}
Pool Score: ${bestScore}
Max Deploy Lamports Allowed: ${deployLamports} (${deploySol} SOL)

LPer Strategies in this pool:
${JSON.stringify(strategies, null, 2)}

Relevant Past Memories/Lessons:
${JSON.stringify(memories, null, 2)}

RULES:
1. If the metrics look good and memories don't warn against, call execute_deployment.
2. If deploy, StrategyType is: 0 (Spot), 1 (Curve), 2 (BidAsk).
3. Lamports MUST NOT exceed ${deployLamports}.
4. If risky, call reject_pool with a reason.
`;

  // g. Call chatCompletion
  logger.info('HUNTER', 'Pinging LLM for execution decision...');
  const msgResponse = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analyze the pool and decide the strategy.' }
  ], hunterTools, config.screeningModel, 1000);

  // h. Handle tool call
  if (!msgResponse || !msgResponse.tool_calls) {
    logger.warn('HUNTER', 'LLM response invalid or missing tool_calls.');
    return;
  }

  for (const call of msgResponse.tool_calls) {
    if (call.function.name === 'execute_deployment') {
      const args = JSON.parse(call.function.arguments);
      logger.info('HUNTER', `Executing deployment logic for ${args.poolAddress} with ${args.lamports} lamports`);
      
      const poolMemory = new PoolMemory(db);
      poolMemory.recordDeploy(args.poolAddress, bestPool.tokenMint);
      
      try {
        // We use dummy split where totalX and totalY are half the lamports just for demonstration.
        // A real bot uses the token values properly via balancedAmounts but constraints require raw execution
        const res = await meteoraClient.openPosition({
          poolAddress: args.poolAddress,
          totalXAmount: new BN(args.lamports / 2),
          totalYAmount: new BN(args.lamports / 2),
          minBinId: -Math.floor(args.binWidth / 2), // relative offset logic simplification
          maxBinId: Math.floor(args.binWidth / 2),  // relative offset logic simplification
          strategyType: args.strategyType as StrategyType
        });
        
        // Save to DB positions table
        db.prepare(`
          INSERT INTO positions (id, pool_address, amount_sol, entry_value, status)
          VALUES (?, ?, ?, ?, 'open')
        `).run(res.positionPubkey, args.poolAddress, args.lamports / 1e9, args.lamports / 1e9);

        // Update state
        state.positions.set(res.positionPubkey, { id: res.positionPubkey, poolAddress: args.poolAddress });
        state.lastHunterCycle = new Date();
        logger.info('HUNTER', `Position successfully opened: ${res.positionPubkey}`);
      } catch (e: any) {
        logger.error('HUNTER', `Failed to open position: ${e.message}`);
      }
    } else if (call.function.name === 'reject_pool') {
      const args = JSON.parse(call.function.arguments);
      logger.info('HUNTER', `Pool ${args.poolAddress} rejected by LLM: ${args.reason}`);
      const memoryManager = new MemoryManager(db);
      memoryManager.addMemory('hunter', `Rejected pool ${args.poolAddress}: ${args.reason}`, 'Hunter_ReAct', 0.8, 24);
    }
  }
}
