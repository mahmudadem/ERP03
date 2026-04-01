import { Request, Response, NextFunction } from 'express';
import { PartyRole } from '../../../domain/shared/entities/Party';
import { TaxScope } from '../../../domain/shared/entities/TaxCode';
import {
  CreatePartyUseCase,
  GetPartyUseCase,
  ListPartiesUseCase,
  UpdatePartyUseCase,
} from '../../../application/shared/use-cases/PartyUseCases';
import {
  CreateTaxCodeUseCase,
  GetTaxCodeUseCase,
  ListTaxCodesUseCase,
  UpdateTaxCodeUseCase,
} from '../../../application/shared/use-cases/TaxCodeUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

const PARTY_ROLES: PartyRole[] = ['VENDOR', 'CUSTOMER'];
const TAX_SCOPES: TaxScope[] = ['PURCHASE', 'SALES', 'BOTH'];

export class SharedController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }

    return companyId;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  private static toBoolean(value: any): boolean | undefined {
    if (value === undefined) return undefined;
    return String(value) === 'true';
  }

  private static toPartyRole(value: any): PartyRole | undefined {
    if (!value) return undefined;
    const role = String(value).toUpperCase() as PartyRole;
    if (!PARTY_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${value}`);
    }
    return role;
  }

  private static toTaxScope(value: any): TaxScope | undefined {
    if (!value) return undefined;
    const scope = String(value).toUpperCase() as TaxScope;
    if (!TAX_SCOPES.includes(scope)) {
      throw new Error(`Invalid scope: ${value}`);
    }
    return scope;
  }

  static async createParty(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const userId = SharedController.getUserId(req);
      const useCase = new CreatePartyUseCase(diContainer.partyRepository, diContainer.companyCurrencyRepository);
      const party = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: party.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateParty(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new UpdatePartyUseCase(diContainer.partyRepository, diContainer.companyCurrencyRepository);
      const party = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });

      (res as any).json({
        success: true,
        data: party.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getParty(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new GetPartyUseCase(diContainer.partyRepository);
      const party = await useCase.execute(companyId, (req as any).params.id);

      (res as any).json({
        success: true,
        data: party.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listParties(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new ListPartiesUseCase(diContainer.partyRepository);
      const parties = await useCase.execute(companyId, {
        role: SharedController.toPartyRole((req as any).query.role),
        active: SharedController.toBoolean((req as any).query.active),
        search: (req as any).query.search ? String((req as any).query.search) : undefined,
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: parties.map((party) => party.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTaxCode(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const userId = SharedController.getUserId(req);
      const useCase = new CreateTaxCodeUseCase(diContainer.taxCodeRepository, diContainer.accountRepository);
      const taxCode = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: taxCode.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTaxCode(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new UpdateTaxCodeUseCase(diContainer.taxCodeRepository);
      const taxCode = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });

      (res as any).json({
        success: true,
        data: taxCode.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTaxCode(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new GetTaxCodeUseCase(diContainer.taxCodeRepository);
      const taxCode = await useCase.execute(companyId, (req as any).params.id);

      (res as any).json({
        success: true,
        data: taxCode.toJSON(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listTaxCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SharedController.getCompanyId(req);
      const useCase = new ListTaxCodesUseCase(diContainer.taxCodeRepository);
      const taxCodes = await useCase.execute(companyId, {
        scope: SharedController.toTaxScope((req as any).query.scope),
        active: SharedController.toBoolean((req as any).query.active),
        limit: (req as any).query.limit ? Number((req as any).query.limit) : undefined,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : undefined,
      });

      (res as any).json({
        success: true,
        data: taxCodes.map((taxCode) => taxCode.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }
}
