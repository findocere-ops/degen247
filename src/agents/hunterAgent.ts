import { state } from '../state';
import { config } from '../config';
import { canOpenPosition, calculateDeployAmount } from '../positions/sizing';
import { scanMeteoraPools } from '../pools/poolScanner';
import { scorePoolCandidate } from '../pools/poolScorer';
import { TokenBlacklist } from '../pools/tokenBlacklist';
import { extractTopLpers } from '../discovery/walletDiscovery';
import { analyzeWalletStrategy } from '../discovery/strategyAnalyzer';
import { MemoryManager } from '../learning/memoryManager';
import { sanitizeForPrompt, sanitizeMemories } from '../utils/sanitizer';
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

  // b. Scan pools
  const candidates = await scanMeteoraPools(10);
  if (candidates.length === 0) {
    logger.info('HUNTER', 'No pool candidates found.');
    return;
  }

  // c & d. Score and pick best
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

  logger.info('HUNTER', `Selected pool: ${bestPool.address} score=${bestScore}`);

  // e. Fetch LPer strategies + memory context
  const lpers = await extractTopLpers(bestPool.address, connection);
  const strategies = [];
  for (const lper of lpers.slice(0, 3)) {
    const strat = await analyzeWalletStrategy(lper.address);
    // Sanitize the analysis to prevent prompt injection
    strategies.push({ wallet: sanitizeForPrompt(lper.address), strategy: sanitizeForPrompt(JSON.stringify(strat)) });
  }

  const memoryManager = new MemoryManager(db);
  const memories = memoryManager.getRelevantMemories('hunter', [
    bestPool.tokenMint,
    'strategy',
    'market',
  ]);
  const safeMemories = sanitizeMemories(memories);

  const deploySol = calculateDeployAmount(state.walletBalanceSol, config);
  const deployLamports = Math.floor(deploySol * 1e9);

  // f. System prompt
  const systemPrompt = `
You are the DEGEN247 Hunter Agent. Review this DLMM pool and decide: deploy capital or reject.
You MUST output a tool call: execute_deployment OR reject_pool.

Pool Address: ${bestPool.address}
Pool Score: ${bestScore}
Max Deploy Lamports: ${deployLamports} (${deploySol} SOL)

LPer Strategies:
${JSON.stringify(strategies, null, 2)}

Relevant Memories:
${JSON.stringify(safeMemories, null, 2)}

RULES:
1. If metrics look good and memories don't warn against, call execute_deployment.
2. strategyType: 3=SpotBalanced (recommended), 6=CurveBalanced, 8=BidAskBalanced
3. binWidth: recommended 40 for Spot, 20 for BidAsk. Must be even.
4. lamports MUST NOT exceed ${deployLamports}.
5. If risky, call reject_pool with a detailed reason.
`;

  logger.info('HUNTER', 'Querying LLM for deployment decision...');
  const msgResponse = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Analyze the pool and decide the strategy.' },
    ],
    hunterTools,
    config.screeningModel,
    1000
  );

  if (!msgResponse || !msgResponse.tool_calls) {
    logger.warn('HUNTER', 'LLM response invalid or missing tool_calls.');
    return;
  }

  for (const call of msgResponse.tool_calls) {
    if (call.function.name === 'execute_deployment') {
      const args = JSON.parse(call.function.arguments);
      logger.info(
        'HUNTER',
        `Deploying ${args.lamports} lamports to ${args.poolAddress} strategy=${args.strategyType} bins=${args.binWidth}`
      );

      const poolMemory = new PoolMemory(db);
      poolMemory.recordDeploy(args.poolAddress, bestPool.tokenMint);

      try {
        const halfBins = Math.floor(args.binWidth / 2);

        // Map LLM strategyType int to SDK StrategyType enum
        // 0=Spot, 1=Curve, 2=BidAsk
        const sdkStrategy: StrategyType = (args.strategyType as StrategyType) ?? 0;

        const res = await meteoraClient.openPosition({
          poolAddress: args.poolAddress,
          totalXAmount: new BN(Math.floor(args.lamports / 2)),
          minBinId: -halfBins,
          maxBinId: halfBins,
          strategyType: sdkStrategy,
        });

        // Store position with real bin IDs from the open result
        db.prepare(`
          INSERT INTO positions (id, pool_address, amount_sol, entry_value, status, lower_bin_id, upper_bin_id)
          VALUES (?, ?, ?, ?, 'open', ?, ?)
        `).run(
          res.positionPubkey,
          args.poolAddress,
          args.lamports / 1e9,
          args.lamports / 1e9,
          res.lowerBinId,
          res.upperBinId
        );

        state.positions.set(res.positionPubkey, {
          id: res.positionPubkey,
          poolAddress: args.poolAddress,
        });
        state.lastHunterCycle = new Date();

        logger.info(
          'HUNTER',
          `Position opened: ${res.positionPubkey} bins [${res.lowerBinId}, ${res.upperBinId}] tx=${res.txSignature}`
        );
      } catch (e: any) {
        logger.error('HUNTER', `Failed to open position: ${e.message}`);
      }
    } else if (call.function.name === 'reject_pool') {
      const args = JSON.parse(call.function.arguments);
      logger.info('HUNTER', `Pool rejected: ${args.poolAddress} — ${args.reason}`);
      memoryManager.addMemory(
        'hunter',
        `Rejected ${args.poolAddress}: ${args.reason}`,
        'Hunter_ReAct',
        0.8,
        24
      );
    }
  }
}
