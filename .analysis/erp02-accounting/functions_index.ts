import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { financialTemplateSeeds } from "./data/financialTemplates.seed";
import { getImpactedUsersFromVoucher, sendVoucherImpactNotifications, ChangeType } from "./utils/notifications";

// Initialize default app once. Never create/delete apps inside functions.
admin.initializeApp();
const auth = getAuth();
const db = getFirestore();

// -------------------------------
// Types
// -------------------------------
functions.logger.info('deploy-version-2025-11-13');
type CompanyRole = "Owner" | "Admin" | "Manager" | "Accountant" | "User";

interface CompanyUserMembership {
  uid: string;
  role: CompanyRole;
  status?: "active" | "inactive";
  joinedAt?: FirebaseFirestore.FieldValue;
  updatedAt?: FirebaseFirestore.FieldValue;
}

interface GlobalUserProfileUpdate {
  name?: string;
  email?: string;
  code?: string;
  phone?: string;
  address?: string;
}

enum VoucherStatus {
  DRAFT = "draft",
  PENDING = "pending",
  APPROVED = "approved",
  LOCKED = "locked",
  CANCELED = "canceled",
}

interface VoucherLineItem {
  id: number;
  accountId: string | null;
  type: "Debit" | "Credit";
  amount: number;
  costCenterId?: string;
  notes?: string;
  fxAmount?: number;
}

interface FinancialVoucher {
  id: string;
  voucherNo?: string | null;
  number?: string | null;
  date: string;
  description: string;
  companyName?: string;
  type: string;
  status: VoucherStatus;
  createdBy?: string | null;
  createdAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  submittedBy?: string | null;
  submittedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  approvedBy?: string | null;
  approvedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  lockedBy?: string | null;
  lockedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  statusReason?: string | null;
  totalDebit?: number;
  totalCredit?: number;
  lines: VoucherLineItem[];
  currency: string;
  auditLog?: {
    createdBy: string;
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
    lastEditedBy?: string;
    lastEditedAt?: string;
  };
  [key: string]: any;
}

type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

// -------------------------------
// Helpers
// -------------------------------

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  return context.auth.uid;
}

async function isSuperAdmin(uid: string): Promise<boolean> {
  const user = await auth.getUser(uid);
  return (user.customClaims || {})["role"] === "SUPER_ADMIN";
}

async function assertSuperAdmin(context: functions.https.CallableContext): Promise<void> {
  const uid = requireAuth(context);
  const ok = await isSuperAdmin(uid);
  if (!ok) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This action requires SUPER_ADMIN privileges."
    );
  }
}

