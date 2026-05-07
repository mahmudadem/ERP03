"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=IEncryptionService.js.map