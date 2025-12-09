"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./envConfig");
const express_1 = __importDefault(require("express"));
require("../firebaseAdmin");
const modules_1 = require("../modules");
const ModuleRegistry_1 = require("../application/platform/ModuleRegistry");
// Register modules before loading server
(0, modules_1.registerAllModules)();
ModuleRegistry_1.ModuleRegistry.getInstance().initializeAll().catch(console.error);
const server_1 = __importDefault(require("../api/server"));
const app = (0, express_1.default)();
// Mount the server under the Firebase Functions path to match frontend config
const MOUNT_PATH = '/erp-03/us-central1/api';
app.use(MOUNT_PATH, server_1.default);
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Mounted at http://localhost:${PORT}${MOUNT_PATH}`);
});
//# sourceMappingURL=runServer.js.map