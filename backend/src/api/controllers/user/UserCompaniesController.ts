import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class UserCompaniesController {
  static async listUserCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.uid;
      // Fetch memberships across all companies (owner or member)
      const memberships = await diContainer.rbacCompanyUserRepository.getMembershipsByUser(userId);

      // Also fetch companies where this user is the owner (in case membership doc is missing)
      const ownedCompanies = await diContainer.companyRepository.getUserCompanies(userId);

      const resultsMap = new Map<string, any>();

      // From memberships
      for (const m of memberships) {
        const c = await diContainer.companyRepository.findById(m.companyId);
        if (!c) continue;

        // Resolve Base Currency from Shared Currencies (Tier 2)
        let baseCurrency = c.baseCurrency; 
        try {
          const currencies = await diContainer.companyCurrencyRepository.findEnabledByCompany(c.id);
          const baseRec = currencies.find(curr => curr.isBase);
          if (baseRec) baseCurrency = baseRec.currencyCode;
        } catch (e) {}

        resultsMap.set(c.id, {
          id: c.id,
          name: c.name,
          baseCurrency: baseCurrency,
          model: c.modules?.[0],
          roleId: m.roleId || 'MEMBER',
          isOwner: !!m.isOwner,
          logoUrl: c.logoUrl,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
      }

      // From ownership (if not already included)
      for (const c of ownedCompanies) {
        if (resultsMap.has(c.id)) continue;

        // Resolve Base Currency from Shared Currencies (Tier 2)
        let baseCurrency = c.baseCurrency; 
        try {
          const currencies = await diContainer.companyCurrencyRepository.findEnabledByCompany(c.id);
          const baseRec = currencies.find(curr => curr.isBase);
          if (baseRec) baseCurrency = baseRec.currencyCode;
        } catch (e) {}

        resultsMap.set(c.id, {
          id: c.id,
          name: c.name,
          baseCurrency: baseCurrency,
          roleId: 'OWNER',
          isOwner: true,
          logoUrl: c.logoUrl,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
      }

      const data = Array.from(resultsMap.values());
      return res.json({ success: true, data });
    } catch (err) {
      return next(err);
    }
  }

  static async switchCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.uid;
      const { companyId } = req.body;
      
      let membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
      
      if (!membership) {
        // Fallback: Check if user is the stored Owner of the company
        const company = await diContainer.companyRepository.findById(companyId);
        if (company && company.ownerId === userId) {
             // He's the owner but membership record is missing (likely partial failure during creation)
             // Auto-repair: Create the OWNER membership
             console.warn(`Auto-repairing missing OWNER membership for user ${userId} in company ${companyId}`);
             await diContainer.rbacCompanyUserRepository.assignRole({
                 companyId: companyId,
                 userId: userId,
                 roleId: 'OWNER',
                 isOwner: true,
                 createdAt: new Date()
             });
             // Re-fetch
             membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
        }
      }

      if (!membership) throw new Error('Not a member of this company');
      await diContainer.userRepository.updateActiveCompany(userId, companyId);
      return res.json({ success: true, activeCompanyId: companyId });
    } catch (err) {
      return next(err);
    }
  }

  static async getActiveCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.uid;
      const activeCompanyId = await diContainer.userRepository.getUserActiveCompany(userId);
      if (!activeCompanyId) {
        return res.json({ success: true, data: { activeCompanyId: null } });
      }
      const company = await diContainer.companyRepository.findById(activeCompanyId);
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, activeCompanyId);
      
      // Resolve Base Currency from Shared Currencies (Tier 2)
      let baseCurrency = company?.baseCurrency; // Fallback
      try {
        const currencies = await diContainer.companyCurrencyRepository.findEnabledByCompany(activeCompanyId);
        const baseRec = currencies.find(c => c.isBase);
        if (baseRec) baseCurrency = baseRec.currencyCode;
      } catch (e) {
        console.warn('Failed to fetch base currency from collection:', e);
      }

      return res.json({
        success: true,
        data: {
          activeCompanyId,
          company: company ? {
            id: company.id,
            name: company.name,
            baseCurrency: baseCurrency, 
            fiscalYearStart: company.fiscalYearStart,
            logoUrl: company.logoUrl,
            modules: company.modules,
          } : null,
          roleId: membership?.roleId || null,
          isOwner: membership?.isOwner || false,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
}
