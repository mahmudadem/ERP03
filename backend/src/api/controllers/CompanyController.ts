import * as express from 'express';
import { CreateCompanyUseCase } from '../../application/core/use-cases/CreateCompany';
import { diContainer } from '../../infrastructure/di/bindRepositories';

export const createCompanyController = async (req: express.Request, res: express.Response) => {
  try {
    const { name, taxId, address } = (req as any).body;

    if (!name || !taxId) {
       (res as any).status(400).json({ success: false, error: 'Missing required fields' });
       return;
    }

    // Resolve the repository through DI so the correct backend is used per DB_TYPE
    // (Prisma/Postgres in SQL mode, Firestore in Firebase mode). Previously this
    // controller hardwired FirestoreCompanyRepository, so in SQL mode it wrote
    // companies to Firestore instead of Postgres.
    const createCompanyUseCase = new CreateCompanyUseCase(diContainer.companyRepository);
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
