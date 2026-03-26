import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from './config';
import crypto from 'crypto';

let activeWallet: Keypair | null = null;

export function loadWallet(): Keypair {
  if (activeWallet) return activeWallet;

  if (!config.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY not configured.');
  }

  try {
    const decoded = bs58.decode(config.WALLET_PRIVATE_KEY);
    activeWallet = Keypair.fromSecretKey(decoded);
    return activeWallet;
  } catch (err) {
    throw new Error(`Failed to load wallet from base58: ${(err as Error).message}`);
  }
}

export function getPublicKey(): PublicKey {
  return loadWallet().publicKey;
}

export async function getBalance(connection: Connection): Promise<number> {
  const pubkey = getPublicKey();
  const balance = await connection.getBalance(pubkey);
  return balance / 1e9;
}

export function exportPrivateKey(inputToken: string, configuredToken: string): string | null {
  if (!inputToken || !configuredToken) return null;
  
  const a = Buffer.from(inputToken);
  const b = Buffer.from(configuredToken);

  if (a.length !== b.length) return null;

  if (crypto.timingSafeEqual(a, b)) {
    return bs58.encode(loadWallet().secretKey);
  }
  return null;
}
