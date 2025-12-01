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
exports.createCompanyController = void 0;
const CreateCompany_1 = require("../../application/core/use-cases/CreateCompany");
const FirestoreCompanyRepository_1 = require("../../infrastructure/firestore/repositories/FirestoreCompanyRepository");
const admin = __importStar(require("firebase-admin"));
// In a real app, Dependency Injection container would handle this
const db = admin.firestore();
const repo = new FirestoreCompanyRepository_1.FirestoreCompanyRepository(db);
const createCompanyUseCase = new CreateCompany_1.CreateCompanyUseCase(repo);
const createCompanyController = async (req, res) => {
    try {
        const { name, taxId, address } = req.body;
        if (!name || !taxId) {
            res.status(400).json({ success: false, error: 'Missing required fields' });
            return;
        }
        const company = await createCompanyUseCase.execute({ name, taxId, address });
        res.status(201).json({
            success: true,
            data: company,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};
exports.createCompanyController = createCompanyController;
//# sourceMappingURL=CompanyController.js.map