"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderRateLimitError = exports.ProviderAuthError = exports.ProviderUnavailableError = exports.ProviderError = exports.AxiosHttpClient = void 0;
var AxiosHttpClient_1 = require("./AxiosHttpClient");
Object.defineProperty(exports, "AxiosHttpClient", { enumerable: true, get: function () { return AxiosHttpClient_1.AxiosHttpClient; } });
// ProviderErrors re-exported from canonical location (errors/) for backward compatibility
var ProviderErrors_1 = require("../../errors/ProviderErrors");
Object.defineProperty(exports, "ProviderError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderError; } });
Object.defineProperty(exports, "ProviderUnavailableError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderUnavailableError; } });
Object.defineProperty(exports, "ProviderAuthError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderAuthError; } });
Object.defineProperty(exports, "ProviderRateLimitError", { enumerable: true, get: function () { return ProviderErrors_1.ProviderRateLimitError; } });
//# sourceMappingURL=index.js.map