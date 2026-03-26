import crypto from 'crypto';
import { logger } from '../logger';

export function exportKeyAuthorized(tokenInput: string, storedToken: string, privateKeyInput: string): string | null {
  if (!storedToken || !tokenInput) {
    logger.warn('OWNER', 'Unauthorized key export attempt: missing token');
    return null;
  }

  // Ensure same length for SafeEqual
  const a = Buffer.from(tokenInput, 'utf8');
  const b = Buffer.from(storedToken, 'utf8');

  if (a.length !== b.length) {
    logger.warn('OWNER', 'Unauthorized key export attempt: invalid token length');
    return null;
  }

  if (crypto.timingSafeEqual(a, b)) {
    logger.info('OWNER', 'Private key successfully exported');
    return privateKeyInput;
  }
  
  logger.warn('OWNER', 'Unauthorized key export attempt: invalid token');
  return null;
}
