import './firebaseAdmin';
import * as functions from 'firebase-functions';
import { registerAllModules } from './modules';
import { ModuleRegistry } from './application/platform/ModuleRegistry';

// Register modules before the server (and tenant router) are loaded
registerAllModules();
ModuleRegistry.getInstance().initializeAll().catch(() => {});

// Load the server after modules are registered so tenant router can mount them
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('./api/server').default;

export const api = functions.https.onRequest(server as any);
export const accountingModule = {};
