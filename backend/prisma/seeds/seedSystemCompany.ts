/**
 * seedSystemCompany.ts — Reserved SYSTEM sentinel Company [275c]
 *
 * PostgreSQL enforces the foreign key `companyId -> Company.id` that Firestore
 * ignored. System-level templates (voucher type definitions, etc.) are written
 * with companyId = 'SYSTEM', so a parent Company row with id = 'SYSTEM' must
 * exist first or those inserts violate the FK.
 *
 * This sentinel has NO CompanyUser memberships, so it never appears in any
 * user's company list — company listings are always scoped by membership.
 * It exists purely as the anchor for system-template rows.
 *
 * Idempotent: upsert by id.
 */

import { PrismaClient } from '@prisma/client';

export const SYSTEM_COMPANY_ID = 'SYSTEM';

export async function seedSystemCompany(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding reserved SYSTEM sentinel company...');

  const epoch = new Date('1970-01-01T00:00:00.000Z');

  await prisma.company.upsert({
    where: { id: SYSTEM_COMPANY_ID },
    update: {},
    create: {
      id: SYSTEM_COMPANY_ID,
      name: 'SYSTEM (reserved)',
      ownerId: SYSTEM_COMPANY_ID,
      taxId: SYSTEM_COMPANY_ID,
      baseCurrency: 'USD',
      fiscalYearStart: epoch,
      fiscalYearEnd: epoch,
      modules: [],
      features: [],
    },
  });

  console.log('  ✓ SYSTEM sentinel company present');
}
