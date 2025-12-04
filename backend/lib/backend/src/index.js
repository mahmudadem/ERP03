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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingModule = exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const server_1 = __importDefault(require("./api/server"));
const modules_1 = require("./modules");
const ModuleRegistry_1 = require("./application/platform/ModuleRegistry");
// Initialize Admin SDK if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
// Register all modules
(0, modules_1.registerAllModules)();
// Initialize modules
ModuleRegistry_1.ModuleRegistry.getInstance().initializeAll().catch(console.error);
// Expose the Express App as a Cloud Function
exports.api = functions.https.onRequest(server_1.default);
// Exports for other modules (Background triggers can be added here)
exports.accountingModule = {};
//# sourceMappingURL=index.js.map