export async function assertCompanyRole(
  context: functions.https.CallableContext,
  companyId: string,
  allowed: CompanyRole[]
): Promise<{ uid: string; role: CompanyRole }>
{
  const uid = requireAuth(context);
  if (!companyId || typeof companyId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid companyId is required.");
  }
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new functions.https.HttpsError("internal", "assertCompanyRole must include allowed roles.");
  }
  const ref = db.doc(`companies/${companyId}/users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("permission-denied", "You are not a member of this company.");
  }
  const role = (snap.data()?.role || "") as CompanyRole;
  if (!allowed.includes(role)) {
    throw new functions.https.HttpsError("permission-denied", `Requires one of roles: ${allowed.join(", ")}.`);
  }
  return { uid, role };
}

function sanitizeGlobalUserProfile(input: any): GlobalUserProfileUpdate {
  const out: GlobalUserProfileUpdate = {};
  if (typeof input?.name === "string") out.name = input.name;
  if (typeof input?.email === "string") out.email = input.email;
  if (typeof input?.code === "string") out.code = input.code;
  if (typeof input?.phone === "string") out.phone = input.phone;
  if (typeof input?.address === "string") out.address = input.address;
  return out;
}

function sanitizeMembership(input: any): Pick<CompanyUserMembership, "role" | "status"> & { permissions?: Record<string, boolean> } {
  const out: any = {};
  if (typeof input?.role === "string") out.role = input.role as CompanyRole;
  if (typeof input?.status === "string") out.status = input.status;
  if (typeof input?.permissions === "object" && input.permissions) {
    out.permissions = input.permissions;
  }
  return out;
}

const extractCustodians = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data.custodians) && data.custodians.length) {
    return data.custodians.filter((id: any) => typeof id === 'string' && id);
  }
  return [];
};

const accountHasCustodianUid = (data: any, uid: string | null | undefined): boolean => {
  if (!uid) return false;
  return extractCustodians(data).includes(uid);
};

type CurrencyInput = { code?: string; name?: string; symbol?: string; exchangeRate?: number };
type RateAudit = { createdAt: string; createdBy: string; createdByName?: string };

function normalizeCurrencyCode(raw?: any): string {
  if (typeof raw !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Currency code is required.");
  }
  const code = raw.trim().toUpperCase();
  if (!code) {
    throw new functions.https.HttpsError("invalid-argument", "Currency code cannot be empty.");
  }
  return code;
}

function sanitizeCurrency(input: CurrencyInput, opts: { isBase: boolean; baseCode?: string }) {
  const code = normalizeCurrencyCode(input.code);
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : code;
  const symbol = typeof input.symbol === "string" && input.symbol.trim() ? input.symbol.trim() : code;

  let exchangeRate = opts.isBase ? 1 : undefined;
  if (!opts.isBase) {
    if (typeof input.exchangeRate !== "number" || input.exchangeRate <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Exchange rate must be a positive number.");
    }
    exchangeRate = input.exchangeRate;
  }

  if (!opts.isBase && opts.baseCode && code === opts.baseCode) {
    throw new functions.https.HttpsError("invalid-argument", "Base currency is already selected and cannot be duplicated.");
  }

  return {
    code,
    name,
    symbol,
    exchangeRate: exchangeRate as number,
    isBase: opts.isBase,
    isProtected: opts.isBase ? true : false,
  };
}

function sanitizeCompanyProfileUpdate(input: any): { name?: string | null; logoUrl?: string | null; supportEmail?: string | null; supportPhone?: string | null } {
  const out: { name?: string | null; logoUrl?: string | null; supportEmail?: string | null; supportPhone?: string | null } = {};
  if (!input || typeof input !== "object") return out;

  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    out.name = trimmed || null;
  }
  if (typeof input.logoUrl === "string") {
    const trimmed = input.logoUrl.trim();
    out.logoUrl = trimmed || null;
  }
  if (typeof input.supportEmail === "string") {
    const trimmed = input.supportEmail.trim();
    out.supportEmail = trimmed || null;
  }
  if (typeof input.supportPhone === "string") {
    const trimmed = input.supportPhone.trim();
    out.supportPhone = trimmed || null;
  }

  return out;
}

async function getOrCreateAuthUserByEmail(email: string, name?: string, password?: string): Promise<string> {
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") {
      const createReq: admin.auth.CreateRequest = { email, displayName: name } as any;
      if (typeof password === "string" && password.length >= 6) {
        (createReq as any).password = password;
      }
      const u = await auth.createUser(createReq);
      return u.uid;
    }
    throw err;
  }
}

type TemplateAccountDoc = {
  code: string;
  name: { en?: string; ar?: string; tr?: string };
  type: string;
  isParent?: boolean;
  parentCode?: string;
  exampleUsage?: { en?: string; ar?: string; tr?: string };
};

const templateAccountTypeMap: Record<string, AccountType> = {
  asset: "Asset",
  assets: "Asset",
  liability: "Liability",
  liabilities: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  income: "Revenue",
  expense: "Expense",
  expenses: "Expense",
};

const normalizeAccountType = (raw: string): AccountType => {
  const mapped = templateAccountTypeMap[(raw || "").toLowerCase()];
  return mapped || "Asset";
};

async function ensureTemplateExists(templateId: string): Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>> {
  const ref = db.doc(`financial_templates/${templateId}`);
  const snap = await ref.get();
  if (snap.exists) {
    return snap;
  }
  const seed = financialTemplateSeeds.find(t => t.id === templateId);
  if (!seed) {
    throw new functions.https.HttpsError("not-found", `Template ${templateId} was not found.`);
  }
  await ref.set(seed, { merge: true });
  return await ref.get();
}

const deriveParentCode = (code: string): string | undefined => {
  if (!code) return undefined;
  if (code.includes('.')) {
    const parts = code.split('.');
    parts.pop();
    return parts.length ? parts.join('.') : undefined;
  }
  if (code.length <= 1) return undefined;
  return code.slice(0, Math.max(1, code.length - 2));
};

const normalizeHierarchicalCode = (raw?: string | number | null): string | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;
  // accept dot-separated numeric segments only
  if (/^[0-9]+(\.[0-9]+)*$/.test(value)) {
    return value;
  }
  return undefined;
};

async function performTemplateCopy(companyId: string, templateId: string): Promise<void> {
  if (!companyId || !templateId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId and templateId are required.");
  }
  const companyRef = db.doc(`companies/${companyId}`);
  if (!(await companyRef.get()).exists) {
    throw new functions.https.HttpsError("not-found", "Company not found.");
  }
  functions.logger.info('performTemplateCopy:start', { companyId, templateId });
  const templateSnap = await ensureTemplateExists(templateId);
  const templateData = templateSnap.data() || {};
  const accounts = Array.isArray(templateData.accounts) ? (templateData.accounts as TemplateAccountDoc[]) : [];
  if (!accounts.length) return;

  const accountsCollection = companyRef.collection("accounts");
  const codeToRef = new Map<string, FirebaseFirestore.DocumentReference>();
  let batch = db.batch();
  let opCount = 0;
  const MAX_BATCH_WRITES = 400;

  const sorted = [...accounts].sort((a, b) => String(a.code).localeCompare(String(b.code)));

  for (const account of sorted) {
    const docRef = accountsCollection.doc();
    const parentCode =
      normalizeHierarchicalCode(account.parentCode) ||
      deriveParentCode(String(account.code || ''));
    const parentRef = parentCode ? codeToRef.get(parentCode) : undefined;
    batch.set(docRef, {
      code: account.code,
      name: account.name?.en || account.code,
      nameTranslations: account.name || null,
      exampleUsage: account.exampleUsage || null,
      parentId: parentRef ? parentRef.id : null,
      parentCode: parentCode || null,
      isParent: Boolean(account.isParent),
      isProtected: account.isParent ? true : Boolean((account as any).isProtected),
      is_active: true,
      current_balance: 0,
      currency: "USD",
      type: normalizeAccountType(account.type),
    });
    codeToRef.set(account.code, docRef);
    opCount++;
    if (opCount >= MAX_BATCH_WRITES) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
  functions.logger.info('performTemplateCopy:completed', { companyId, templateId, accounts: accounts.length });
}

async function backfillCompanyAccountParents(companyId: string): Promise<number> {
  const accountsSnap = await db.collection(`companies/${companyId}/accounts`).get();
  const docs = accountsSnap.docs;
  if (!docs.length) return 0;

  const trim = (value?: string) => (value ?? '').trim();
  const codeToId = new Map<string, string>();
  docs.forEach(docSnap => {
    const code = trim(docSnap.data()?.code);
    if (code) codeToId.set(code, docSnap.id);
  });

  let batch = db.batch();
  let pending = 0;
  let updated = 0;

  const flush = async () => {
    if (pending > 0) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  };

  for (const docSnap of docs) {
    const data = docSnap.data() || {};
    const code = trim(data.code);
    const currentParentId = data.parentId || null;
    let parentCode = data.parentCode ? trim(data.parentCode) : null;
    if (!parentCode) {
      const derived = deriveParentCode(code);
      parentCode = derived ? derived : null;
    }
    if (!parentCode) continue;
    const desiredParentId = codeToId.get(parentCode) || null;
    if (desiredParentId && desiredParentId !== currentParentId) {
      batch.update(docSnap.ref, { parentId: desiredParentId, parentCode });
      pending++;
      updated++;
    } else if (!desiredParentId && data.parentCode !== parentCode) {
      batch.update(docSnap.ref, { parentCode });
      pending++;
    }
    if (pending >= 400) {
      await flush();
    }
  }

  await flush();
  functions.logger.info('backfillCompanyAccountParents', { companyId, updated });
  return updated;
}

// -------------------------------
// Callable: Create Company
// -------------------------------

interface EnabledModules {
  finance: boolean;
  inventory: boolean;
  manufacturing: boolean;
}

export const createCompany = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const name: string | undefined = typeof data?.companyName === "string" ? data.companyName.trim() : undefined;
  const selectedModules: Partial<EnabledModules> = (typeof data?.selectedModules === "object" && data?.selectedModules) ? data.selectedModules : {};
  const chartTemplateId: string | undefined = typeof data?.templates?.chartOfAccounts === "string" ? data.templates.chartOfAccounts : undefined;
  const templateConfirmed: boolean | undefined = typeof data?.templateConfirmed === "boolean" ? data.templateConfirmed : undefined;
  const baseCurrencyInput: CurrencyInput = typeof data?.baseCurrency === "object" && data?.baseCurrency ? data.baseCurrency : { code: "USD", name: "US Dollar", symbol: "$" };
  const additionalCurrenciesInput: CurrencyInput[] = Array.isArray(data?.currencies) ? data.currencies : [];
  functions.logger.info('createCompany:request', { name, chartTemplateId, selectedModules });

  if (!name) {
    throw new functions.https.HttpsError("invalid-argument", "companyName is required");
  }

  const enabledModules: EnabledModules = {
    finance: Boolean(selectedModules.finance),
    inventory: Boolean(selectedModules.inventory),
    manufacturing: Boolean(selectedModules.manufacturing),
  };

  try {
    const baseCurrency = sanitizeCurrency(baseCurrencyInput, { isBase: true });
    const currencies: Array<ReturnType<typeof sanitizeCurrency>> = [baseCurrency];
    const seenCodes = new Set<string>([baseCurrency.code]);
    for (const cur of additionalCurrenciesInput) {
      const sanitized = sanitizeCurrency(cur, { isBase: false, baseCode: baseCurrency.code });
      if (seenCodes.has(sanitized.code)) {
        // Skip silent duplicate to avoid conflicts during batch set
        continue;
      }
      seenCodes.add(sanitized.code);
      currencies.push(sanitized);
    }

    // Create company
    const companyRef = await db.collection("companies").add({
      name,
      enabledModules,
      ownerUid: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    const companyId = companyRef.id;

    // Create owner's membership under the company
    const membership: CompanyUserMembership = {
      uid,
      role: "Owner",
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.doc(`companies/${companyId}/users/${uid}`).set(membership, { merge: true });

      if (enabledModules.finance) {
        const currencyWrites = currencies.map((cur) => {
          return db.doc(`companies/${companyId}/currencies/${cur.code}`).set({
            code: cur.code,
            name: cur.name,
            symbol: cur.symbol,
          exchangeRate: cur.exchangeRate,
          isBase: cur.isBase,
            isProtected: cur.isProtected,
          });
        });
        await Promise.all(currencyWrites);

        // Seed exchange rate history from base -> each additional currency
        const nowIso = new Date().toISOString();
        const rateAudit: RateAudit = { createdAt: nowIso, createdBy: uid, createdByName: 'system' };
        const rateWrites: Promise<any>[] = [];
        currencies
          .filter((c) => !c.isBase)
          .forEach((cur) => {
            const rateDoc = db.collection(`companies/${companyId}/exchange_rates`).doc();
            rateWrites.push(rateDoc.set({
              from_currency: baseCurrency.code,
              to_currency: cur.code,
              rate: cur.exchangeRate,
              date: nowIso,
              createdAt: rateAudit.createdAt,
              createdBy: rateAudit.createdBy,
              createdByName: rateAudit.createdByName,
            }));
          });
        if (rateWrites.length) {
          await Promise.all(rateWrites);
        }

        await db.doc(`companies/${companyId}/system_settings/config`).set({
          baseCurrency: baseCurrency.code,
          companyName: name,
          allowApprovedVoucherDeletion: false,
          allowReceiverEdit: false,
          strictApprovalMode: false,
          autoApproveWhenReceiverIsActing: true,
          approval: {
            autoApproveWhenReceiverIsActing: true,
          },
          notifications: {
            enabled: true,
            voucherAccountImpact: true,
            onCreate: true,
            onApprove: true,
            onReject: true,
            onEdit: true,
            onDelete: true,
            onAmountChange: true,
            onFxChange: true,
            onAccountChange: true,
          },
        }, { merge: true });

      if (chartTemplateId && chartTemplateId !== "empty") {
        if (templateConfirmed === false) {
          throw new functions.https.HttpsError("failed-precondition", "Template copy must be confirmed before proceeding.");
        }
        await performTemplateCopy(companyId, chartTemplateId);
      }
    }

    return { companyId };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to create company.");
  }
});

// -------------------------------
// Callable: Delete Currency with protection
// -------------------------------

export const deleteCompanyCurrency = functions.https.onCall(async (data, context) => {
  const { companyId, currencyId } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);

  if (!currencyId || typeof currencyId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid currencyId is required.");
  }

  const currencyRef = db.doc(`companies/${companyId}/currencies/${currencyId}`);
  const snap = await currencyRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Currency not found.");
  }
  const currency = snap.data() || {};
  if (currency.isBase || currency.isProtected) {
    throw new functions.https.HttpsError("failed-precondition", "Base currency cannot be deleted.");
  }
  const code = currency.code;
  if (!code) {
    throw new functions.https.HttpsError("internal", "Currency document is missing code.");
  }

  const settingsSnap = await db.doc(`companies/${companyId}/system_settings/config`).get();
  const configuredBase = settingsSnap.exists ? (settingsSnap.data()?.baseCurrency as string | undefined) : undefined;
  if (configuredBase && configuredBase.toUpperCase() === String(code).toUpperCase()) {
    throw new functions.https.HttpsError("failed-precondition", "Base currency cannot be deleted.");
  }

  const usedSnap = await db.collection(`companies/${companyId}/financial_vouchers`).where("currency", "==", code).limit(1).get();
  if (!usedSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", `Cannot delete ${code}; it is used in existing vouchers.`);
  }

  await currencyRef.delete();
  return { deleted: currencyId };
});

// -------------------------------
// Callable: Delete notifications for an item (e.g., todo)
// -------------------------------

export const deleteNotificationsForItem = functions.https.onCall(async (data, context) => {
  const { companyId, relatedId } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);

  if (!relatedId || typeof relatedId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid relatedId is required.");
  }

  const notificationsRef = db.collection("companies").doc(companyId).collection("notifications");
  const snap = await notificationsRef
    .where("relatedId", "==", relatedId)
    .get();

  if (snap.empty) return { deleted: 0 };

  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return { deleted: snap.size };
});

// -------------------------------
// Callable: Update Company Profile
// -------------------------------

export const updateCompanyProfile = functions.https.onCall(async (data, context) => {
  const { companyId, updates } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);

  const sanitized = sanitizeCompanyProfileUpdate(updates);
  if (sanitized.name === null) {
    throw new functions.https.HttpsError("invalid-argument", "Company name cannot be empty.");
  }

  const hasUpdates = Object.values(sanitized).some((v) => v !== undefined);
  if (!hasUpdates) {
    throw new functions.https.HttpsError("invalid-argument", "No valid fields to update.");
  }

  const payload: Record<string, any> = {
    ...sanitized,
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    await db.doc(`companies/${companyId}`).set(payload, { merge: true });
    return { companyId, updated: Object.keys(sanitized).filter((key) => (sanitized as any)[key] !== undefined) };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to update company profile.");
  }
});

// -------------------------------
// Callable: Delete Company (Owner only, confirmation required)
// -------------------------------
export const deleteCompany = functions.https.onCall(async (data, context) => {
  const { companyId } = data || {};
  const confirmation: string | undefined = typeof data?.confirmation === "string" ? data.confirmation.trim() : undefined;
  const { uid } = await assertCompanyRole(context, companyId, ["Owner"]);

  if (!companyId || typeof companyId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid companyId is required.");
  }
  if (!confirmation) {
    throw new functions.https.HttpsError("failed-precondition", "Confirmation text is required to delete the company.");
  }

  const companyRef = db.doc(`companies/${companyId}`);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    throw new functions.https.HttpsError("not-found", "Company not found.");
  }
  const companyData = companySnap.data() || {};
  const expectedName = typeof companyData.name === "string" ? companyData.name.trim() : "";

  if (companyData.ownerUid && companyData.ownerUid !== uid) {
    throw new functions.https.HttpsError("permission-denied", "Only the owner of this company can delete it.");
  }

  // Require an exact (case-insensitive) match to the current company name to reduce accidental deletions.
  if (!expectedName || expectedName.toLowerCase() !== confirmation.toLowerCase()) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Confirmation text does not match the company name. Please type the exact company name to confirm deletion."
    );
  }

  try {
    await admin.firestore().recursiveDelete(companyRef);
    // Best-effort cleanup of residual notifications referencing this company
    const notificationsSnap = await db.collection("companies").doc(companyId).collection("notifications").get();
    if (!notificationsSnap.empty) {
      const batch = db.batch();
      notificationsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    functions.logger.info("deleteCompany:completed", { companyId, by: uid });
    return { deleted: companyId };
  } catch (error: any) {
    functions.logger.error("deleteCompany:failed", { companyId, error: error?.message });
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to delete company.");
  }
});

// -------------------------------
// Callable: Company-scoped users
// -------------------------------

export const createCompanyUser = functions.https.onCall(async (data, context) => {
  const { companyId } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);

  const uid: string | undefined = typeof data?.uid === "string" ? data.uid : undefined;
  const email: string | undefined = typeof data?.email === "string" ? data.email : undefined;
  const name: string | undefined = typeof data?.name === "string" ? data.name : undefined;
  const role: CompanyRole | undefined = typeof data?.role === "string" ? data.role : undefined;
  const status: "active" | "inactive" | undefined = typeof data?.status === "string" ? data.status : undefined;
  const permissions: Record<string, boolean> | undefined = (typeof data?.permissions === "object" && data?.permissions) ? data.permissions : undefined;
  const password: string | undefined = typeof data?.password === "string" ? data.password : undefined;
  const profile = sanitizeGlobalUserProfile(data);

  if (!role) throw new functions.https.HttpsError("invalid-argument", "A valid role is required.");
  if (!uid && !email) {
    throw new functions.https.HttpsError("invalid-argument", "Either uid or email must be provided.");
  }
  if (!uid && (!password || password.length < 6)) {
    // If creating a new Auth user, require a valid password to allow sign-in
    throw new functions.https.HttpsError("invalid-argument", "weak-password: Password must be at least 6 characters.");
  }

  try {
    const resolvedUid = uid || (email ? await getOrCreateAuthUserByEmail(email, name, password) : undefined);
    if (!resolvedUid) throw new functions.https.HttpsError("internal", "Failed to resolve user UID.");

    // Update minimal global profile
    const globalRef = db.doc(`users/${resolvedUid}`);
    const globalUpdate: any = {
      name: typeof name === 'string' ? name : (profile.name || null),
      email: typeof email === 'string' ? email : (profile.email || null),
      code: profile.code || null,
      phone: profile.phone || null,
      address: profile.address || null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await globalRef.set(globalUpdate, { merge: true });

    // Ensure Auth profile has displayName and email set
    if (!uid && email) {
      await auth.updateUser(resolvedUid, { displayName: name || undefined, email });
    }

    // Create or merge company membership
    const memRef = db.doc(`companies/${companyId}/users/${resolvedUid}`);
    const memData: CompanyUserMembership & { permissions?: Record<string, boolean>; name?: string; email?: string } = {
      uid: resolvedUid,
      role,
      status: status || "active",
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (permissions) (memData as any).permissions = permissions;
    if (typeof name === 'string') (memData as any).name = name;
    if (typeof email === 'string') (memData as any).email = email;
    await memRef.set(memData, { merge: true });

    return { success: true, uid: resolvedUid };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to create company user.");
  }
});

// -------------------------------
// SuperAdmin global user helpers
// -------------------------------

export const createUserAdmin = functions.https.onCall(async (data, context) => {
  // SUPER_ADMIN only
  await assertSuperAdmin(context);

  const profile = sanitizeGlobalUserProfile(data);
  const email = profile.email;
  const name = profile.name;
  if (!email || !name) {
    throw new functions.https.HttpsError("invalid-argument", "Both name and email are required.");
  }
  try {
    const newUid = await getOrCreateAuthUserByEmail(email, name);
    await db.doc(`users/${newUid}`).set({ ...profile, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { success: true, uid: newUid };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to create global user.");
  }
});

export const updateUserAdmin = functions.https.onCall(async (data, context) => {
  // SUPER_ADMIN only
  await assertSuperAdmin(context);

  const { uid } = data || {};
  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid uid is required.");
  }
  const profile = sanitizeGlobalUserProfile(data);
  if (Object.keys(profile).length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "No fields to update.");
  }
  try {
    const writes: Promise<any>[] = [];
    const authUpdate: any = {};
    if (typeof profile.name === "string") authUpdate.displayName = profile.name;
    if (typeof profile.email === "string") authUpdate.email = profile.email;
    if (Object.keys(authUpdate).length > 0) writes.push(auth.updateUser(uid, authUpdate));
    writes.push(db.doc(`users/${uid}`).set({ ...profile, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await Promise.all(writes);
    return { success: true };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to update global user.");
  }
});

// -------------------------------
// Finance triggers (company scoped)
// -------------------------------

export const onFinanceVoucherCreate = functions.firestore
  .document("companies/{companyId}/financial_vouchers/{voucherId}")
  .onCreate(async (snap, context) => {
    const { companyId, voucherId } = context.params as { companyId: string; voucherId: string };
    const voucher = snap.data() as FinancialVoucher;
    const actingUid = inferActingUserUid(voucher, null);
    const impact = await getImpactedUsersFromVoucher({ ...voucher, companyId }, actingUid);
    console.log('[ImpactEngine] create', { companyId, voucherId, actingUid, impactedUsers: impact.impactedUsers });

    const settingsSnap = await db.doc(`companies/${companyId}/system_settings/config`).get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const payload = {
      companyId,
      voucher: { ...voucher, id: voucherId },
      actingUid,
      changeType: 'create' as ChangeType,
      settingsData,
      impactResult: impact,
    };
    await sendVoucherImpactNotifications(payload);
    return null;
  });

export const onFinanceVoucherUpdate = functions.firestore
  .document("companies/{companyId}/financial_vouchers/{voucherId}")
  .onUpdate(async (change, context) => {
    const { companyId, voucherId } = context.params as { companyId: string; voucherId: string };
    const before = change.before.data() as FinancialVoucher;
    const after = change.after.data() as FinancialVoucher;
    const beforeStatus = normalizeVoucherStatus(before.status);
    const afterStatus = normalizeVoucherStatus(after.status);

    const settingsSnap = await db.doc(`companies/${companyId}/system_settings/config`).get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const allowLockedVoucherEdits = settingsData.allowLockedVoucherEdits === true;
    const approvalEditPolicy: 'open' | 'receiver_only' = settingsData.approvalEditPolicy === 'receiver_only' ? 'receiver_only' : 'open';
    const allowApprovedEdits = approvalEditPolicy === 'open' || approvalEditPolicy === 'receiver_only';

    const financialKeys = ["lines", "type", "date", "currency", "paymentMethod", "paymentDetails", "exchangeRateInfo", "totalDebit", "totalCredit", "referenceDoc", "attachments"];
    const financialChanged = financialKeys.some((key) => JSON.stringify((before as any)[key]) !== JSON.stringify((after as any)[key]));
    const numberChanged = (before.number || null) !== (after.number || null);

    // Prevent direct client status changes; allow server/Admin SDK writes
    if (beforeStatus !== afterStatus && context.authType === 'USER') {
      await change.after.ref.update({ status: beforeStatus });
      return null;
    }

    if (!allowLockedVoucherEdits && beforeStatus === VoucherStatus.LOCKED && (beforeStatus !== afterStatus || financialChanged)) {
      await change.after.ref.set(change.before.data(), { merge: false });
      return null;
    }

    if (context.authType === 'USER' && before.number && numberChanged) {
      await change.after.ref.update({ number: before.number, voucherNo: before.voucherNo ?? before.number });
      return null;
    }

    if (!allowApprovedEdits && beforeStatus === VoucherStatus.APPROVED && afterStatus === VoucherStatus.APPROVED && financialChanged) {
      const revert: Record<string, any> = {};
      for (const key of financialKeys) {
        if ((before as any)[key] !== undefined) {
          revert[key] = (before as any)[key];
        } else {
          revert[key] = admin.firestore.FieldValue.delete();
        }
      }
      await change.after.ref.update(revert);
      return null;
    }

    if (beforeStatus === afterStatus) {
      const actingUid = inferActingUserUid(after, null);
      const beforeAmount = getAmountValue(before);
      const afterAmount = getAmountValue(after);
      const amountChanged = Math.abs(beforeAmount - afterAmount) > 0.0001;
      const beforeFx = getFxValue(before);
      const afterFx = getFxValue(after);
      const fxChanged = Math.abs(beforeFx - afterFx) > 0.000001;
      const beforeAccounts = JSON.stringify(extractAccountIds(before).sort());
      const afterAccounts = JSON.stringify(extractAccountIds(after).sort());
      const accountChanged = beforeAccounts !== afterAccounts;

      let editChangeType: ChangeType | null = null;
      if (accountChanged) editChangeType = 'account_change';
      else if (amountChanged) editChangeType = 'amount_change';
      else if (fxChanged) editChangeType = 'fx_change';
      else if (financialChanged) editChangeType = 'edit';

      if (editChangeType) {
    const impact = await getImpactedUsersFromVoucher({ ...after, companyId }, actingUid);
    console.log('[ImpactEngine] update', { companyId, voucherId, actingUid, impactedUsers: impact.impactedUsers, changeType: editChangeType });
    const payload = {
      companyId,
      voucher: { ...after, id: voucherId },
      actingUid,
      changeType: editChangeType as ChangeType,
      settingsData,
      impactResult: impact,
    };
    await sendVoucherImpactNotifications(payload);
      }
    }

    const becameApproved = beforeStatus !== VoucherStatus.APPROVED && afterStatus === VoucherStatus.APPROVED;
    if (!becameApproved) {
      return null;
    }

    try {
      await db.runTransaction(async (tx) => {
        for (const line of after.lines) {
          if (!line.accountId) continue;
          const delta = line.type === "Debit" ? line.amount : -line.amount;
          tx.update(db.doc(`companies/${companyId}/accounts/${line.accountId}`), {
            current_balance: FieldValue.increment(delta),
          });
        }
      });
      functions.logger.log(`Settled balances for voucher ${voucherId} in ${companyId}`);
    } catch (err: any) {
      functions.logger.error(`Failed to settle balances for voucher ${voucherId} in ${companyId}`, err);
      await change.after.ref.update({
        status: before.status,
        "auditLog.error": `Balance settlement failed: ${err?.message || String(err)}`,
      });
    }
    return null;
  });

export const updateCompanyUser = functions.https.onCall(async (data, context) => {
  const { companyId, uid } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);
  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid uid is required.");
  }
  const profileUpdates = sanitizeGlobalUserProfile(data);
  const membershipUpdates = sanitizeMembership(data);
  if (Object.keys(profileUpdates).length === 0 && Object.keys(membershipUpdates).length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "No valid fields to update.");
  }
  try {
    const writes: Promise<any>[] = [];
    if (Object.keys(profileUpdates).length > 0) {
      writes.push(db.doc(`users/${uid}`).set({ ...profileUpdates, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
      const authUpdate: any = {};
      if (typeof profileUpdates.name === "string") authUpdate.displayName = profileUpdates.name;
      if (typeof profileUpdates.email === "string") authUpdate.email = profileUpdates.email;
      if (Object.keys(authUpdate).length > 0) writes.push(auth.updateUser(uid, authUpdate));
    }
    if (Object.keys(membershipUpdates).length > 0 || Object.keys(profileUpdates).length > 0) {
      const memDocUpdate: any = { ...membershipUpdates, updatedAt: FieldValue.serverTimestamp() };
      if (typeof profileUpdates.name === 'string') memDocUpdate.name = profileUpdates.name;
      if (typeof profileUpdates.email === 'string') memDocUpdate.email = profileUpdates.email;
      writes.push(
        db.doc(`companies/${companyId}/users/${uid}`).set(memDocUpdate, { merge: true })
      );
    }
    await Promise.all(writes);
    return { success: true };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to update company user.");
  }
});

export const deleteCompanyUser = functions.https.onCall(async (data, context) => {
  const { companyId, uid } = data || {};
  await assertCompanyRole(context, companyId, ["Owner"]);
  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "A valid uid is required.");
  }
  try {
    await db.doc(`companies/${companyId}/users/${uid}`).delete();
    return { success: true };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to delete company user.");
  }
});

export const listCompanyUsers = functions.https.onCall(async (data, context) => {
  const { companyId } = data || {};
  await assertCompanyRole(context, companyId, ["Owner", "Admin"]);
  try {
    const snap = await db.collection(`companies/${companyId}/users`).get();
    const members = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (CompanyUserMembership & { id: string; permissions?: Record<string, boolean> })[];
    const profileFetches = members.map((m) => db.doc(`users/${m.id}`).get());
    const profileDocs = await Promise.all(profileFetches);
    const profiles: Record<string, any> = {};
    profileDocs.forEach((p) => { if (p.exists) profiles[p.id] = p.data(); });
    const result = members.map((m) => ({
      uid: m.id,
      role: m.role,
      status: m.status || "active",
      joinedAt: (m as any).joinedAt || null,
      permissions: m.permissions || null,
      profile: profiles[m.id]
        ? {
            name: profiles[m.id].name || null,
            email: profiles[m.id].email || null,
            code: profiles[m.id].code || null,
            phone: profiles[m.id].phone || null,
            address: profiles[m.id].address || null,
          }
        : null,
    }));
    return { users: result };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", error?.message || "Failed to list company users.");
  }
});

// -------------------------------
// Sync global user profile -> company memberships
// -------------------------------

export const onGlobalUserUpdate = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const { uid } = context.params as { uid: string };
    const after = change.after.exists ? change.after.data() as any : null;
    if (!after) return null;
    const name = typeof after.name === 'string' ? after.name : null;
    const email = typeof after.email === 'string' ? after.email : null;
    try {
      const snap = await db.collectionGroup('users')
        .where(admin.firestore.FieldPath.documentId(), '==', uid)
        .get();
      const batch = db.batch();
      snap.docs.forEach(docSnap => {
        const ref = docSnap.ref;
        const update: any = { updatedAt: FieldValue.serverTimestamp() };
        if (name !== null) update.name = name;
        if (email !== null) update.email = email;
        batch.set(ref, update, { merge: true });
      });
      if (!snap.empty) await batch.commit();
    } catch (err) {
      functions.logger.error('Failed syncing profile to memberships', { uid, err });
    }
    return null;
  });

// -------------------------------
// Backfill membership name/email
// -------------------------------
export const backfillMembershipProfiles = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const uid: string | undefined = typeof data?.uid === 'string' ? data.uid : undefined;

  if (uid && !companyId) {
    // SuperAdmin can backfill all companies for a user
    await assertSuperAdmin(context);
    const userDoc = await db.doc(`users/${uid}`).get();
    if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User profile not found');
    const profile = userDoc.data() || {};
    const name = profile.name || null;
    const email = profile.email || null;
    const cg = await db.collectionGroup('users')
      .where(admin.firestore.FieldPath.documentId(), '==', uid)
      .get();
    const batch = db.batch();
    cg.docs.forEach(d => {
      const update: any = { updatedAt: FieldValue.serverTimestamp() };
      if (name) update.name = name;
      if (email) update.email = email;
      batch.set(d.ref, update, { merge: true });
    });
    if (!cg.empty) await batch.commit();
    return { updated: cg.size };
  }

  if (companyId) {
    // Company Owner/Admin can backfill their company
    await assertCompanyRole(context, companyId, ["Owner", "Admin"]);
    const mems = await db.collection(`companies/${companyId}/users`).get();
    let updated = 0;
    const batch = db.batch();
    for (const m of mems.docs) {
      const memberUid = m.id;
      const u = await db.doc(`users/${memberUid}`).get();
      if (!u.exists) continue;
      const p = u.data() || {};
      const update: any = { updatedAt: FieldValue.serverTimestamp() };
      if (p.name) update.name = p.name;
      if (p.email) update.email = p.email;
      batch.set(m.ref, update, { merge: true });
      updated++;
    }
    if (updated > 0) await batch.commit();
    return { updated };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Provide either companyId (Owner/Admin) or uid (SuperAdmin).');
});

// -------------------------------
// Finance: Secure Voucher Save/Approve
// -------------------------------

function settingsRef(companyId: string) {
  return db.doc(`companies/${companyId}/system_settings/config`);
}

function accountRef(companyId: string, accountId: string) {
  return db.doc(`companies/${companyId}/accounts/${accountId}`);
}

function voucherRef(companyId: string, voucherId?: string) {
  return voucherId
    ? db.doc(`companies/${companyId}/financial_vouchers/${voucherId}`)
    : db.collection(`companies/${companyId}/financial_vouchers`).doc();
}

function inferActingUserUid(voucher: any, fallback?: string | null): string | null {
  return (
    (voucher?.lastEditedByUid as string) ||
    (voucher?.updatedBy as string) ||
    (voucher?.updatedByUid as string) ||
    (voucher?.approvedBy as string) ||
    (voucher?.submittedBy as string) ||
    (voucher?.createdBy as string) ||
    fallback ||
    null
  );
}

const getAmountValue = (voucher: FinancialVoucher): number => {
  const val =
    (voucher as any).totalAmount ??
    (voucher as any).totalDebit ??
    (voucher as any).totalCredit ??
    0;
  return Number(val) || 0;
};

const getFxValue = (voucher: FinancialVoucher): number => {
  const val =
    (voucher as any).exchangeRate ??
    (voucher as any).exchangeRateInfo?.rate ??
    0;
  return Number(val) || 0;
};

const extractAccountIds = (voucher: FinancialVoucher): string[] => {
  const lines: VoucherLineItem[] = Array.isArray(voucher.lines) ? voucher.lines : [];
  return Array.from(
    new Set(lines.map((line) => (line?.accountId ? String(line.accountId) : null)).filter(Boolean) as string[])
  );
};

const determineStatusChangeType = (before: VoucherStatus, after: VoucherStatus, desired: VoucherStatus): ChangeType | null => {
  if (before === VoucherStatus.DRAFT && desired === VoucherStatus.PENDING) return 'create';
  if (before === VoucherStatus.PENDING && desired === VoucherStatus.APPROVED) return 'approve';
  if (before === VoucherStatus.DRAFT && desired === VoucherStatus.APPROVED) return 'approve';
  if (before === VoucherStatus.PENDING && desired === VoucherStatus.DRAFT) return 'reject';
  if (desired === VoucherStatus.CANCELED) return 'reject';
  return null;
};


async function getUserLabel(uid: string): Promise<{ uid: string; name: string; photoURL?: string | null; email?: string | null }> {
  try {
    const snap = await db.doc(`users/${uid}`).get();
    const data = snap.data() || {};
    const name = (snap.exists && (data.name as string)) || (data.displayName as string) || uid;
    const photoURL = (data.photoURL as string) || (data.avatarUrl as string) || null;
    const email = (data.email as string) || null;
    return { uid, name, photoURL, email };
  } catch {
    return { uid, name: uid, photoURL: null, email: null };
  }
}

function inferSourceType(voucherType: string): 'Debit' | 'Credit' {
  return voucherType === 'Payment' || voucherType === 'Cash Transfer' || voucherType === 'Partner Withdrawal' ? 'Credit' : 'Debit';
}

const allowedStatusTransitions: Record<VoucherStatus, VoucherStatus[]> = {
  [VoucherStatus.DRAFT]: [VoucherStatus.PENDING, VoucherStatus.APPROVED],
  [VoucherStatus.PENDING]: [VoucherStatus.APPROVED, VoucherStatus.DRAFT],
  [VoucherStatus.APPROVED]: [VoucherStatus.LOCKED],
  [VoucherStatus.LOCKED]: [],
  [VoucherStatus.CANCELED]: [],
};

function normalizeVoucherStatus(raw?: any): VoucherStatus {
  const value = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (value === 'draft') return VoucherStatus.DRAFT;
  if (value === 'pending') return VoucherStatus.PENDING;
  if (value === 'approved') return VoucherStatus.APPROVED;
  if (value === 'locked') return VoucherStatus.LOCKED;
  if (value === 'canceled' || value === 'cancelled') return VoucherStatus.CANCELED;
  return VoucherStatus.DRAFT;
}

async function checkPeriodIsOpen(companyId: string, voucherDate: string, trx?: FirebaseFirestore.Transaction): Promise<string> {
  if (!voucherDate || Number.isNaN(new Date(voucherDate).getTime())) {
    throw new functions.https.HttpsError('failed-precondition', 'INVALID_VOUCHER_DATE');
  }
  const voucherTs = admin.firestore.Timestamp.fromDate(new Date(voucherDate));
  const colRef = db.collection(`companies/${companyId}/accounting_periods`);
  // Query open periods where startDate <= voucherTs; verify endDate manually to avoid multiple-field inequality
  const q = colRef
    .where('status', '==', 'open')
    .where('startDate', '<=', voucherTs)
    .orderBy('startDate', 'desc')
    .limit(1);
  const snap = trx ? await trx.get(q) : await q.get();
  if (snap.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'NO_OPEN_PERIOD_FOR_DATE');
  }
  const docSnap = snap.docs[0];
  const data = docSnap.data() || {};
  const endDate = data.endDate;
  if (!endDate || (endDate.toDate ? endDate.toDate() : new Date(endDate)) < voucherTs.toDate()) {
    throw new functions.https.HttpsError('failed-precondition', 'PERIOD_CLOSED_FOR_DATE');
  }
  return docSnap.id;
}

function derivePeriodKey(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const mm = month < 10 ? `0${month}` : `${month}`;
  return `${year}${mm}`;
}

function formatVoucherNumber(periodKey: string, seq: number): string {
  const padded = seq.toString().padStart(6, '0');
  return `${periodKey}-${padded}`;
}

async function getOrCreateVoucherNumber(
  companyId: string,
  date: string
): Promise<string> {
  const periodKey = derivePeriodKey(date);
  // Single company-wide counter per period to ensure uniqueness across voucher types
  const counterId = `${companyId}_${periodKey}`;
  const counterRef = db.doc(`voucher_counters/${counterId}`);
  let assigned = '';
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let next = 1;
    if (!snap.exists) {
      next = 1;
      tx.set(counterRef, {
        companyId,
        periodKey,
        nextNumber: 2,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const data = snap.data() || {};
      next = typeof data.nextNumber === 'number' ? data.nextNumber : 1;
      tx.update(counterRef, {
        nextNumber: next + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    assigned = formatVoucherNumber(periodKey, next);
  });
  return assigned;
}

function calculateTotals(lines: VoucherLineItem[]): { totalDebit: number; totalCredit: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'Debit') acc.totalDebit += Number(line.amount || 0);
      if (line.type === 'Credit') acc.totalCredit += Number(line.amount || 0);
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 }
  );
}

async function validateVoucherForCompany(
  companyId: string,
  voucher: FinancialVoucher,
  uid: string,
  trx: FirebaseFirestore.Transaction
): Promise<{
  accounts: Map<string, any>;
  destLines: VoucherLineItem[];
  sourceType: 'Debit' | 'Credit';
  totalDebit: number;
  totalCredit: number;
  cashBoxParentAccountId?: string;
}> {
  const sourceType = inferSourceType(String(voucher.type || ''));
  const lines: VoucherLineItem[] = Array.isArray(voucher.lines) ? voucher.lines : [];
  if (lines.length < 2) throw new functions.https.HttpsError('invalid-argument', 'voucher must include source and destination lines');
  const sourceLines = lines.filter(l => l.type === sourceType && l.accountId);
  if (sourceLines.length !== 1) throw new functions.https.HttpsError('invalid-argument', 'expected exactly one source line');
  const sourceLine = sourceLines[0];
  const destLines = lines.filter(l => l.type !== sourceType && l.accountId);
  if (destLines.length === 0) throw new functions.https.HttpsError('invalid-argument', 'missing destination lines');

  const settingsSnap = await trx.get(settingsRef(companyId));
  const cashBoxParentAccountId = (settingsSnap.exists ? (settingsSnap.data()?.cashBoxParentAccountId as string | undefined) : undefined) || undefined;

  const accountIds = new Set<string>();
  for (const l of lines) if (l.accountId) accountIds.add(l.accountId);
  const accountSnaps = await Promise.all(Array.from(accountIds).map(id => trx.get(accountRef(companyId, id))));
  const accounts = new Map<string, any>();
  for (const s of accountSnaps) {
    if (!s.exists) throw new functions.https.HttpsError('failed-precondition', `Account ${s.id} not found`);
    accounts.set(s.id, s.data());
    if (s.data()?.is_active === false) throw new functions.https.HttpsError('failed-precondition', `Account ${s.id} is inactive`);
    if (s.data()?.isProtected) throw new functions.https.HttpsError('failed-precondition', 'PROTECTED_ACCOUNT_NO_POST');
    if (s.data()?.isParent) throw new functions.https.HttpsError('failed-precondition', 'PARENT_ACCOUNT_NO_POST');
    // Allow posting even if account is locked for children; lock should only block child creation/deletion, not posting.
  }

  const sourceAccount = accounts.get(sourceLine.accountId as string);
  if (voucher.type === 'Cash Transfer') {
    if (!cashBoxParentAccountId) throw new functions.https.HttpsError('failed-precondition', 'Cash box parent account not configured');
    if (sourceAccount?.parentId !== cashBoxParentAccountId) {
      throw new functions.https.HttpsError('failed-precondition', 'Cash Transfer source must be a cash box');
    }
    for (const l of destLines) {
      const destAcc = accounts.get(l.accountId as string);
      if (destAcc?.parentId !== cashBoxParentAccountId) {
        throw new functions.https.HttpsError('failed-precondition', 'Cash Transfer can only target cash boxes');
      }
    }
  }

  const { totalDebit, totalCredit } = calculateTotals(lines);
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new functions.https.HttpsError('failed-precondition', 'Voucher is not balanced (debits != credits)');
  }

  return { accounts, destLines, sourceType, totalDebit, totalCredit, cashBoxParentAccountId };
}

export const saveVoucherSecure = functions.https.onCall(async (data, context) => {
  const { companyId, voucher } = data || {};
  const { uid, role } = await assertCompanyRole(context, companyId, ["Owner", "Admin", "Manager", "Accountant", "User"]);

  if (!voucher || typeof voucher !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'voucher payload is required');
  }
  const linesInput: VoucherLineItem[] = Array.isArray(voucher.lines) ? voucher.lines : [];

  return await db.runTransaction(async (trx) => {
    // Determine base currency from company or settings
    const companySnap = await trx.get(db.doc(`companies/${companyId}`));
    const companyData = companySnap.exists ? companySnap.data() || {} : {};
    let baseCurrency = (companyData.baseCurrency as string) || 'TRY';
    const settingsSnap = await trx.get(settingsRef(companyId));
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const approvalEditPolicy: 'open' | 'receiver_only' = settingsData.approvalEditPolicy === 'receiver_only' ? 'receiver_only' : 'open';
    const allowLockedVoucherEdits = settingsData.allowLockedVoucherEdits === true;
    if (settingsData.baseCurrency) {
      baseCurrency = settingsData.baseCurrency || baseCurrency;
    }

    const transactionCurrency: string = (voucher.transactionCurrency as string) || baseCurrency;
    const exchangeRateInput = typeof voucher.exchangeRate === 'number' ? voucher.exchangeRate : 1;
    const usingFx = transactionCurrency && transactionCurrency !== baseCurrency;
    if (usingFx && (!exchangeRateInput || exchangeRateInput <= 0)) {
      throw new functions.https.HttpsError('failed-precondition', 'Valid exchange rate required for foreign currency.');
    }

    const normalizedLines: VoucherLineItem[] = linesInput.map((line) => {
      if (!line) return line;
      if (!usingFx) {
        return { ...line, fxAmount: null as any };
      }
      const fxAmount = typeof line.fxAmount === 'number' ? line.fxAmount : (typeof line.amount === 'number' ? line.amount : 0);
      if (!fxAmount || fxAmount <= 0) {
        throw new functions.https.HttpsError('failed-precondition', 'FX amount is required for foreign currency lines.');
      }
      const baseAmount = Number((fxAmount * exchangeRateInput).toFixed(2));
      return { ...line, amount: baseAmount, fxAmount };
    });

    const validation = await validateVoucherForCompany(companyId, { ...voucher, lines: normalizedLines } as FinancialVoucher, uid, trx);

    const hasId = typeof voucher.id === 'string' && voucher.id;
    const existingSnap = hasId ? await trx.get(voucherRef(companyId, voucher.id)) : null;
    const isUpdate = Boolean(existingSnap?.exists);
    const existingData = existingSnap?.data() as FinancialVoucher | undefined;
    const currentStatus = normalizeVoucherStatus(existingData?.status || VoucherStatus.DRAFT);
    const sourceType = inferSourceType(String(voucher.type || ''));
    const receiverLines = normalizedLines.filter(l => l?.accountId && l.type !== sourceType);
    const isReceiver = receiverLines.some(l => {
      const acc = validation.accounts.get(l.accountId as string);
      return accountHasCustodianUid(acc, uid);
    });
    const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
    const isCreator = ((existingData?.createdBy as string) || '') === uid;
    const passesPolicy =
      approvalEditPolicy === 'open'
        ? (isOwnerOrAdmin || isCreator)
        : (isOwnerOrAdmin || isReceiver || isCreator);
    const editableStatus = passesPolicy && (currentStatus !== VoucherStatus.LOCKED || allowLockedVoucherEdits);
    if (isUpdate && !editableStatus) {
      throw new functions.https.HttpsError('failed-precondition', 'Voucher cannot be edited in its current status.');
    }

    const vRef = voucherRef(companyId, hasId ? voucher.id : undefined);
    const vId = vRef.id;

    const nowIso = new Date().toISOString();
    const creatorLabel = await getUserLabel(existingData?.createdBy || uid);
    const editorLabel = await getUserLabel(uid);

    // FX totals
    let fxTotalDebit = null as number | null;
    let fxTotalCredit = null as number | null;
    if (usingFx) {
      fxTotalDebit = 0;
      fxTotalCredit = 0;
      for (const l of normalizedLines) {
        if (!l.fxAmount) continue;
        if (l.type === 'Debit') fxTotalDebit += l.fxAmount;
        else fxTotalCredit += l.fxAmount;
      }
      fxTotalDebit = Number(fxTotalDebit.toFixed(2));
      fxTotalCredit = Number(fxTotalCredit.toFixed(2));
    }

    const dataToSave: any = {
      ...voucher,
      id: vId,
      lines: normalizedLines,
      // Preserve existing status if any; default to draft only when creating new
      status: existingData?.status || VoucherStatus.DRAFT,
      number: existingData?.number || null,
      voucherNo: existingData?.voucherNo || null,
      createdBy: existingData?.createdBy || uid,
      createdAt: existingData?.createdAt || FieldValue.serverTimestamp(),
      submittedBy: existingData?.submittedBy ?? null,
      submittedAt: existingData?.submittedAt ?? null,
      approvedBy: existingData?.approvedBy ?? null,
      approvedAt: existingData?.approvedAt ?? null,
      lockedBy: existingData?.lockedBy ?? null,
      lockedAt: existingData?.lockedAt ?? null,
      statusReason: existingData?.statusReason ?? null,
      totalDebit: validation.totalDebit,
      totalCredit: validation.totalCredit,
      transactionCurrency,
      exchangeRate: usingFx ? exchangeRateInput : 1,
      fxTotalDebit,
      fxTotalCredit,
    };

    dataToSave.auditLog = {
      ...(existingData?.auditLog || {}),
      createdBy: (existingData?.auditLog || {}).createdBy || creatorLabel.name,
      createdAt: (existingData?.auditLog || {}).createdAt || nowIso,
      lastEditedBy: editorLabel.name,
      lastEditedAt: nowIso,
    };

    trx.set(vRef, dataToSave, { merge: true });

    // Flag all involved accounts as locked for children once used in a voucher
    for (const accId of validation.accounts.keys()) {
      const accData = validation.accounts.get(accId);
      if (!accData?.isLockedForChildren) {
        trx.set(accountRef(companyId, accId), { isLockedForChildren: true }, { merge: true });
      }
    }

    return { id: vId, status: VoucherStatus.DRAFT };
  });
});

export const deleteVoucherSecure = functions.https.onCall(async (data, context) => {
  const { companyId, voucherId } = data || {};
  const { uid, role } = await assertCompanyRole(context, companyId, ["Owner", "Admin", "Manager", "Accountant", "User"]);

  if (!companyId || typeof companyId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
  }
  if (!voucherId || typeof voucherId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'voucherId is required');
  }

  let deletedVoucherSnapshot: FinancialVoucher | null = null;
  let deleteSettingsRaw: any = null;
  const result = await db.runTransaction(async (trx) => {
    const vRef = voucherRef(companyId, voucherId);
    const vSnap = await trx.get(vRef);
    if (!vSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Voucher not found');
    }
    const voucher = vSnap.data() as FinancialVoucher;
    const status = normalizeVoucherStatus(voucher.status);
    const lines: VoucherLineItem[] = Array.isArray(voucher.lines) ? voucher.lines : [];

    const settingsSnap = await trx.get(settingsRef(companyId));
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    deleteSettingsRaw = settings;
    const allowAfterApproval = settings.allowApprovedVoucherDeletion === true;
    const approvalEditPolicy: 'open' | 'receiver_only' = settings.approvalEditPolicy === 'receiver_only' ? 'receiver_only' : 'open';
    const allowLockedVoucherEdits = settings.allowLockedVoucherEdits === true;

    const accountIds = Array.from(new Set(lines.map(l => l.accountId).filter(Boolean) as string[]));
    const accountDocs = await Promise.all(accountIds.map(id => trx.get(accountRef(companyId, id))));
    const accountMap = new Map<string, any>();
    accountDocs.forEach(docSnap => {
      if (docSnap.exists) accountMap.set(docSnap.id, docSnap.data());
    });

    const sourceType = inferSourceType(String(voucher.type || ''));
    const destLines = lines.filter(l => l?.accountId && l.type !== sourceType);
    const isReceiver = destLines.some(l => {
      const acc = accountMap.get(l.accountId as string);
      return accountHasCustodianUid(acc, uid);
    });

    const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
    const isCreator = ((voucher.createdBy as string) || '') === uid;
    const passesPolicy =
      approvalEditPolicy === 'open'
        ? (isOwnerOrAdmin || isCreator)
        : (isOwnerOrAdmin || isReceiver || isCreator);
    const canDelete =
      passesPolicy &&
      (status !== VoucherStatus.LOCKED || allowLockedVoucherEdits || allowAfterApproval || isOwnerOrAdmin);
    if (!canDelete) {
      throw new functions.https.HttpsError('failed-precondition', 'Voucher cannot be deleted in its current state.');
    }

    if ([VoucherStatus.APPROVED, VoucherStatus.LOCKED].includes(status)) {
      for (const line of lines) {
        if (!line?.accountId) continue;
        if (!accountMap.has(line.accountId)) continue;
        const delta = line.type === 'Debit' ? -Number(line.amount || 0) : Number(line.amount || 0);
        if (!delta) continue;
        trx.update(accountRef(companyId, line.accountId), { current_balance: FieldValue.increment(delta) });
      }
    }

    trx.delete(vRef);
    deletedVoucherSnapshot = { ...voucher, id: voucherId, companyId } as FinancialVoucher;
    return { deleted: voucherId };
  });

  if (deletedVoucherSnapshot) {
    const impact = await getImpactedUsersFromVoucher(deletedVoucherSnapshot, uid);
    console.log('[ImpactEngine] delete', { companyId, voucherId, actingUid: uid, impactedUsers: impact.impactedUsers });
    const payload = {
      companyId,
      voucher: deletedVoucherSnapshot,
      actingUid: uid,
      changeType: 'delete' as ChangeType,
      settingsData: deleteSettingsRaw,
      impactResult: impact,
    };
    await sendVoucherImpactNotifications(payload);
  }

  return result;
});

async function handleVoucherStatusChange(
  rawData: any,
  context: functions.https.CallableContext,
  forcedTarget?: VoucherStatus
): Promise<any> {
  const { companyId, voucherId } = rawData || {};
  const targetStatusInput: string | undefined = typeof rawData?.targetStatus === 'string' ? rawData.targetStatus : undefined;
  const reason: string | undefined = typeof rawData?.reason === 'string' ? rawData.reason : undefined;
  const targetStatus = normalizeVoucherStatus(forcedTarget || targetStatusInput);
  const { uid, role } = await assertCompanyRole(context, companyId, ["Owner", "Admin", "Manager", "Accountant", "User"]);

  if (!voucherId || typeof voucherId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'voucherId is required');
  }
  if (!companyId || typeof companyId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
  }

  const submitRoles: CompanyRole[] = ["Owner", "Admin", "Manager", "Accountant"];
  const approveRoles: CompanyRole[] = ["Owner", "Admin", "Manager"];
  const lockRoles: CompanyRole[] = ["Owner", "Admin", "Manager"];
  const autoApproveTypes = new Set<string>(["Receipt", "Payment", "Cash Transfer", "Partner Withdrawal"]);

  let voucherSnapshotForImpact: FinancialVoucher | null = null;
  let notificationSettingsRaw: any = null;
  let statusChangeType: ChangeType | null = null;
  const result = await db.runTransaction(async (trx) => {
    const vRef = voucherRef(companyId, voucherId);
    const vSnap = await trx.get(vRef);
    if (!vSnap.exists) throw new functions.https.HttpsError('not-found', 'Voucher not found');
    const voucher = vSnap.data() as FinancialVoucher;
    voucherSnapshotForImpact = { ...voucher } as FinancialVoucher;
    const currentStatus = normalizeVoucherStatus(voucher.status);
    const creatorUid = (voucher.createdBy as string) || (voucher as any)?.created_by || (voucher.auditLog as any)?.createdBy || '';

    // Read approval toggle from settings (default true)
    const settingsSnap = await trx.get(settingsRef(companyId));
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
    notificationSettingsRaw = settingsData;
    const strictApprovalMode = settingsData.strictApprovalMode === true;
    const approvalsEnabledSetting = settingsData.approvalsEnabled !== false;
    const approvalsEnabled = strictApprovalMode ? true : approvalsEnabledSetting;
    const approvalSettings = (settingsData.approval || {}) as any;
    const resolveAutoApproveSetting = (): boolean => {
      if (typeof approvalSettings?.autoApproveWhenReceiverIsActing === 'boolean') {
        return approvalSettings.autoApproveWhenReceiverIsActing;
      }
      if (typeof settingsData.autoApproveWhenReceiverIsActing === 'boolean') {
        return settingsData.autoApproveWhenReceiverIsActing;
      }
      return true;
    };
    const autoApproveWhenReceiverIsActing = resolveAutoApproveSetting();
    const lines: VoucherLineItem[] = Array.isArray(voucher.lines) ? voucher.lines : [];
    let autoApprovedByReceiver = false;

    let desiredStatus = targetStatus;
    if (
      !strictApprovalMode &&
      targetStatus === VoucherStatus.PENDING &&
      approveRoles.includes(role) &&
      currentStatus === VoucherStatus.DRAFT &&
      autoApproveTypes.has(String(voucher.type || ""))
    ) {
      desiredStatus = VoucherStatus.APPROVED;
    }
    // If approvals are disabled entirely, skip pending and go straight to approved when requested
    if (!strictApprovalMode && !approvalsEnabled && desiredStatus === VoucherStatus.PENDING) {
      desiredStatus = VoucherStatus.APPROVED;
    }

    if (
      autoApproveWhenReceiverIsActing &&
      targetStatus === VoucherStatus.PENDING &&
      currentStatus === VoucherStatus.DRAFT &&
      autoApproveTypes.has(String(voucher.type || ""))
    ) {
      const receivingLines = lines.filter((l) => l?.accountId && l.type === 'Debit');
      if (receivingLines.length) {
        const accountIds = Array.from(new Set(receivingLines.map((l) => l.accountId).filter(Boolean) as string[]));
        if (accountIds.length) {
          const accountDocs = await Promise.all(accountIds.map((id) => trx.get(accountRef(companyId, id))));
          let allMatch = true;
          let hasCustodian = false;
          for (const docSnap of accountDocs) {
            if (!docSnap.exists) continue;
            const data = docSnap.data() || {};
            const custodians = extractCustodians(data);
            if (!custodians.length) continue;
            hasCustodian = true;
            if (!custodians.includes(uid)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch && hasCustodian) {
            autoApprovedByReceiver = true;
            desiredStatus = VoucherStatus.APPROVED;
          }
        }
      }
    }

    statusChangeType = determineStatusChangeType(currentStatus, desiredStatus, desiredStatus);

    const allowedTargets = allowedStatusTransitions[currentStatus] || [];
    if (!allowedTargets.includes(desiredStatus)) {
      throw new functions.https.HttpsError('failed-precondition', `Transition from ${currentStatus} to ${desiredStatus} is not allowed.`);
    }
    if (strictApprovalMode && currentStatus === VoucherStatus.DRAFT && desiredStatus === VoucherStatus.APPROVED && !autoApprovedByReceiver) {
      throw new functions.https.HttpsError('failed-precondition', 'Strict approval mode requires pending approval before final approval.');
    }

    if (desiredStatus === VoucherStatus.PENDING && !submitRoles.includes(role)) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to submit voucher for approval.');
    }
    if (desiredStatus === VoucherStatus.DRAFT && currentStatus === VoucherStatus.PENDING) {
      const canReturn = approveRoles.includes(role) || creatorUid === uid;
      if (!canReturn) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to return voucher to draft.');
      }
    }
    if (desiredStatus === VoucherStatus.APPROVED && !approveRoles.includes(role) && !autoApprovedByReceiver) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to approve voucher.');
    }
    if (desiredStatus === VoucherStatus.LOCKED && !lockRoles.includes(role)) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to lock voucher.');
    }

    // Period check for submissions/approvals/locks and persist accounting period onto voucher
    let accountingPeriodId: string | null = null;
    if ([VoucherStatus.PENDING, VoucherStatus.APPROVED, VoucherStatus.LOCKED].includes(desiredStatus)) {
      accountingPeriodId = await checkPeriodIsOpen(companyId, String(voucher.date || ''), trx);
    }

    // Validate balance and accounts before approving or locking (or submitting to pending)
    let validationResult: Awaited<ReturnType<typeof validateVoucherForCompany>> | undefined;
    if ([VoucherStatus.PENDING, VoucherStatus.APPROVED, VoucherStatus.LOCKED].includes(desiredStatus)) {
      validationResult = await validateVoucherForCompany(companyId, voucher, uid, trx);
      // ensure totals present
      const { totalDebit, totalCredit } = validationResult;
      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new functions.https.HttpsError('failed-precondition', 'Voucher not balanced in base currency.');
      }
    }

    const nowServer = FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();
    const userLabel = await getUserLabel(uid);
    const updates: Record<string, any> = {
      status: desiredStatus,
      statusReason: null,
      updatedAt: nowServer,
    };

    if (desiredStatus === VoucherStatus.PENDING) {
      updates.submittedBy = uid;
      updates.submittedAt = nowServer;
      updates.statusReason = reason || null;
      updates['auditLog.lastEditedBy'] = userLabel.name;
      updates['auditLog.lastEditedAt'] = nowIso;
    } else if (desiredStatus === VoucherStatus.APPROVED) {
      // Always assign a server-generated number to prevent duplicates or client-provided numbers
      const generated = await getOrCreateVoucherNumber(companyId, String(voucher.date || ''));
      updates.number = generated;
      updates.voucherNo = generated;
      updates.approvedBy = uid;
      updates.approvedAt = nowServer;
      updates.statusReason = null;
      updates['auditLog.approvedBy'] = userLabel.name;
      updates['auditLog.approvedAt'] = nowIso;
      if (autoApprovedByReceiver) {
        updates.requiresReceiverConfirmation = false;
      }
    } else if (desiredStatus === VoucherStatus.LOCKED) {
      updates.lockedBy = uid;
      updates.lockedAt = nowServer;
      updates.statusReason = null;
      updates['auditLog.lockedBy'] = userLabel.name;
      updates['auditLog.lockedAt'] = nowIso;
    } else if (desiredStatus === VoucherStatus.DRAFT) {
      updates.statusReason = typeof reason === 'string' ? reason : null;
      updates.submittedBy = null;
      updates.submittedAt = null;
      updates.approvedBy = null;
      updates.approvedAt = null;
      updates.lockedBy = null;
      updates.lockedAt = null;
    }

    if (accountingPeriodId) {
      updates.accountingPeriodId = accountingPeriodId;
    }

    const finalVoucherState: FinancialVoucher = { ...voucher, ...updates, id: voucherId, companyId } as FinancialVoucher;
    voucherSnapshotForImpact = finalVoucherState;

    trx.update(vRef, updates);

    return {
      id: voucherId,
      status: desiredStatus,
      submittedAt: updates.submittedAt ?? voucher.submittedAt ?? null,
      approvedAt: updates.approvedAt ?? (voucher as any).approvedAt ?? null,
      lockedAt: updates.lockedAt ?? (voucher as any).lockedAt ?? null,
    };
  });

  if (voucherSnapshotForImpact) {
    const impact = await getImpactedUsersFromVoucher(
      voucherSnapshotForImpact,
      uid
    );
    console.log('[ImpactEngine] status-change', { companyId, voucherId, actingUid: uid, impactedUsers: impact.impactedUsers, changeType: statusChangeType });
    if (statusChangeType) {
      const payload = {
        companyId,
        voucher: voucherSnapshotForImpact,
        actingUid: uid,
        changeType: statusChangeType as ChangeType,
        settingsData: notificationSettingsRaw,
        impactResult: impact,
      };
      await sendVoucherImpactNotifications(payload);
    }
  }

  return result;
}

export const changeVoucherStatus = functions.https.onCall(async (data, context) => {
  return handleVoucherStatusChange(data, context);
});

export const approveVoucherSecure = functions.https.onCall(async (data, context) => {
  return handleVoucherStatusChange({ ...data, targetStatus: VoucherStatus.APPROVED }, context);
});

export const closeAccountingPeriod = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  const notes: string | undefined = typeof data?.notes === 'string' ? data.notes : undefined;
  const { uid } = await assertCompanyRole(context, companyId || '', ["Owner", "Admin"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }
  const ref = db.doc(`companies/${companyId}/accounting_periods/${periodId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
    const data = snap.data() || {};
    if ((data.status || '').toLowerCase() === 'closed') {
      throw new functions.https.HttpsError('failed-precondition', 'Period already closed');
    }
    trx.update(ref, {
      status: 'closed',
      closedBy: uid,
      closedAt: FieldValue.serverTimestamp(),
      notes: notes || data.notes || null,
      reopenedBy: null,
      reopenedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

export const reopenAccountingPeriod = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  const notes: string | undefined = typeof data?.notes === 'string' ? data.notes : undefined;
  const { uid } = await assertCompanyRole(context, companyId || '', ["Owner", "Admin"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }
  const ref = db.doc(`companies/${companyId}/accounting_periods/${periodId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
    const data = snap.data() || {};
    if ((data.status || '').toLowerCase() === 'open') {
      throw new functions.https.HttpsError('failed-precondition', 'Period already open');
    }
    trx.update(ref, {
      status: 'open',
      reopenedBy: uid,
      reopenedAt: FieldValue.serverTimestamp(),
      notes: notes || data.notes || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// Create/open a new accounting period
export const createAccountingPeriod = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  const startDateStr: string | undefined = typeof data?.startDate === 'string' ? data.startDate : undefined;
  const endDateStr: string | undefined = typeof data?.endDate === 'string' ? data.endDate : undefined;
  const isFiscalYear: boolean = data?.isFiscalYear === true;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin"]);

  if (!companyId || !periodId || !startDateStr || !endDateStr) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId, periodId, startDate, endDate are required');
  }
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid startDate or endDate');
  }
  if (endDate < startDate) {
    throw new functions.https.HttpsError('invalid-argument', 'endDate must be after startDate');
  }

  const ref = db.doc(`companies/${companyId}/accounting_periods/${periodId}`);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (snap.exists) {
      throw new functions.https.HttpsError('already-exists', 'Period already exists');
    }
    // Ensure no overlapping open periods
    const overlapSnap = await trx.get(
      db.collection(`companies/${companyId}/accounting_periods`)
        .where('status', '==', 'open')
        .where('startDate', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .limit(1)
    );
    if (!overlapSnap.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'An open period already exists that overlaps this range');
    }
    trx.set(ref, {
      companyId,
      startDate: admin.firestore.Timestamp.fromDate(startDate),
      endDate: admin.firestore.Timestamp.fromDate(endDate),
      status: 'open',
      isFiscalYear,
      yearClosed: false,
      openingBalancesCreated: false,
      createdAt: FieldValue.serverTimestamp(),
      notes: data?.notes || null,
    });
  });

  return { ok: true };
});

export const generateTrialBalance = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin", "Manager", "Accountant"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }

  const periodRef = db.doc(`companies/${companyId}/accounting_periods/${periodId}`);
  const periodSnap = await periodRef.get();
  if (!periodSnap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
  const period = periodSnap.data() as any;
  const startTs = period.startDate;
  const endTs = period.endDate;
  if (!startTs || !endTs) {
    throw new functions.https.HttpsError('failed-precondition', 'Period missing start/end dates');
  }
  const startDate = startTs.toDate ? startTs.toDate() : new Date(startTs);
  const endDate = endTs.toDate ? endTs.toDate() : new Date(endTs);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const accountsSnap = await db.collection(`companies/${companyId}/accounts`).get();
  const accounts = new Map<string, any>();
  accountsSnap.forEach(doc => {
    const data = doc.data() || {};
    const postingAllowed = data.postingAllowed !== false; // default true
    const active = data.is_active !== false;
    const isParent = data.isParent === true;
    const locked = data.isProtected === true;
    if (postingAllowed && active && !isParent && !locked) {
      accounts.set(doc.id, { ...data, id: doc.id });
    }
  });

  // Aggregate voucher lines
  const voucherQuery = db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', 'in', ['approved', 'locked'])
    .where('date', '>=', startStr)
    .where('date', '<=', endStr);

  const agg = new Map<string, { debit: number; credit: number }>();

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let q = voucherQuery.orderBy('date').limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const voucher = doc.data() as any;
      const lines: any[] = Array.isArray(voucher.lines) ? voucher.lines : [];
      for (const line of lines) {
        if (!line?.accountId) continue;
        if (!accounts.has(line.accountId)) continue;
        const entry = agg.get(line.accountId) || { debit: 0, credit: 0 };
        if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
        else entry.credit += Number(line.amount || 0);
        agg.set(line.accountId, entry);
      }
    }
    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  // Build rows (include zero-movement eligible accounts)
  const rows: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const [accId, acc] of accounts.entries()) {
    const sums = agg.get(accId) || { debit: 0, credit: 0 };
    const closing = sums.debit - sums.credit;
    totalDebit += sums.debit;
    totalCredit += sums.credit;
    rows.push({
      accountId: accId,
      code: acc.code || '',
      name: acc.name || accId,
      debitTotal: Number(sums.debit.toFixed(2)),
      creditTotal: Number(sums.credit.toFixed(2)),
      closingBalance: Number(closing.toFixed(2)),
    });
  }

  rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const imbalance = Math.abs(totalDebit - totalCredit) > 0.005;

  return {
    rows,
    totalDebit: Number(totalDebit.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    imbalance,
    periodId,
    periodLabel: periodId,
  };
});

export const generateGeneralLedger = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  const accountId: string | undefined = typeof data?.accountId === 'string' ? data.accountId : undefined;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin", "Manager", "Accountant"]);
  if (!companyId || !periodId || !accountId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId, periodId, and accountId are required');
  }

  // Load period
  const periodSnap = await db.doc(`companies/${companyId}/accounting_periods/${periodId}`).get();
  if (!periodSnap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
  const period = periodSnap.data() as any;
  const startTs = period.startDate;
  const endTs = period.endDate;
  if (!startTs || !endTs) throw new functions.https.HttpsError('failed-precondition', 'Period missing start/end dates');
  const startDate = startTs.toDate ? startTs.toDate() : new Date(startTs);
  const endDate = endTs.toDate ? endTs.toDate() : new Date(endTs);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // Validate account
  const accSnap = await db.doc(`companies/${companyId}/accounts/${accountId}`).get();
  if (!accSnap.exists) throw new functions.https.HttpsError('not-found', 'Account not found');
  const acc = accSnap.data() as any;
  const postingAllowed = acc.postingAllowed !== false;
  const active = acc.is_active !== false;
  const isParent = acc.isParent === true;
  const locked = acc.isProtected === true;
  if (!(postingAllowed && active && !isParent && !locked)) {
    throw new functions.https.HttpsError('failed-precondition', 'Account is not a valid posting account');
  }

  // Aggregate voucher lines for this account
  const voucherQuery = db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', 'in', ['approved', 'locked'])
    .where('date', '>=', startStr)
    .where('date', '<=', endStr);

  const rows: {
    voucherId: string;
    voucherDate: string;
    voucherNumber: string;
    narration?: string | null;
    lineDescription?: string | null;
    debit: number;
    credit: number;
  }[] = [];

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let q = voucherQuery.orderBy('date').limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const voucher = doc.data() as any;
      const lines: any[] = Array.isArray(voucher.lines) ? voucher.lines : [];
      const voucherNumber = voucher.number || voucher.voucherNo || doc.id;
      for (const line of lines) {
        if (line?.accountId !== accountId) continue;
        const debit = line.type === 'Debit' ? Number(line.amount || 0) : 0;
        const credit = line.type === 'Credit' ? Number(line.amount || 0) : 0;
        rows.push({
          voucherId: doc.id,
          voucherDate: voucher.date || '',
          voucherNumber,
          narration: voucher.description || '',
          lineDescription: line.notes || '',
          debit,
          credit,
        });
      }
    }
    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  rows.sort((a, b) => {
    const byDate = String(a.voucherDate || '').localeCompare(String(b.voucherDate || ''));
    if (byDate !== 0) return byDate;
    return String(a.voucherNumber || '').localeCompare(String(b.voucherNumber || ''));
  });

  let running = 0;
  const enriched = rows.map(r => {
    running += r.debit - r.credit;
    return { ...r, balanceAfter: Number(running.toFixed(2)) };
  });

  const closingBalance = running;
  const openingBalance = 0;

  return {
    account: { id: accountId, code: acc.code || '', name: acc.name || accountId, type: acc.type || '' },
    period: { id: periodId, startDate: startTs, endDate: endTs },
    rows: enriched,
    openingBalance: Number(openingBalance.toFixed(2)),
    closingBalance: Number(closingBalance.toFixed(2)),
  };
});

type PlGroupKey =
  | 'REVENUE'
  | 'COGS'
  | 'OPERATING_EXPENSE'
  | 'ADMIN_EXPENSE'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE'
  | 'NONE';

type BalanceSheetGroupKey =
  | 'CURRENT_ASSET'
  | 'NON_CURRENT_ASSET'
  | 'CURRENT_LIABILITY'
  | 'NON_CURRENT_LIABILITY'
  | 'EQUITY'
  | 'NONE';

const PL_LABELS: Record<PlGroupKey, string> = {
  REVENUE: 'Revenue',
  COGS: 'Cost of Goods Sold',
  OPERATING_EXPENSE: 'Operating Expenses',
  ADMIN_EXPENSE: 'Administrative Expenses',
  OTHER_INCOME: 'Other Income',
  OTHER_EXPENSE: 'Other Expenses',
  NONE: 'Unclassified',
};

function defaultPlGroup(accType: string): PlGroupKey {
  const t = (accType || '').toLowerCase();
  if (t === 'revenue') return 'REVENUE';
  if (t === 'expense') return 'OPERATING_EXPENSE';
  return 'NONE';
}

function defaultBsGroup(accType: string): BalanceSheetGroupKey {
  const t = (accType || '').toLowerCase();
  if (t === 'asset') return 'CURRENT_ASSET';
  if (t === 'liability') return 'CURRENT_LIABILITY';
  if (t === 'equity') return 'EQUITY';
  return 'NONE';
}

export const generateProfitAndLoss = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin", "Manager", "Accountant"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }

  const periodSnap = await db.doc(`companies/${companyId}/accounting_periods/${periodId}`).get();
  if (!periodSnap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
  const period = periodSnap.data() as any;
  const startTs = period.startDate;
  const endTs = period.endDate;
  if (!startTs || !endTs) throw new functions.https.HttpsError('failed-precondition', 'Period missing start/end dates');
  const startDate = startTs.toDate ? startTs.toDate() : new Date(startTs);
  const endDate = endTs.toDate ? endTs.toDate() : new Date(endTs);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // Load P&L accounts (revenue/expense, posting-eligible)
  const accountsSnap = await db.collection(`companies/${companyId}/accounts`).get();
  const accounts = new Map<string, any>();
  accountsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const type = (data.type || '').toLowerCase();
    if (type !== 'revenue' && type !== 'expense') return;
    const postingAllowed = data.postingAllowed !== false;
    const active = data.is_active !== false;
    const isParent = data.isParent === true;
    const locked = data.isProtected === true;
    if (postingAllowed && active && !isParent && !locked) {
      accounts.set(doc.id, { ...data, id: doc.id });
    }
  });

  // Aggregate voucher lines for these accounts
  const voucherQuery = db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', 'in', ['approved', 'locked'])
    .where('date', '>=', startStr)
    .where('date', '<=', endStr);

  const agg = new Map<string, { debit: number; credit: number }>();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let q = voucherQuery.orderBy('date').limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const voucher = doc.data() as any;
      const lines: any[] = Array.isArray(voucher.lines) ? voucher.lines : [];
      for (const line of lines) {
        if (!line?.accountId) continue;
        if (!accounts.has(line.accountId)) continue;
        const entry = agg.get(line.accountId) || { debit: 0, credit: 0 };
        if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
        else entry.credit += Number(line.amount || 0);
        agg.set(line.accountId, entry);
      }
    }
    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  const sectionOrder: PlGroupKey[] = ['REVENUE', 'COGS', 'OPERATING_EXPENSE', 'ADMIN_EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE'];
  const sections: Record<PlGroupKey, { key: PlGroupKey; label: string; rows: any[]; total: number }> = {
    REVENUE: { key: 'REVENUE', label: PL_LABELS.REVENUE, rows: [], total: 0 },
    COGS: { key: 'COGS', label: PL_LABELS.COGS, rows: [], total: 0 },
    OPERATING_EXPENSE: { key: 'OPERATING_EXPENSE', label: PL_LABELS.OPERATING_EXPENSE, rows: [], total: 0 },
    ADMIN_EXPENSE: { key: 'ADMIN_EXPENSE', label: PL_LABELS.ADMIN_EXPENSE, rows: [], total: 0 },
    OTHER_INCOME: { key: 'OTHER_INCOME', label: PL_LABELS.OTHER_INCOME, rows: [], total: 0 },
    OTHER_EXPENSE: { key: 'OTHER_EXPENSE', label: PL_LABELS.OTHER_EXPENSE, rows: [], total: 0 },
    NONE: { key: 'NONE', label: PL_LABELS.NONE, rows: [], total: 0 },
  };

  for (const [accId, acc] of accounts.entries()) {
    const sums = agg.get(accId) || { debit: 0, credit: 0 };
    const accType = (acc.type || '').toLowerCase() === 'expense' ? 'expense' : 'revenue';
    const group = (acc.plGroup as PlGroupKey) || defaultPlGroup(acc.type);
    const debitTotal = Number((sums.debit || 0).toFixed(2));
    const creditTotal = Number((sums.credit || 0).toFixed(2));
    const amount = accType === 'revenue'
      ? Number((creditTotal - debitTotal).toFixed(2))
      : Number((debitTotal - creditTotal).toFixed(2));
    const row = {
      accountId: accId,
      code: acc.code || '',
      name: acc.name || accId,
      type: accType,
      plGroup: group,
      debitTotal,
      creditTotal,
      amount,
    };
    (sections[group] || sections.NONE).rows.push(row);
    (sections[group] || sections.NONE).total += amount;
  }

  // Sort rows within sections by account code
  sectionOrder.forEach(key => {
    sections[key].rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  });

  const totalRevenue = sections.REVENUE.total;
  const totalCogs = sections.COGS.total;
  const totalOperatingExpenses = sections.OPERATING_EXPENSE.total;
  const totalAdminExpenses = sections.ADMIN_EXPENSE.total;
  const totalOtherIncome = sections.OTHER_INCOME.total;
  const totalOtherExpenses = sections.OTHER_EXPENSE.total;

  const grossProfit = totalRevenue - totalCogs;
  const operatingProfit = grossProfit - totalOperatingExpenses - totalAdminExpenses;
  const netProfit = operatingProfit + totalOtherIncome - totalOtherExpenses;

  const responseSections = sectionOrder.map(key => ({
    key,
    label: sections[key].label,
    rows: sections[key].rows,
    total: Number(sections[key].total.toFixed(2)),
  }));

  return {
    companyId,
    period: { id: periodId, startDate: startTs, endDate: endTs },
    sections: responseSections,
    totals: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCogs: Number(totalCogs.toFixed(2)),
      totalOperatingExpenses: Number(totalOperatingExpenses.toFixed(2)),
      totalAdminExpenses: Number(totalAdminExpenses.toFixed(2)),
      totalOtherIncome: Number(totalOtherIncome.toFixed(2)),
      totalOtherExpenses: Number(totalOtherExpenses.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      operatingProfit: Number(operatingProfit.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
    },
  };
});

export const generateBalanceSheet = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin", "Manager", "Accountant"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }

  // Period
  const periodSnap = await db.doc(`companies/${companyId}/accounting_periods/${periodId}`).get();
  if (!periodSnap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
  const period = periodSnap.data() as any;
  const startTs = period.startDate;
  const endTs = period.endDate;
  if (!startTs || !endTs) throw new functions.https.HttpsError('failed-precondition', 'Period missing start/end dates');
  const startDate = startTs.toDate ? startTs.toDate() : new Date(startTs);
  const endDate = endTs.toDate ? endTs.toDate() : new Date(endTs);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // Accounts (balance-sheet relevant)
  const accountsSnap = await db.collection(`companies/${companyId}/accounts`).get();
  const bsAccounts = new Map<string, any>();
  const revExpAccounts = new Map<string, any>();
  accountsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const type = (data.type || '').toLowerCase();
    const postingAllowed = data.postingAllowed !== false;
    const active = data.is_active !== false;
    const isParent = data.isParent === true;
    const locked = data.isProtected === true;
    if (!(postingAllowed && active && !isParent && !locked)) return;
    if (type === 'asset' || type === 'liability' || type === 'equity') {
      bsAccounts.set(doc.id, { ...data, id: doc.id });
    }
    if (type === 'revenue' || type === 'expense') {
      revExpAccounts.set(doc.id, { ...data, id: doc.id });
    }
  });

  // Aggregate voucher lines for BS accounts and revenue/expense for retained earnings
  const voucherQuery = db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', 'in', ['approved', 'locked'])
    .where('date', '>=', startStr)
    .where('date', '<=', endStr);

  const aggBs = new Map<string, { debit: number; credit: number }>();
  const aggPL = new Map<string, { debit: number; credit: number; type: string }>();

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let q = voucherQuery.orderBy('date').limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const voucher = doc.data() as any;
      const lines: any[] = Array.isArray(voucher.lines) ? voucher.lines : [];
      for (const line of lines) {
        if (!line?.accountId) continue;
        if (bsAccounts.has(line.accountId)) {
          const entry = aggBs.get(line.accountId) || { debit: 0, credit: 0 };
          if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
          else entry.credit += Number(line.amount || 0);
          aggBs.set(line.accountId, entry);
        }
        if (revExpAccounts.has(line.accountId)) {
          const acc = revExpAccounts.get(line.accountId);
          const entry = aggPL.get(line.accountId) || { debit: 0, credit: 0, type: (acc?.type || '').toLowerCase() };
          if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
          else entry.credit += Number(line.amount || 0);
          aggPL.set(line.accountId, entry);
        }
      }
    }
    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  // Retained earnings from net profit
  let netProfit = 0;
  for (const [, entry] of aggPL) {
    const accType = entry.type === 'expense' ? 'expense' : 'revenue';
    if (accType === 'revenue') {
      netProfit += (entry.credit - entry.debit);
    } else {
      netProfit -= (entry.debit - entry.credit);
    }
  }
  netProfit = Number(netProfit.toFixed(2));

  const sectionDict: Record<BalanceSheetGroupKey, { key: BalanceSheetGroupKey; label: string; rows: any[]; total: number }> = {
    CURRENT_ASSET: { key: 'CURRENT_ASSET', label: 'Current Assets', rows: [], total: 0 },
    NON_CURRENT_ASSET: { key: 'NON_CURRENT_ASSET', label: 'Non-Current Assets', rows: [], total: 0 },
    CURRENT_LIABILITY: { key: 'CURRENT_LIABILITY', label: 'Current Liabilities', rows: [], total: 0 },
    NON_CURRENT_LIABILITY: { key: 'NON_CURRENT_LIABILITY', label: 'Non-Current Liabilities', rows: [], total: 0 },
    EQUITY: { key: 'EQUITY', label: 'Equity', rows: [], total: 0 },
    NONE: { key: 'NONE', label: 'Unclassified', rows: [], total: 0 },
  };

  for (const [accId, acc] of bsAccounts.entries()) {
    const sums = aggBs.get(accId) || { debit: 0, credit: 0 };
    const type = (acc.type || '').toLowerCase();
    const natureDebit = type === 'asset';
    const closing = natureDebit
      ? Number((sums.debit - sums.credit).toFixed(2))
      : Number((sums.credit - sums.debit).toFixed(2));

    const group = (acc.bsGroup as BalanceSheetGroupKey) || defaultBsGroup(acc.type);
    const row = {
      accountId: accId,
      code: acc.code || '',
      name: acc.name || accId,
      type,
      bsGroup: group,
      debitTotal: Number((sums.debit || 0).toFixed(2)),
      creditTotal: Number((sums.credit || 0).toFixed(2)),
      closingBalance: closing,
    };
    (sectionDict[group] || sectionDict.NONE).rows.push(row);
    (sectionDict[group] || sectionDict.NONE).total += closing;
  }

  // Sort rows by code
  Object.values(sectionDict).forEach(sec => {
    sec.rows.sort((a, b) => String(a.code).localeCompare(String(b.code)));
    sec.total = Number(sec.total.toFixed(2));
  });

  const totalAssets = sectionDict.CURRENT_ASSET.total + sectionDict.NON_CURRENT_ASSET.total;
  const totalLiabilities = sectionDict.CURRENT_LIABILITY.total + sectionDict.NON_CURRENT_LIABILITY.total;
  const totalEquityAccounts = sectionDict.EQUITY.total;
  const totalEquity = Number((totalEquityAccounts + netProfit).toFixed(2));

  const finalDiff = Number((totalAssets - (totalLiabilities + totalEquity)).toFixed(2));
  const imbalance = Math.abs(finalDiff) > 0.005;

  const sections = [
    { key: 'CURRENT_ASSET', label: sectionDict.CURRENT_ASSET.label, rows: sectionDict.CURRENT_ASSET.rows, total: sectionDict.CURRENT_ASSET.total },
    { key: 'NON_CURRENT_ASSET', label: sectionDict.NON_CURRENT_ASSET.label, rows: sectionDict.NON_CURRENT_ASSET.rows, total: sectionDict.NON_CURRENT_ASSET.total },
    { key: 'CURRENT_LIABILITY', label: sectionDict.CURRENT_LIABILITY.label, rows: sectionDict.CURRENT_LIABILITY.rows, total: sectionDict.CURRENT_LIABILITY.total },
    { key: 'NON_CURRENT_LIABILITY', label: sectionDict.NON_CURRENT_LIABILITY.label, rows: sectionDict.NON_CURRENT_LIABILITY.rows, total: sectionDict.NON_CURRENT_LIABILITY.total },
    { key: 'EQUITY', label: sectionDict.EQUITY.label, rows: sectionDict.EQUITY.rows, total: sectionDict.EQUITY.total },
  ];

  return {
    companyId,
    period: { id: periodId, startDate: startTs, endDate: endTs },
    sections,
    totals: {
      totalAssets: Number(totalAssets.toFixed(2)),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      totalEquity: totalEquity,
      retainedEarnings: netProfit,
      finalCheckDifference: finalDiff,
    },
    imbalance,
  };
});

export const closeFiscalYear = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  const periodId: string | undefined = typeof data?.periodId === 'string' ? data.periodId : undefined;
  await assertCompanyRole(context, companyId || '', ["Owner", "Admin"]);
  if (!companyId || !periodId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId and periodId are required');
  }

  const periodRef = db.doc(`companies/${companyId}/accounting_periods/${periodId}`);
  const periodSnap = await periodRef.get();
  if (!periodSnap.exists) throw new functions.https.HttpsError('not-found', 'Period not found');
  const period = periodSnap.data() as any;

  if ((period.status || '').toLowerCase() !== 'closed') {
    throw new functions.https.HttpsError('failed-precondition', 'Period must be closed before fiscal year closing.');
  }
  if (!period.isFiscalYear) {
    throw new functions.https.HttpsError('failed-precondition', 'Not marked as fiscal year.');
  }
  if (period.yearClosed === true) {
    throw new functions.https.HttpsError('failed-precondition', 'Fiscal year already closed.');
  }
  const startTs = period.startDate;
  const endTs = period.endDate;
  if (!startTs || !endTs) throw new functions.https.HttpsError('failed-precondition', 'Period missing start/end dates');
  const startDate = startTs.toDate ? startTs.toDate() : new Date(startTs);
  const endDate = endTs.toDate ? endTs.toDate() : new Date(endTs);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  // Ensure prior periods closed
  const priorPeriods = await db.collection(`companies/${companyId}/accounting_periods`)
    .where('endDate', '<', startTs)
    .where('status', '!=', 'closed')
    .get();
  if (!priorPeriods.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'All prior periods must be closed.');
  }

  // Ensure no pending vouchers in this period
  const pending = await db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', '==', 'pending')
    .where('date', '>=', startStr)
    .where('date', '<=', endStr)
    .limit(1)
    .get();
  if (!pending.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'There are pending vouchers in this fiscal period.');
  }

  // Load accounts
  const accountsSnap = await db.collection(`companies/${companyId}/accounts`).get();
  const bsAccounts = new Map<string, any>();
  const plAccounts = new Map<string, any>();
  let retainedAccountId: string | null = null;
  accountsSnap.forEach(doc => {
    const data = doc.data() || {};
    const type = (data.type || '').toLowerCase();
    const postingAllowed = data.postingAllowed !== false;
    const active = data.is_active !== false;
    const isParent = data.isParent === true;
    const locked = data.isProtected === true;
    if (!(postingAllowed && active && !isParent && !locked)) return;
    if (type === 'asset' || type === 'liability' || type === 'equity') {
      bsAccounts.set(doc.id, { ...data, id: doc.id });
      if (!retainedAccountId && type === 'equity' && typeof data.name === 'string' && data.name.toLowerCase().includes('retained')) {
        retainedAccountId = doc.id;
      }
    }
    if (type === 'revenue' || type === 'expense') {
      plAccounts.set(doc.id, { ...data, id: doc.id });
    }
  });

  if (!retainedAccountId) {
    throw new functions.https.HttpsError('failed-precondition', 'Retained earnings equity account not found.');
  }

  // Aggregate vouchers
  const voucherQuery = db.collection(`companies/${companyId}/financial_vouchers`)
    .where('status', 'in', ['approved', 'locked'])
    .where('date', '>=', startStr)
    .where('date', '<=', endStr);

  const aggBs = new Map<string, { debit: number; credit: number }>();
  const aggPl = new Map<string, { debit: number; credit: number; type: string }>();

  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let q = voucherQuery.orderBy('date').limit(300);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    for (const doc of snap.docs) {
      const voucher = doc.data() as any;
      const lines: any[] = Array.isArray(voucher.lines) ? voucher.lines : [];
      for (const line of lines) {
        if (!line?.accountId) continue;
        if (bsAccounts.has(line.accountId)) {
          const entry = aggBs.get(line.accountId) || { debit: 0, credit: 0 };
          if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
          else entry.credit += Number(line.amount || 0);
          aggBs.set(line.accountId, entry);
        }
        if (plAccounts.has(line.accountId)) {
          const acc = plAccounts.get(line.accountId);
          const entry = aggPl.get(line.accountId) || { debit: 0, credit: 0, type: (acc?.type || '').toLowerCase() };
          if (line.type === 'Debit') entry.debit += Number(line.amount || 0);
          else entry.credit += Number(line.amount || 0);
          aggPl.set(line.accountId, entry);
        }
      }
    }
    if (snap.size < 300) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  // Net profit (retained earnings)
  let netProfit = 0;
  for (const [, entry] of aggPl) {
    const accType = entry.type === 'expense' ? 'expense' : 'revenue';
    if (accType === 'revenue') netProfit += (entry.credit - entry.debit);
    else netProfit -= (entry.debit - entry.credit);
  }
  netProfit = Number(netProfit.toFixed(2));

  // Compute closing balances for BS accounts
  const openingLines: any[] = [];
  for (const [accId, acc] of bsAccounts.entries()) {
    const sums = aggBs.get(accId) || { debit: 0, credit: 0 };
    const type = (acc.type || '').toLowerCase();
    const natureDebit = type === 'asset';
    let closing = natureDebit ? (sums.debit - sums.credit) : (sums.credit - sums.debit);
    // Add retained earnings to selected account
    if (accId === retainedAccountId) {
      closing += netProfit;
    }
    closing = Number(closing.toFixed(2));
    if (closing !== 0) {
      openingLines.push({
        accountId: accId,
        code: acc.code || '',
        name: acc.name || accId,
        bsGroup: (acc.bsGroup as BalanceSheetGroupKey) || defaultBsGroup(acc.type),
        openingBalance: closing,
      });
    }
  }

  // Next fiscal year periodId
  const year = Number(periodId.slice(0, 4));
  const nextYear = year + 1;
  const nextPeriodId = `${nextYear}-01`;
  const nextStart = new Date(`${nextYear}-01-01T00:00:00Z`);
  const nextEnd = new Date(`${nextYear}-12-31T23:59:59Z`);
  const nextPeriodRef = db.doc(`companies/${companyId}/accounting_periods/${nextPeriodId}`);

  await db.runTransaction(async (trx) => {
    // Set next period open (create if missing)
    const npSnap = await trx.get(nextPeriodRef);
    if (!npSnap.exists) {
      trx.set(nextPeriodRef, {
        companyId,
        startDate: admin.firestore.Timestamp.fromDate(nextStart),
        endDate: admin.firestore.Timestamp.fromDate(nextEnd),
        status: 'open',
        isFiscalYear: true,
        yearClosed: false,
        openingBalancesCreated: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      trx.set(nextPeriodRef, {
        status: 'open',
        isFiscalYear: npSnap.data()?.isFiscalYear ?? true,
        yearClosed: false,
      }, { merge: true });
    }

    // Write opening balances
    const obCollection = db.collection(`companies/${companyId}/opening_balances/${nextPeriodId}/lines`);
    for (const line of openingLines) {
      const lineRef = obCollection.doc(line.accountId);
      trx.set(lineRef, {
        ...line,
        periodId: nextPeriodId,
        companyId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Update current period flags
    trx.set(periodRef, {
      yearClosed: true,
      openingBalancesCreated: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return {
    success: true,
    fiscalYear: periodId,
    nextFiscalYear: nextPeriodId,
    retainedEarningsAmount: netProfit,
    openingBalancesCount: openingLines.length,
  };
});
export const copyFinancialTemplateToCompany = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === "string" ? data.companyId : undefined;
  const templateId: string | undefined = typeof data?.templateId === "string" ? data.templateId : undefined;
  await assertCompanyRole(context, companyId || "", ["Owner", "Admin"]);
  if (!companyId || !templateId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId and templateId are required.");
  }
  await performTemplateCopy(companyId, templateId);
  return { ok: true };
});

export const syncFinancialTemplates = functions.https.onCall(async (_data, context) => {
  await assertSuperAdmin(context);
  const batch = db.batch();
  financialTemplateSeeds.forEach(seed => {
    const ref = db.doc(`financial_templates/${seed.id}`);
    const sanitizedAccounts = (seed.accounts || []).map(acc => ({
      ...acc,
      parentCode: typeof acc.parentCode === "string" && acc.parentCode.length ? acc.parentCode : null,
    }));
    batch.set(ref, {
      ...seed,
      accounts: sanitizedAccounts,
    }, { merge: true });
  });
  await batch.commit();
  return { count: financialTemplateSeeds.length };
});

export const fixCompanyAccountParents = functions.https.onCall(async (data, context) => {
  const companyId: string | undefined = typeof data?.companyId === 'string' ? data.companyId : undefined;
  if (!companyId) {
    throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
  }
  await assertCompanyRole(context, companyId, ['Owner', 'Admin']);
  const updated = await backfillCompanyAccountParents(companyId);
  return { updated };
});
