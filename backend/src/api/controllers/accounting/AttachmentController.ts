import { Request, Response, NextFunction } from 'express';
import admin from '../../../firebaseAdmin';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

/**
 * Lazily resolve the storage bucket to avoid crashing the app at import-time
 * when storageBucket is not configured (e.g., during local emulation without
 * attachments features enabled).
 */
const getBucket = () => {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (admin.app().options as any)?.storageBucket;

  if (!bucketName) {
    throw new Error(
      'Storage bucket not configured. Set FIREBASE_STORAGE_BUCKET or storageBucket in Firebase config.'
    );
  }

  return admin.storage().bucket(bucketName);
};

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export class AttachmentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const voucherId = req.params.id;
      await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
      const voucher = await diContainer.voucherRepository.findById(companyId, voucherId);
      const attachments = voucher?.metadata?.attachments || [];
      res.status(200).json({ success: true, data: attachments });
    } catch (error) {
      next(error);
    }
  }

  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const voucherId = req.params.id;
      const file = (req as any).file as any;
      if (!file) return res.status(400).json({ error: 'file is required' });

      if (file.size > MAX_SIZE) return res.status(400).json({ error: 'File too large' });
      if (!ALLOWED_TYPES.includes(file.mimetype)) return res.status(400).json({ error: 'Unsupported file type' });

      await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
      const voucher = await diContainer.voucherRepository.findById(companyId, voucherId);
      if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

      const existing = voucher.metadata?.attachments || [];
      if (existing.length >= MAX_FILES) return res.status(400).json({ error: 'Attachment limit reached' });

      const bucket = getBucket();
      const path = `companies/${companyId}/vouchers/${voucherId}/attachments/${Date.now()}_${file.originalname}`;
      const blob = bucket.file(path);
      await blob.save(file.buffer, { contentType: file.mimetype, resumable: false });

      const attachment = {
        id: Date.now().toString(),
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId
      };
      const metadata = {
        ...voucher.metadata,
        attachments: [...existing, attachment]
      };
      const updatedVoucher = new VoucherEntity(
        voucher.id,
        voucher.companyId,
        voucher.voucherNo,
        voucher.type,
        voucher.date,
        voucher.description,
        voucher.currency,
        voucher.baseCurrency,
        voucher.exchangeRate,
        voucher.lines,
        voucher.totalDebit,
        voucher.totalCredit,
        voucher.status,
        metadata,
        voucher.createdBy,
        voucher.createdAt,
        voucher.approvedBy,
        voucher.approvedAt,
        voucher.rejectedBy,
        voucher.rejectedAt,
        voucher.rejectionReason,
        voucher.lockedBy,
        voucher.lockedAt,
        voucher.postedBy,
        voucher.postedAt,
        (voucher as any).postingLockPolicy,
        (voucher as any).reversalOfVoucherId,
        (voucher as any).reference,
        (voucher as any).updatedAt
      );
      await diContainer.voucherRepository.save(updatedVoucher);
      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const voucherId = req.params.id;
      const attachmentId = req.params.aid;
      await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
      const voucher = await diContainer.voucherRepository.findById(companyId, voucherId);
      const attachment = voucher?.metadata?.attachments?.find((a: any) => a.id === attachmentId);
      if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
      const bucket = getBucket();
      const file = bucket.file(attachment.path);
      const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const voucherId = req.params.id;
      const attachmentId = req.params.aid;
      await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
      const voucher = await diContainer.voucherRepository.findById(companyId, voucherId);
      if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
      const attachments = voucher.metadata?.attachments || [];
      const target = attachments.find((a: any) => a.id === attachmentId);
      if (!target) return res.status(404).json({ error: 'Attachment not found' });
      const bucket = getBucket();
      await bucket.file(target.path).delete().catch(() => {});
      const updatedList = attachments.filter((a: any) => a.id !== attachmentId);
      const metadata = { ...voucher.metadata, attachments: updatedList };
      const updatedVoucher = new VoucherEntity(
        voucher.id,
        voucher.companyId,
        voucher.voucherNo,
        voucher.type,
        voucher.date,
        voucher.description,
        voucher.currency,
        voucher.baseCurrency,
        voucher.exchangeRate,
        voucher.lines,
        voucher.totalDebit,
        voucher.totalCredit,
        voucher.status,
        metadata,
        voucher.createdBy,
        voucher.createdAt,
        voucher.approvedBy,
        voucher.approvedAt,
        voucher.rejectedBy,
        voucher.rejectedAt,
        voucher.rejectionReason,
        voucher.lockedBy,
        voucher.lockedAt,
        voucher.postedBy,
        voucher.postedAt,
        (voucher as any).postingLockPolicy,
        (voucher as any).reversalOfVoucherId,
        (voucher as any).reference,
        (voucher as any).updatedAt
      );
      await diContainer.voucherRepository.save(updatedVoucher);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
