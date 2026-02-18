import * as admin from 'firebase-admin';

import { FiscalYear, FiscalYearStatus, FiscalPeriod, PeriodStatus, PeriodScheme } from '../../../../domain/accounting/entities/FiscalYear';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';

const toDomain = (id: string, data: any): FiscalYear => {
  const periods: FiscalPeriod[] = (data.periods || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status as PeriodStatus,
    closedAt: p.closedAt ? p.closedAt.toDate?.() || new Date(p.closedAt) : undefined,
    closedBy: p.closedBy,
    lockedAt: p.lockedAt ? p.lockedAt.toDate?.() || new Date(p.lockedAt) : undefined,
    lockedBy: p.lockedBy,
    metadata: p.metadata || {},
    periodNo: p.periodNo || 0,
    isSpecial: p.isSpecial || false
  }));

  // Backward Compatibility: Default to MONTHLY if missing
  // Strict Allow-List check
  let scheme = data.periodScheme;
  if (!Object.values(PeriodScheme).includes(scheme)) {
      scheme = PeriodScheme.MONTHLY;
  }

  return new FiscalYear(
    id,
    data.companyId,
    data.name,
    data.startDate,
    data.endDate,
    data.status as FiscalYearStatus,
    periods,
    data.closingVoucherId,
    data.createdAt ? data.createdAt.toDate?.() || new Date(data.createdAt) : undefined,
    data.createdBy,
    scheme,
    data.specialPeriodsCount || 0
  );
};

const toPersistence = (f: FiscalYear) => ({
  companyId: f.companyId,
  name: f.name,
  startDate: f.startDate,
  endDate: f.endDate,
  status: f.status,
  periods: f.periods.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    closedAt: p.closedAt || null,
    closedBy: p.closedBy || null,
    lockedAt: p.lockedAt || null,
    lockedBy: p.lockedBy || null,
    metadata: p.metadata || null,
    periodNo: p.periodNo,
    isSpecial: p.isSpecial
  })),
  closingVoucherId: f.closingVoucherId || null,
  createdAt: f.createdAt || admin.firestore.FieldValue.serverTimestamp(),
  createdBy: f.createdBy || null,
  periodScheme: f.periodScheme,
  specialPeriodsCount: f.specialPeriodsCount || 0
});

export class FirestoreFiscalYearRepository implements IFiscalYearRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private collection(companyId: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('accounting')
      .doc('Data')
      .collection('fiscalYears');
  }

  async findByCompany(companyId: string): Promise<FiscalYear[]> {
    const snap = await this.collection(companyId).orderBy('startDate', 'desc').get();
    return snap.docs.map((d) => toDomain(d.id, d.data()));
  }

  async findById(companyId: string, id: string): Promise<FiscalYear | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return toDomain(doc.id, doc.data());
  }

  async findActiveForDate(companyId: string, date: string): Promise<FiscalYear | null> {
    // Query by startDate <= date, then filter by endDate in memory to avoid composite range issues
    const snap = await this.collection(companyId)
      .where('startDate', '<=', date)
      .orderBy('startDate', 'desc')
      .limit(3)
      .get();

    const match = snap.docs
      .map((d) => toDomain(d.id, d.data()))
      .find((fy) => fy.endDate >= date);

    return match || null;
  }

  async save(fiscalYear: FiscalYear): Promise<void> {
    await this.collection(fiscalYear.companyId).doc(fiscalYear.id).set(toPersistence(fiscalYear));
  }

  async update(fiscalYear: FiscalYear): Promise<void> {
    await this.collection(fiscalYear.companyId).doc(fiscalYear.id).set(toPersistence(fiscalYear), { merge: true });
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.collection(companyId).doc(id).delete();
  }

}
