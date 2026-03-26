import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js';
import { logger } from '../logger';

export class SolanaClient {
  private primary: Connection;
  private fallback?: Connection;

  constructor(primaryUrl: string, fallbackUrl?: string) {
    this.primary = new Connection(primaryUrl, 'confirmed');
    if (fallbackUrl) {
      this.fallback = new Connection(fallbackUrl, 'confirmed');
    }
  }

  private async executeWithFallback<T>(operation: (conn: Connection) => Promise<T>, context: string): Promise<T> {
    try {
      return await operation(this.primary);
    } catch (err) {
      logger.warn('SOLANA', `Primary RPC failed for ${context}: ${(err as Error).message}`);
      if (this.fallback) {
        logger.info('SOLANA', `Retrying ${context} with fallback RPC`);
        return await operation(this.fallback);
      }
      throw err;
    }
  }

  async getBalance(pubkey: PublicKey | string): Promise<number> {
    const target = typeof pubkey === 'string' ? new PublicKey(pubkey) : pubkey;
    const balanceLamports = await this.executeWithFallback(
      (conn) => conn.getBalance(target),
      'getBalance'
    );
    return balanceLamports / 1e9;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    const result = await this.executeWithFallback(
      (conn) => conn.confirmTransaction(signature, 'confirmed'),
      `confirmTx:${signature}`
    );
    return !result.value.err;
  }

  async getRecentBlockhash(): Promise<string> {
    const result = await this.executeWithFallback(
      (conn) => conn.getLatestBlockhash('confirmed'),
      'getRecentBlockhash'
    );
    return result.blockhash;
  }

  getConnection(): Connection {
    return this.primary; // Expose strictly for SDKs that require native Web3.js Connection objects
  }
}
