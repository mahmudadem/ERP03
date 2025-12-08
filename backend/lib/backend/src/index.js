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
// Register modules before the server (and tenant router) are loaded
(0, modules_1.registerAllModules)();
ModuleRegistry_1.ModuleRegistry.getInstance().initializeAll().catch(() => { });
// Load the server after modules are registered so tenant router can mount them
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('./api/server').default;
exports.api = functions.https.onRequest(server);
exports.accountingModule = {};
//# sourceMappingURL=index.js.map