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
        resultsMap.set(c.id, {
          id: c.id,
          name: c.name,
          baseCurrency: c.baseCurrency,
          model: c.modules?.[0],
          roleId: m.roleId || 'MEMBER',
          isOwner: !!m.isOwner,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
      }

      // From ownership (if not already included)
      for (const c of ownedCompanies) {
        if (resultsMap.has(c.id)) continue;
        resultsMap.set(c.id, {
          id: c.id,
          name: c.name,
          baseCurrency: c.baseCurrency,
          model: c.modules?.[0],
          roleId: 'OWNER',
          isOwner: true,
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
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
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
      return res.json({
        success: true,
        data: {
          activeCompanyId,
          company,
          roleId: membership?.roleId || null,
          isOwner: membership?.isOwner || false,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
}
