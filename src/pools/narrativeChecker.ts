import { TokenNarrative } from './types';
import { chatCompletion } from '../api/openrouter';
import { config } from '../config';
import { logger } from '../logger';
import { Connection, PublicKey } from '@solana/web3.js';

export async function checkNarrative(tokenMint: string): Promise<TokenNarrative> {
  const defaultReturn: TokenNarrative = {
    mint: tokenMint,
    name: 'Unknown',
    description: 'No data',
    hasRealCatalyst: true, // Fail open if LLM/RPC fails, let metrics decide
    summary: 'Fallback narrative check.'
  };

  try {
    // Basic RPC name resolution is usually handled by metaplex metadata
    // For Degen247 V3 MVP constraint, we'll pass the mint directly to the LLM
    // and let its internal knowledge (if recently hyped) weigh in, 
    // or simulate a response if dryRun.
    
    if (config.dryRun) {
      return {
        ...defaultReturn,
        name: tokenMint.substring(0, 8),
        hasRealCatalyst: true,
        summary: 'Dry run narrative mock assumes viable token.'
      };
    }

    const prompt = `
Analyze the crypto token with mint address: ${tokenMint}
Is this token a known rug or currently hyped with a real catalyst?
If you don't know it, assume it's a new trendy memecoin that could be viable.
Return ONLY JSON:
{
  "name": "Token Name or Unknown",
  "description": "Short description",
  "hasRealCatalyst": true/false (true if hyped/viable, false if known rug/dead),
  "summary": "1 sentence verdict"
}
    `;

    const res = await chatCompletion([
      { role: 'system', content: 'You are an elite crypto narrative analyzer.' },
      { role: 'user', content: prompt }
    ], [], config.generalModel, 500);

    const parsed = JSON.parse(res);
    return {
      mint: tokenMint,
      name: parsed.name,
      description: parsed.description,
      hasRealCatalyst: !!parsed.hasRealCatalyst,
      summary: parsed.summary
    };
  } catch (err: any) {
    logger.warn('NARRATIVE', `LLM Narrative check failed for ${tokenMint}: ${err.message}`);
    return defaultReturn;
  }
}
