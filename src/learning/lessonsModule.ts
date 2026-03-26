import { chatCompletion } from '../api/openrouter';
import { MemoryManager } from './memoryManager';
import { PositionRecord } from '../positions/types';
import { config } from '../config';
import { logger } from '../logger';

export async function extractLessonsFromTrade(
  position: PositionRecord, 
  memoryManager: MemoryManager
): Promise<void> {
  try {
    const prompt = `
Analyze this trade result and extract a single, concise trading lesson.
Position: ${position.poolAddress}
Result: PNL: ${position.pnlSol} SOL, Fees: ${position.feesSol} SOL
Status: ${position.status}
Exit Reason: ${position.exitReason || 'Unknown'}

Return ONLY a JSON object: {"title": "Short title", "description": "1 sentence lesson", "confidence": 0.8}
`;

    if (config.dryRun) {
      logger.info('LEARNING', `[DRY RUN] Extracted mock lesson for ${position.id}`);
      memoryManager.addMemory('shared', `Lesson: Hold winners longer (${position.exitReason})`, `Trade:${position.id}`, 0.9, 0);
      return;
    }

    const res = await chatCompletion([
      { role: 'system', content: 'You are an elite DeFi trading AI.' },
      { role: 'user', content: prompt }
    ], [], config.managementModel, 500);

    const parsed = JSON.parse(res);
    memoryManager.addMemory(
      'shared', 
      `Lesson [${parsed.title}]: ${parsed.description}`, 
      `Trade:${position.id}`, 
      parsed.confidence || 0.5, 
      0 // 0 means no expiry for pinned shared lessons
    );
    logger.info('LEARNING', `Learned lesson from ${position.id}`);
  } catch (err: any) {
    logger.warn('LEARNING', `Failed to extract lesson: ${err.message}`);
  }
}
