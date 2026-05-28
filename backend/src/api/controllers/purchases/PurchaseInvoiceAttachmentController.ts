import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import admin from '../../../firebaseAdmin';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const getBucket = () => {
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    (admin.app().options as any)?.storageBucket ||
    'dev-null-bucket';
  return admin.storage().bucket(bucketName);
};

const safeFileName = (input: string): string =>
  String(input || 'attachment')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);

export class PurchaseInvoiceAttachmentController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) throw new Error('Company context not found');
    return companyId;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseInvoiceAttachmentController.getCompanyId(req);
      const invoiceId = String((req as any).params.id);
      const invoice = await diContainer.purchaseInvoiceRepository.getById(companyId, invoiceId);
      if (!invoice) {
        return (res as any).status(404).json({ success: false, error: 'Purchase invoice not found' });
      }
      return (res as any).json({ success: true, data: invoice.attachments || [] });
    } catch (error) {
      next(error);
    }
  }

  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseInvoiceAttachmentController.getCompanyId(req);
      const userId = PurchaseInvoiceAttachmentController.getUserId(req);
      const invoiceId = String((req as any).params.id);
      const file = (req as any).file as any;
      if (!file) {
        return (res as any).status(400).json({ success: false, error: 'file is required' });
      }
      if (file.size > MAX_SIZE) {
        return (res as any).status(400).json({ success: false, error: 'File too large' });
      }
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return (res as any).status(400).json({ success: false, error: 'Unsupported file type' });
      }

      const invoice = await diContainer.purchaseInvoiceRepository.getById(companyId, invoiceId);
      if (!invoice) {
        return (res as any).status(404).json({ success: false, error: 'Purchase invoice not found' });
      }

      const attachments = invoice.attachments || [];
      if (attachments.length >= MAX_FILES) {
        return (res as any).status(400).json({ success: false, error: 'Attachment limit reached' });
      }

      const bucket = getBucket();
      const sanitizedName = safeFileName(file.originalname);
      const path = `companies/${companyId}/purchases/invoices/${invoiceId}/attachments/${Date.now()}_${sanitizedName}`;
      const blob = bucket.file(path);
      await blob.save(file.buffer, { contentType: file.mimetype, resumable: false });

      const attachment = {
        id: `pia_${randomUUID()}`,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        path,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
      };

      invoice.attachments = [...attachments, attachment];
      invoice.updatedAt = new Date();
      await diContainer.purchaseInvoiceRepository.update(invoice);
      return (res as any).status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  }

  static async getDownloadLink(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseInvoiceAttachmentController.getCompanyId(req);
      const invoiceId = String((req as any).params.id);
      const attachmentId = String((req as any).params.aid);

      const invoice = await diContainer.purchaseInvoiceRepository.getById(companyId, invoiceId);
      if (!invoice) {
        return (res as any).status(404).json({ success: false, error: 'Purchase invoice not found' });
      }

      const attachment = (invoice.attachments || []).find((entry) => entry.id === attachmentId);
      if (!attachment) {
        return (res as any).status(404).json({ success: false, error: 'Attachment not found' });
      }

      const bucket = getBucket();
      const [url] = await bucket.file(attachment.path).getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
      });

      return (res as any).json({ success: true, data: { url } });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseInvoiceAttachmentController.getCompanyId(req);
      const invoiceId = String((req as any).params.id);
      const attachmentId = String((req as any).params.aid);

      const invoice = await diContainer.purchaseInvoiceRepository.getById(companyId, invoiceId);
      if (!invoice) {
        return (res as any).status(404).json({ success: false, error: 'Purchase invoice not found' });
      }

      const attachments = invoice.attachments || [];
      const target = attachments.find((entry) => entry.id === attachmentId);
      if (!target) {
        return (res as any).status(404).json({ success: false, error: 'Attachment not found' });
      }

      const bucket = getBucket();
      await bucket.file(target.path).delete().catch(() => {});

      invoice.attachments = attachments.filter((entry) => entry.id !== attachmentId);
      invoice.updatedAt = new Date();
      await diContainer.purchaseInvoiceRepository.update(invoice);
      return (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
