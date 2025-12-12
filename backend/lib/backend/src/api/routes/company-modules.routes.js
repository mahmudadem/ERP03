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
const express_1 = require("express");
const admin = __importStar(require("firebase-admin"));
const CompanyModulesController_1 = require("../controllers/company/CompanyModulesController");
const FirestoreCompanyModuleRepository_1 = require("../../infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const companyContextMiddleware_1 = require("../middlewares/companyContextMiddleware");
const router = (0, express_1.Router)();
const companyModuleRepo = new FirestoreCompanyModuleRepository_1.FirestoreCompanyModuleRepository(admin.firestore());
const controller = new CompanyModulesController_1.CompanyModulesController(companyModuleRepo);
/**
 * All routes require authentication and company access
 */
// List all modules for a company
router.get('/:companyId', authMiddleware_1.authMiddleware, companyContextMiddleware_1.companyContextMiddleware, (req, res) => controller.listModules(req, res));
// Get specific module details
router.get('/:companyId/:moduleCode', authMiddleware_1.authMiddleware, companyContextMiddleware_1.companyContextMiddleware, (req, res) => controller.getModule(req, res));
// Initialize a module (mark as complete)
router.patch('/:companyId/:moduleCode/initialize', authMiddleware_1.authMiddleware, companyContextMiddleware_1.companyContextMiddleware, (req, res) => controller.initializeModule(req, res));
// Start initialization (mark as in-progress)
router.post('/:companyId/:moduleCode/start-initialization', authMiddleware_1.authMiddleware, companyContextMiddleware_1.companyContextMiddleware, (req, res) => controller.startInitialization(req, res));
exports.default = router;
//# sourceMappingURL=company-modules.routes.js.map