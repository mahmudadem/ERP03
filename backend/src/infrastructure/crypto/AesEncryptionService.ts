/**
 * AesEncryptionService - AES-256-GCM encryption for sensitive data at rest
 *
 * Implementation of IEncryptionService using Node.js crypto module.
 * Uses AES-256-GCM (authenticated encryption) which provides both
 * confidentiality and integrity guarantees.
 *
 * Key management:
 * - Key sourced from AI_ENCRYPTION_KEY environment variable (base64-encoded 32 bytes)
 * - In development (NODE_ENV !== 'production'): if key is missing, logs a warning
 *   and operates in passthrough mode (no encryption) — NOT SECURE, dev only
 * - In production: if key is missing, encrypt/decrypt will throw an error — fail closed
 *
 * Storage format: base64(iv):base64(ciphertext):base64(authTag)
 * This format is self-contained and DB-agnostic (works in both Firestore and SQL).
 *
 * Security notes:
 * - Each encryption call generates a random 12-byte IV — identical plaintexts
 *   produce different ciphertexts
 * - Auth tag verification prevents tampering
 * - No key is ever logged or exposed in error messages
 */

import * as crypto from 'crypto';
import { IEncryptionService } from './IEncryptionService';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const KEY_LENGTH = 32; // 256 bits
const SEPARATOR = ':';

export class AesEncryptionService implements IEncryptionService {
  private key: Buffer | null;
  private isProduction: boolean;
  private keyAvailable: boolean;

  constructor() {
    this.isProduction = (process.env.NODE_ENV || 'development') === 'production';
    const envKey = process.env.AI_ENCRYPTION_KEY;

    if (envKey) {
      try {
        this.key = Buffer.from(envKey, 'base64');
        if (this.key.length !== KEY_LENGTH) {
          throw new Error(
            `AI_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${this.key.length}. ` +
            `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
          );
        }
        this.keyAvailable = true;
      } catch (err) {
        if (this.isProduction) {
          throw new Error(
            `AI_ENCRYPTION_KEY is invalid. In production, a valid key is required. ` +
            `Error: ${(err as Error).message}`
          );
        }
        console.warn(
          `[AesEncryptionService] AI_ENCRYPTION_KEY is invalid. Running in passthrough mode (NO ENCRYPTION). ` +
          `This is NOT secure for production. Error: ${(err as Error).message}`
        );
        this.key = null;
        this.keyAvailable = false;
      }
    } else {
      this.key = null;
      this.keyAvailable = false;

      if (this.isProduction) {
        throw new Error(
          'AI_ENCRYPTION_KEY environment variable is required in production. ' +
          'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
        );
      }

      console.warn(
        '[AesEncryptionService] AI_ENCRYPTION_KEY not set. Running in passthrough mode (NO ENCRYPTION). ' +
        'This is NOT secure for production. Set AI_ENCRYPTION_KEY to enable encryption.'
      );
    }
  }

  encrypt(plaintext: string): string {
    if (!this.keyAvailable || !this.key) {
      // Development passthrough: store plaintext with a prefix marker
      // so decrypt() can recognize it later
      return `plain:${plaintext}`;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      ciphertext,
      authTag.toString('base64'),
    ].join(SEPARATOR);
  }

  decrypt(encrypted: string): string {
    // Handle passthrough mode (development)
    if (encrypted.startsWith('plain:')) {
      if (this.isProduction) {
        throw new Error('Cannot decrypt plaintext data in production. Encrypted data expected.');
      }
      return encrypted.substring(6); // Remove 'plain:' prefix
    }

    if (!this.keyAvailable || !this.key) {
      throw new Error('Cannot decrypt: encryption key not available. Set AI_ENCRYPTION_KEY.');
    }

    const parts = encrypted.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected iv:ciphertext:authTag.');
    }

    const [ivB64, ciphertextB64, authTagB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertextB64, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  isAvailable(): boolean {
    return this.keyAvailable;
  }
}