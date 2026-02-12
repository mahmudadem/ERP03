"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentController = void 0;
const firebaseAdmin_1 = __importDefault(require("../../../firebaseAdmin"));
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
const bucket = firebaseAdmin_1.default.storage().bucket();
const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
class AttachmentController {
    static async list(req, res, next) {
        var _a, _b, _c;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const voucherId = req.params.id;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
            const voucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, voucherId);
            const attachments = ((_c = voucher === null || voucher === void 0 ? void 0 : voucher.metadata) === null || _c === void 0 ? void 0 : _c.attachments) || [];
            res.status(200).json({ success: true, data: attachments });
        }
        catch (error) {
            next(error);
        }
    }
    static async upload(req, res, next) {
        var _a, _b, _c;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const voucherId = req.params.id;
            const file = req.file;
            if (!file)
                return res.status(400).json({ error: 'file is required' });
            if (file.size > MAX_SIZE)
                return res.status(400).json({ error: 'File too large' });
            if (!ALLOWED_TYPES.includes(file.mimetype))
                return res.status(400).json({ error: 'Unsupported file type' });
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
            const voucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, voucherId);
            if (!voucher)
                return res.status(404).json({ error: 'Voucher not found' });
            const existing = ((_c = voucher.metadata) === null || _c === void 0 ? void 0 : _c.attachments) || [];
            if (existing.length >= MAX_FILES)
                return res.status(400).json({ error: 'Attachment limit reached' });
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
            const metadata = Object.assign(Object.assign({}, voucher.metadata), { attachments: [...existing, attachment] });
            const updatedVoucher = new VoucherEntity_1.VoucherEntity(voucher.id, voucher.companyId, voucher.voucherNo, voucher.type, voucher.date, voucher.description, voucher.currency, voucher.baseCurrency, voucher.exchangeRate, voucher.lines, voucher.totalDebit, voucher.totalCredit, voucher.status, metadata, voucher.createdBy, voucher.createdAt, voucher.approvedBy, voucher.approvedAt, voucher.rejectedBy, voucher.rejectedAt, voucher.rejectionReason, voucher.lockedBy, voucher.lockedAt, voucher.postedBy, voucher.postedAt, voucher.postingLockPolicy, voucher.reversalOfVoucherId, voucher.reference, voucher.updatedAt);
            await bindRepositories_1.diContainer.voucherRepository.save(updatedVoucher);
            res.status(201).json({ success: true, data: attachment });
        }
        catch (error) {
            next(error);
        }
    }
    static async download(req, res, next) {
        var _a, _b, _c, _d;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const voucherId = req.params.id;
            const attachmentId = req.params.aid;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
            const voucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, voucherId);
            const attachment = (_d = (_c = voucher === null || voucher === void 0 ? void 0 : voucher.metadata) === null || _c === void 0 ? void 0 : _c.attachments) === null || _d === void 0 ? void 0 : _d.find((a) => a.id === attachmentId);
            if (!attachment)
                return res.status(404).json({ error: 'Attachment not found' });
            const file = bucket.file(attachment.path);
            const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
            res.redirect(url);
        }
        catch (error) {
            next(error);
        }
    }
    static async remove(req, res, next) {
        var _a, _b, _c;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const voucherId = req.params.id;
            const attachmentId = req.params.aid;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
            const voucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, voucherId);
            if (!voucher)
                return res.status(404).json({ error: 'Voucher not found' });
            const attachments = ((_c = voucher.metadata) === null || _c === void 0 ? void 0 : _c.attachments) || [];
            const target = attachments.find((a) => a.id === attachmentId);
            if (!target)
                return res.status(404).json({ error: 'Attachment not found' });
            await bucket.file(target.path).delete().catch(() => { });
            const updatedList = attachments.filter((a) => a.id !== attachmentId);
            const metadata = Object.assign(Object.assign({}, voucher.metadata), { attachments: updatedList });
            const updatedVoucher = new VoucherEntity_1.VoucherEntity(voucher.id, voucher.companyId, voucher.voucherNo, voucher.type, voucher.date, voucher.description, voucher.currency, voucher.baseCurrency, voucher.exchangeRate, voucher.lines, voucher.totalDebit, voucher.totalCredit, voucher.status, metadata, voucher.createdBy, voucher.createdAt, voucher.approvedBy, voucher.approvedAt, voucher.rejectedBy, voucher.rejectedAt, voucher.rejectionReason, voucher.lockedBy, voucher.lockedAt, voucher.postedBy, voucher.postedAt, voucher.postingLockPolicy, voucher.reversalOfVoucherId, voucher.reference, voucher.updatedAt);
            await bindRepositories_1.diContainer.voucherRepository.save(updatedVoucher);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AttachmentController = AttachmentController;
//# sourceMappingURL=AttachmentController.js.map