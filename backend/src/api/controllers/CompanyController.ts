import * as express from 'express';
import { CreateCompanyUseCase } from '../../application/core/use-cases/CreateCompany';
import { FirestoreCompanyRepository } from '../../infrastructure/firestore/repositories/FirestoreCompanyRepository';
import admin from '../../firebaseAdmin';

// In a real app, Dependency Injection container would handle this
const db = admin.firestore();
const repo = new FirestoreCompanyRepository(db);
const createCompanyUseCase = new CreateCompanyUseCase(repo);

export const createCompanyController = async (req: express.Request, res: express.Response) => {
  try {
    const { name, taxId, address } = (req as any).body;
    
    if (!name || !taxId) {
       (res as any).status(400).json({ success: false, error: 'Missing required fields' });
       return;
    }

    const company = await createCompanyUseCase.execute({ name, taxId, address });
    
    (res as any).status(201).json({
      success: true,
      data: company,
    });
  } catch (error: any) {
    (res as any).status(500).json({
      success: false,
      error: error.message,
    });
  }
};
