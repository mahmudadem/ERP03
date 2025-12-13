"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SystemMetadataController_1 = require("../controllers/system/SystemMetadataController");
const router = express_1.default.Router();
/**
 * System metadata routes - PUBLIC (no auth required)
 * Used for fetching system-wide data like currencies, templates, etc.
 */
// GET /api/v1/system/metadata/currencies
router.get('/currencies', SystemMetadataController_1.SystemMetadataController.getCurrencies);
//GET /api/v1/system/metadata/coa-templates
router.get('/coa-templates', SystemMetadataController_1.SystemMetadataController.getCoaTemplates);
exports.default = router;
//# sourceMappingURL=system.metadata.routes.js.map