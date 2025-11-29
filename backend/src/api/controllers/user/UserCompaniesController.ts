import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class UserCompaniesController {
  static async listUserCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.uid;
      const companies = await diContainer.companyRepository.getUserCompanies(userId);
      const data = await Promise.all(
        companies.map(async (c) => {
          const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, c.id);
          return {
            id: c.id,
            name: c.name,
            baseCurrency: c.baseCurrency,
            model: c.modules?.[0],
            roleId: membership?.roleId || 'MEMBER',
            isOwner: membership?.isOwner || false,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          };
        })
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async switchCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.uid;
      const { companyId } = req.body;
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(userId, companyId);
      if (!membership) throw new Error('Not a member of this company');
      await diContainer.userRepository.updateActiveCompany(userId, companyId);
      res.json({ success: true, activeCompanyId: companyId });
    } catch (err) {
      next(err);
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
      res.json({
        success: true,
        data: {
          activeCompanyId,
          company,
          roleId: membership?.roleId || null,
          isOwner: membership?.isOwner || false,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
