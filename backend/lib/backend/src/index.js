"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingModule = exports.api = void 0;
require("./firebaseAdmin");
const functions = __importStar(require("firebase-functions"));
const modules_1 = require("./modules");
const ModuleRegistry_1 = require("./application/platform/ModuleRegistry");
const moduleStartupValidation_1 = require("./modules/moduleStartupValidation");
let server = null;
let serverReady = false;
async function initServer() {
    (0, modules_1.registerAllModules)();
    await ModuleRegistry_1.ModuleRegistry.getInstance().initializeAll();
    await (0, moduleStartupValidation_1.runModuleStartupValidation)();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    server = require('./api/server').default;
    serverReady = true;
}
initServer().catch((error) => {
    console.error('Failed to initialize server:', error);
});
exports.api = functions.https.onRequest(async (req, res) => {
    if (!serverReady || !server) {
        // Add CORS headers manually since the Express app (which has the cors middleware) is not ready yet
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-company-id');
        // If it's a preflight request, return 204
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        res.status(503).json({ success: false, error: 'Server not ready, please retry' });
        return;
    }
    server(req, res);
});
exports.accountingModule = {};
//# sourceMappingURL=index.js.map