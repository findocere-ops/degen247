import { Connection, PublicKey } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { logger } from '../logger';

export interface TopLper {
  address: string;
  score: number;
}

export async function extractTopLpers(poolAddress: string, connection: Connection): Promise<TopLper[]> {
  try {
    const pool = await DLMM.create(connection, new PublicKey(poolAddress));
    // Since DLMM token mint distribution requires expensive RPC getTokenLargestAccounts,
    // we fetch the top 10 holders of the LB Pair mints (if standard CPMM) 
    // or by inspecting position accounts owned by program and mapped to pool.
    
    // As a simplification for the Agent constraints: we query RPC for program accounts mapped to pool
    const positionAccounts = await connection.getProgramAccounts(
      new PublicKey('LBUZKhRxPF3XUpBCjp4kVfXoneVcgVKpiHxRSVdfNDy'), // Meteora DLMM Program
      {
        filters: [
          { dataSize: 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 32 + 8 }, // approx size of PositionV2 
          { memcmp: { offset: 8, bytes: poolAddress } } // lbPair layout offset
        ],
        commitment: 'confirmed'
      }
    );

    // Naive heuristic: count position frequency per owner. 
    // A robust impl would deserialize amounts, but RPC constraints favor frequency.
    const ownerCounts = new Map<string, number>();

    for (const acc of positionAccounts) {
      // Owner is next 32 bytes after lbPair
      const ownerBuffer = acc.account.data.slice(8 + 32, 8 + 32 + 32);
      const ownerStr = new PublicKey(ownerBuffer).toBase58();
      ownerCounts.set(ownerStr, (ownerCounts.get(ownerStr) || 0) + 1);
    }

    const sorted = Array.from(ownerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([address, count]) => ({ address, score: count * 10 })); // Weight heuristic

    return sorted;
  } catch (err: any) {
    logger.warn('DISCOVERY', `Failed to extract LPs for ${poolAddress}: ${err.message}`);
    return [];
  }
}
