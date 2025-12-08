"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompanyController = void 0;
const CreateCompany_1 = require("../../application/core/use-cases/CreateCompany");
const FirestoreCompanyRepository_1 = require("../../infrastructure/firestore/repositories/FirestoreCompanyRepository");
const firebaseAdmin_1 = __importDefault(require("../../firebaseAdmin"));
// In a real app, Dependency Injection container would handle this
const db = firebaseAdmin_1.default.firestore();
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