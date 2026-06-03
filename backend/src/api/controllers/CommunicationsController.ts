import { NextFunction, Request, Response } from 'express';
import { GetCommunicationsSettingsUseCase, UpdateCommunicationsSettingsUseCase } from '../../application/communications/CommunicationsSettingsUseCases';
import { diContainer } from '../../infrastructure/di/bindRepositories';

function getCompanyId(req: Request): string {
  const id = (req as any).companyId || (req as any).user?.companyId;
  if (!id) throw new Error('Company context not found');
  return id;
}

function toClientAccount(a: any) {
  return {
    id: a.id,
    channel: a.channel,
    provider: a.provider,
    label: a.label,
    isDefault: a.isDefault,
    isActive: a.isActive,
    phoneNumberE164: a.phoneNumberE164,
    phoneNumberId: a.phoneNumberId,
    fromAddress: a.fromAddress,
    fromDisplayName: a.fromDisplayName,
    botUsername: a.botUsername,
    apiVersion: a.apiVersion,
    hasCredential: !!a.encryptedCredential,
  };
}

export class CommunicationsController {
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const useCase = new GetCommunicationsSettingsUseCase(diContainer.communicationsSettingsRepository);
      const settings = await useCase.execute(companyId);
      (res as any).json({
        success: true,
        data: {
          companyId: settings.companyId,
          messagingAccounts: settings.messagingAccounts.map(toClientAccount),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = getCompanyId(req);
      const body = (req as any).body || {};
      const accounts = Array.isArray(body.messagingAccounts) ? body.messagingAccounts : [];
      const useCase = new UpdateCommunicationsSettingsUseCase(
        diContainer.communicationsSettingsRepository,
        diContainer.encryptionService
      );
      const settings = await useCase.execute({ companyId, messagingAccounts: accounts });
      (res as any).json({
        success: true,
        data: {
          companyId: settings.companyId,
          messagingAccounts: settings.messagingAccounts.map(toClientAccount),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
