"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderRateLimitError = exports.ProviderAuthError = exports.ProviderUnavailableError = exports.ProviderError = void 0;
/**
 * Re-export from canonical location.
 * ProviderErrors now live in the errors/ directory alongside other AppError types,
 * so the error handler can catch them via `instanceof AppError`.
 */
var ProviderErrors_1 = require("../../errors/ProviderErrors");
Object.defineProperty(exports, "ProviderError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderError; } });
Object.defineProperty(exports, "ProviderUnavailableError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderUnavailableError; } });
Object.defineProperty(exports, "ProviderAuthError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderAuthError; } });
Object.defineProperty(exports, "ProviderRateLimitError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderRateLimitError; } });
//# sourceMappingURL=ProviderErrors.js.map