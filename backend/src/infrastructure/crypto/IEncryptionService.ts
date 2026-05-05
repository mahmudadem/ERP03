/**
 * IEncryptionService - Interface for encryption/decryption operations
 *
 * Clean Architecture boundary: The application layer depends on this interface,
 * not on any specific encryption implementation. This keeps crypto details
 * in the infrastructure layer where they belong.
 *
 * Primary use: Encrypting AI provider API keys at rest.
 * Future use: Any sensitive field that needs encryption before database storage.
 */

export interface IEncryptionService {
  /**
   * Encrypt a plaintext string.
   * Returns an opaque encrypted string that can be safely stored in any database.
   *
   * The encrypted format includes IV and auth tag internally,
   * so decrypt() only needs the encrypted string and the same key.
   */
  encrypt(plaintext: string): string;

  /**
   * Decrypt a previously encrypted string.
   *
   * @throws Error if decryption fails (wrong key, corrupted data, etc.)
   */
  decrypt(encrypted: string): string;

  /**
   * Check if the encryption service is available and properly configured.
   * Returns true if encrypt/decrypt will work, false if the key is missing
   * and we're in a mode that tolerates that (development).
   */
  isAvailable(): boolean;
}