/**
 * seed-demo-tenant.ts
 *
 * Full demo-grade seed: 10 customers, 2 vendors, 100+ grocery items,
 * 20+ sales transactions, returns, receipts, payments, journal vouchers.
 *
 * Builds on the proven DI wiring from seed-audit-tenant.ts (Phase 1b).
 *
 * Prerequisite:
 *   Company already created in UI with all 4 modules initialized
 *   (Accounting + Inventory + Sales + Purchases) and a COA template applied.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/seed-demo-tenant.ts --companyId <id> [--dry-run] [--skip-txn]
 *
 * Flags:
 *   --dry-run     Preview master data without writing
 *   --skip-txn    Seed master data + OV only, skip transactions
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

type Args = { companyId: string; userId: string; dryRun: boolean; skipTxn: boolean };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const companyId = get('companyId');
  if (!companyId) { console.error('ERROR: --companyId <id> required'); process.exit(1); }
  return {
    companyId: companyId!,
    userId: get('userId') || 'seed-demo',
    dryRun: argv.includes('--dry-run'),
    skipTxn: argv.includes('--skip-txn'),
  };
}

// ---------------------------------------------------------------------------
// Account resolution (same as seed-test-tenant)
// ---------------------------------------------------------------------------

type AccountRow = { id: string; code: string; name: string; classification: string; parentId?: string; active?: boolean };

async function loadAccounts(db: FirebaseFirestore.Firestore, companyId: string): Promise<AccountRow[]> {
  const snap = await db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('accounts').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id || d.id,
      code: String(data.userCode || data.code || ''),
      name: data.name || '',
      classification: (data.classification || '').toString().toUpperCase(),
      parentId: data.parentId,
      active: data.status === 'ACTIVE' || data.active !== false,
    };
  });
}

function pickAccount(rows: AccountRow[], cls: string, pats: RegExp[]): AccountRow | null {
  const isParent = new Set<string>();
  rows.forEach((r) => { if (r.parentId) isParent.add(r.parentId); });
  const cands = rows.filter((r) => r.active && !isParent.has(r.id) && r.classification === cls);
  for (const re of pats) { const h = cands.find((r) => re.test(r.name) || re.test(r.code)); if (h) return h; }
  return null;
}

type Accounts = { ar: AccountRow; revenue: AccountRow; inventory: AccountRow; cogs: AccountRow; ap: AccountRow; cash: AccountRow; tax: AccountRow; openingEquity: AccountRow };

function resolveAccounts(rows: AccountRow[]): Accounts {
  const r = {
    ar: pickAccount(rows, 'ASSET', [/accounts?.receivable/i, /\breceivable\b/i]),
    revenue: pickAccount(rows, 'REVENUE', [/sales\s*revenue/i, /\brevenue\b/i]),
    inventory: pickAccount(rows, 'ASSET', [/finished\s*goods/i, /\binventory\b/i]),
    cogs: pickAccount(rows, 'EXPENSE', [/cost\s*of\s*goods/i, /cost\s*of\s*sales/i, /\bcogs\b/i]),
    ap: pickAccount(rows, 'LIABILITY', [/accounts?.payable/i, /\bpayable\b/i]),
    cash: pickAccount(rows, 'ASSET', [/cash\s*on\s*hand/i, /\bcash\b/i, /\bbank\b/i]),
    tax: pickAccount(rows, 'LIABILITY', [/sales\s*tax/i, /\bvat\s*payable\b/i, /\btax\s*payable\b/i, /\bvat\b/i, /\btax\b/i]),
    openingEquity: pickAccount(rows, 'EQUITY', [/opening\s*balance/i, /paid.?in\s*capital/i, /capital/i]),
  };
  for (const [k, v] of Object.entries(r)) {
    if (!v) { console.error(`Cannot resolve account: ${k}`); process.exit(1); }
  }
  return r as Accounts;
}

// ---------------------------------------------------------------------------
// Grocery items (100+)
// ---------------------------------------------------------------------------

interface ItemDef { code: string; name: string; type: 'PRODUCT' | 'SERVICE'; cost: number; price: number; uom: string; category: string }

const GROCERY_ITEMS: ItemDef[] = [
  // Fruits (15)
  { code: 'FRT-001', name: 'Bananas', type: 'PRODUCT', cost: 0.50, price: 0.99, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-002', name: 'Apples (Red)', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-003', name: 'Oranges', type: 'PRODUCT', cost: 0.80, price: 1.79, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-004', name: 'Strawberries', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-005', name: 'Grapes (Green)', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-006', name: 'Watermelon', type: 'PRODUCT', cost: 3.00, price: 5.99, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-007', name: 'Mangoes', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-008', name: 'Pineapple', type: 'PRODUCT', cost: 2.00, price: 3.99, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-009', name: 'Avocados', type: 'PRODUCT', cost: 1.00, price: 1.99, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-010', name: 'Lemons', type: 'PRODUCT', cost: 0.40, price: 0.89, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-011', name: 'Blueberries', type: 'PRODUCT', cost: 3.00, price: 5.49, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-012', name: 'Peaches', type: 'PRODUCT', cost: 1.60, price: 2.99, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-013', name: 'Cherries', type: 'PRODUCT', cost: 4.00, price: 7.99, uom: 'KG', category: 'Fruits' },
  { code: 'FRT-014', name: 'Kiwi', type: 'PRODUCT', cost: 0.60, price: 1.29, uom: 'PCS', category: 'Fruits' },
  { code: 'FRT-015', name: 'Pomegranate', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'PCS', category: 'Fruits' },

  // Vegetables (15)
  { code: 'VEG-001', name: 'Tomatoes', type: 'PRODUCT', cost: 0.90, price: 1.99, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-002', name: 'Onions', type: 'PRODUCT', cost: 0.50, price: 1.19, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-003', name: 'Potatoes', type: 'PRODUCT', cost: 0.40, price: 0.99, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-004', name: 'Carrots', type: 'PRODUCT', cost: 0.60, price: 1.29, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-005', name: 'Broccoli', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-006', name: 'Spinach', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-007', name: 'Bell Peppers', type: 'PRODUCT', cost: 1.00, price: 1.99, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-008', name: 'Cucumbers', type: 'PRODUCT', cost: 0.40, price: 0.89, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-009', name: 'Lettuce', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-010', name: 'Garlic', type: 'PRODUCT', cost: 0.30, price: 0.69, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-011', name: 'Mushrooms', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-012', name: 'Zucchini', type: 'PRODUCT', cost: 0.70, price: 1.49, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-013', name: 'Corn on the Cob', type: 'PRODUCT', cost: 0.50, price: 0.99, uom: 'PCS', category: 'Vegetables' },
  { code: 'VEG-014', name: 'Green Beans', type: 'PRODUCT', cost: 1.10, price: 2.29, uom: 'KG', category: 'Vegetables' },
  { code: 'VEG-015', name: 'Cauliflower', type: 'PRODUCT', cost: 1.30, price: 2.69, uom: 'PCS', category: 'Vegetables' },

  // Dairy (12)
  { code: 'DRY-001', name: 'Whole Milk (1L)', type: 'PRODUCT', cost: 0.80, price: 1.59, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-002', name: 'Greek Yogurt', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-003', name: 'Cheddar Cheese', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-004', name: 'Butter (250g)', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-005', name: 'Cream Cheese', type: 'PRODUCT', cost: 1.00, price: 1.99, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-006', name: 'Eggs (Dozen)', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-007', name: 'Mozzarella', type: 'PRODUCT', cost: 2.00, price: 3.99, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-008', name: 'Sour Cream', type: 'PRODUCT', cost: 0.90, price: 1.79, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-009', name: 'Heavy Cream', type: 'PRODUCT', cost: 1.60, price: 3.19, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-010', name: 'Parmesan', type: 'PRODUCT', cost: 3.50, price: 6.99, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-011', name: 'Skim Milk (1L)', type: 'PRODUCT', cost: 0.70, price: 1.39, uom: 'PCS', category: 'Dairy' },
  { code: 'DRY-012', name: 'Cottage Cheese', type: 'PRODUCT', cost: 1.30, price: 2.59, uom: 'PCS', category: 'Dairy' },

  // Bakery (10)
  { code: 'BKR-001', name: 'White Bread', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-002', name: 'Whole Wheat Bread', type: 'PRODUCT', cost: 1.00, price: 2.19, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-003', name: 'Croissants (4-pack)', type: 'PRODUCT', cost: 1.50, price: 3.29, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-004', name: 'Bagels (6-pack)', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-005', name: 'Tortillas (10-pack)', type: 'PRODUCT', cost: 0.90, price: 1.89, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-006', name: 'Hamburger Buns', type: 'PRODUCT', cost: 0.70, price: 1.49, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-007', name: 'Pita Bread', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-008', name: 'Sourdough Loaf', type: 'PRODUCT', cost: 1.80, price: 3.99, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-009', name: 'Dinner Rolls (12)', type: 'PRODUCT', cost: 1.00, price: 2.29, uom: 'PCS', category: 'Bakery' },
  { code: 'BKR-010', name: 'Naan Bread', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Bakery' },

  // Meat & Protein (12)
  { code: 'MEA-001', name: 'Chicken Breast', type: 'PRODUCT', cost: 3.50, price: 6.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-002', name: 'Ground Beef', type: 'PRODUCT', cost: 4.00, price: 7.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-003', name: 'Salmon Fillet', type: 'PRODUCT', cost: 6.00, price: 11.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-004', name: 'Pork Chops', type: 'PRODUCT', cost: 3.00, price: 5.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-005', name: 'Turkey Breast', type: 'PRODUCT', cost: 4.50, price: 8.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-006', name: 'Shrimp (Peeled)', type: 'PRODUCT', cost: 5.00, price: 9.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-007', name: 'Bacon', type: 'PRODUCT', cost: 3.50, price: 6.49, uom: 'PCS', category: 'Meat' },
  { code: 'MEA-008', name: 'Sausages', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Meat' },
  { code: 'MEA-009', name: 'Lamb Leg', type: 'PRODUCT', cost: 7.00, price: 13.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-010', name: 'Tuna Steak', type: 'PRODUCT', cost: 5.50, price: 10.99, uom: 'KG', category: 'Meat' },
  { code: 'MEA-011', name: 'Chicken Wings', type: 'PRODUCT', cost: 2.80, price: 5.49, uom: 'KG', category: 'Meat' },
  { code: 'MEA-012', name: 'Beef Steak', type: 'PRODUCT', cost: 8.00, price: 15.99, uom: 'KG', category: 'Meat' },

  // Pantry / Dry Goods (15)
  { code: 'PNT-001', name: 'White Rice (1kg)', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-002', name: 'Pasta (500g)', type: 'PRODUCT', cost: 0.60, price: 1.29, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-003', name: 'Olive Oil (500ml)', type: 'PRODUCT', cost: 3.00, price: 5.99, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-004', name: 'Canned Tomatoes', type: 'PRODUCT', cost: 0.50, price: 0.99, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-005', name: 'Peanut Butter', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-006', name: 'Cereal (500g)', type: 'PRODUCT', cost: 1.50, price: 3.29, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-007', name: 'Flour (1kg)', type: 'PRODUCT', cost: 0.40, price: 0.89, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-008', name: 'Sugar (1kg)', type: 'PRODUCT', cost: 0.50, price: 1.09, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-009', name: 'Canned Beans', type: 'PRODUCT', cost: 0.40, price: 0.89, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-010', name: 'Soy Sauce', type: 'PRODUCT', cost: 1.00, price: 2.19, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-011', name: 'Honey (500g)', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-012', name: 'Coffee Beans (250g)', type: 'PRODUCT', cost: 3.50, price: 6.99, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-013', name: 'Tea Bags (100)', type: 'PRODUCT', cost: 2.00, price: 3.99, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-014', name: 'Salt (500g)', type: 'PRODUCT', cost: 0.20, price: 0.49, uom: 'PCS', category: 'Pantry' },
  { code: 'PNT-015', name: 'Black Pepper', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Pantry' },

  // Beverages (10)
  { code: 'BEV-001', name: 'Orange Juice (1L)', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-002', name: 'Mineral Water (6-pack)', type: 'PRODUCT', cost: 1.00, price: 1.99, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-003', name: 'Cola (2L)', type: 'PRODUCT', cost: 0.80, price: 1.79, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-004', name: 'Apple Juice (1L)', type: 'PRODUCT', cost: 1.00, price: 2.19, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-005', name: 'Lemonade (1L)', type: 'PRODUCT', cost: 0.90, price: 1.89, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-006', name: 'Sparkling Water (6-pack)', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-007', name: 'Coconut Water', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-008', name: 'Iced Tea (1L)', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-009', name: 'Energy Drink', type: 'PRODUCT', cost: 1.00, price: 2.29, uom: 'PCS', category: 'Beverages' },
  { code: 'BEV-010', name: 'Almond Milk (1L)', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Beverages' },

  // Frozen (8)
  { code: 'FRZ-001', name: 'Frozen Pizza', type: 'PRODUCT', cost: 2.00, price: 4.29, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-002', name: 'Ice Cream (1L)', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-003', name: 'Frozen Peas', type: 'PRODUCT', cost: 0.80, price: 1.69, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-004', name: 'Frozen Fries', type: 'PRODUCT', cost: 1.00, price: 2.19, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-005', name: 'Fish Sticks', type: 'PRODUCT', cost: 1.50, price: 3.29, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-006', name: 'Frozen Berries Mix', type: 'PRODUCT', cost: 2.00, price: 3.99, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-007', name: 'Frozen Corn', type: 'PRODUCT', cost: 0.70, price: 1.49, uom: 'PCS', category: 'Frozen' },
  { code: 'FRZ-008', name: 'Frozen Dumplings', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Frozen' },

  // Snacks (8)
  { code: 'SNK-001', name: 'Potato Chips', type: 'PRODUCT', cost: 1.00, price: 2.29, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-002', name: 'Chocolate Bar', type: 'PRODUCT', cost: 0.60, price: 1.29, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-003', name: 'Mixed Nuts', type: 'PRODUCT', cost: 2.50, price: 4.99, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-004', name: 'Granola Bars (6)', type: 'PRODUCT', cost: 1.50, price: 2.99, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-005', name: 'Popcorn', type: 'PRODUCT', cost: 0.80, price: 1.79, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-006', name: 'Cookies', type: 'PRODUCT', cost: 1.20, price: 2.49, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-007', name: 'Trail Mix', type: 'PRODUCT', cost: 2.00, price: 3.99, uom: 'PCS', category: 'Snacks' },
  { code: 'SNK-008', name: 'Dried Fruit', type: 'PRODUCT', cost: 1.80, price: 3.49, uom: 'PCS', category: 'Snacks' },

  // Services (3)
  { code: 'SVC-001', name: 'Home Delivery', type: 'SERVICE', cost: 0, price: 5.00, uom: 'EA', category: 'Services' },
  { code: 'SVC-002', name: 'Gift Wrapping', type: 'SERVICE', cost: 0, price: 2.50, uom: 'EA', category: 'Services' },
  { code: 'SVC-003', name: 'Catering Setup Fee', type: 'SERVICE', cost: 0, price: 50.00, uom: 'EA', category: 'Services' },
];

// ---------------------------------------------------------------------------
// Customer and Vendor definitions
// ---------------------------------------------------------------------------

interface PartyDef { code: string; legalName: string; displayName: string; role: 'CUSTOMER' | 'VENDOR'; terms: number }

const CUSTOMERS: PartyDef[] = [
  { code: 'CUST-001', legalName: 'Sunrise Grocery Co', displayName: 'Sunrise Grocery', role: 'CUSTOMER', terms: 30 },
  { code: 'CUST-002', legalName: 'Green Valley Market LLC', displayName: 'Green Valley Market', role: 'CUSTOMER', terms: 15 },
  { code: 'CUST-003', legalName: 'Downtown Deli & Cafe', displayName: 'Downtown Deli', role: 'CUSTOMER', terms: 7 },
  { code: 'CUST-004', legalName: 'Riverside Restaurant Group', displayName: 'Riverside Restaurant', role: 'CUSTOMER', terms: 30 },
  { code: 'CUST-005', legalName: 'Happy Meals Catering', displayName: 'Happy Meals', role: 'CUSTOMER', terms: 15 },
  { code: 'CUST-006', legalName: 'Seaside Hotel & Resort', displayName: 'Seaside Hotel', role: 'CUSTOMER', terms: 45 },
  { code: 'CUST-007', legalName: 'Campus Fresh Supply', displayName: 'Campus Fresh', role: 'CUSTOMER', terms: 30 },
  { code: 'CUST-008', legalName: 'QuickMart Express', displayName: 'QuickMart', role: 'CUSTOMER', terms: 7 },
  { code: 'CUST-009', legalName: 'Hilltop Bakery & Cafe', displayName: 'Hilltop Bakery', role: 'CUSTOMER', terms: 15 },
  { code: 'CUST-010', legalName: 'The Organic Pantry Inc', displayName: 'Organic Pantry', role: 'CUSTOMER', terms: 30 },
];

const VENDORS: PartyDef[] = [
  { code: 'VEND-001', legalName: 'FarmDirect Wholesale Corp', displayName: 'FarmDirect', role: 'VENDOR', terms: 30 },
  { code: 'VEND-002', legalName: 'Pacific Coast Distributors', displayName: 'Pacific Coast', role: 'VENDOR', terms: 45 },
];

// ---------------------------------------------------------------------------
// Master data seeding
// ---------------------------------------------------------------------------

async function seedAllItems(
  db: FirebaseFirestore.Firestore, companyId: string, userId: string,
  accounts: Accounts, taxCodeId: string, dryRun: boolean,
): Promise<Map<string, { id: string; def: ItemDef }>> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('items');
  const now = new Date();

  // Load existing by code for idempotency
  const allCodes = GROCERY_ITEMS.map(i => i.code);
  const existingByCode = new Map<string, string>();
  // Firestore 'in' limited to 30, batch queries
  for (let i = 0; i < allCodes.length; i += 30) {
    const batch = allCodes.slice(i, i + 30);
    const snap = await col.where('code', 'in', batch).get();
    snap.docs.forEach(d => { const data = d.data(); existingByCode.set(data.code, data.id || d.id); });
  }

  const result = new Map<string, { id: string; def: ItemDef }>();
  let created = 0, reused = 0;
  const writeBatch = db.batch();

  for (const item of GROCERY_ITEMS) {
    const id = existingByCode.get(item.code) || randomUUID();
    const isProduct = item.type === 'PRODUCT';
    const doc: any = {
      id, companyId, code: item.code, name: item.name,
      type: item.type, baseUom: item.uom, costCurrency: 'USD',
      costingMethod: 'MOVING_AVG', trackInventory: isProduct,
      revenueAccountId: accounts.revenue.id,
      defaultSalesTaxCodeId: taxCodeId,
      active: true, createdBy: userId, createdAt: now, updatedAt: now,
      seedCategory: item.category,
    };
    if (isProduct) {
      doc.cogsAccountId = accounts.cogs.id;
      doc.inventoryAssetAccountId = accounts.inventory.id;
    }
    if (!dryRun) writeBatch.set(col.doc(id), doc, { merge: true });
    result.set(item.code, { id, def: item });
    if (existingByCode.has(item.code)) reused++; else created++;
  }

  if (!dryRun) await writeBatch.commit();
  console.log(`✓ Items: ${created} created, ${reused} reused (${GROCERY_ITEMS.length} total)`);
  return result;
}

async function seedAllParties(
  db: FirebaseFirestore.Firestore, companyId: string, userId: string,
  accounts: Accounts, allocation: PartyAccountAllocation, dryRun: boolean,
): Promise<{ customerIds: Map<string, string>; vendorIds: Map<string, string> }> {
  const col = db.collection('companies').doc(companyId)
    .collection('shared').doc('Data').collection('parties');
  const now = new Date();

  const allCodes = [...CUSTOMERS, ...VENDORS].map(p => p.code);
  const existingByCode = new Map<string, string>();
  for (let i = 0; i < allCodes.length; i += 30) {
    const batch = allCodes.slice(i, i + 30);
    const snap = await col.where('code', 'in', batch).get();
    snap.docs.forEach(d => { const data = d.data(); existingByCode.set(data.code, data.id || d.id); });
  }

  const customerIds = new Map<string, string>();
  const vendorIds = new Map<string, string>();
  const writeBatch = db.batch();
  let created = 0;
  let subAcct = 0;
  let general = 0;

  for (const p of [...CUSTOMERS, ...VENDORS]) {
    const id = existingByCode.get(p.code) || randomUUID();
    const isCustomer = p.role === 'CUSTOMER';
    // Pick per-party account if allocated, else fall back to General AP/AR (control model).
    const leafId = allocation.perParty.get(p.code);
    const acctId = leafId
      || (isCustomer ? allocation.generalAR.id : allocation.generalAP.id);
    if (leafId) subAcct++; else general++;

    const doc: any = {
      id, companyId, code: p.code, legalName: p.legalName, displayName: p.displayName,
      roles: [p.role], paymentTermsDays: p.terms, defaultCurrency: 'USD',
      creditHoldPolicy: 'NONE', active: true,
      createdBy: userId, createdAt: now, updatedAt: now,
    };
    if (isCustomer) doc.defaultARAccountId = acctId;
    else doc.defaultAPAccountId = acctId;

    if (!dryRun) writeBatch.set(col.doc(id), doc, { merge: true });
    if (isCustomer) customerIds.set(p.code, id);
    else vendorIds.set(p.code, id);
    if (!existingByCode.has(p.code)) created++;
  }

  if (!dryRun) await writeBatch.commit();
  console.log(`✓ Parties: ${CUSTOMERS.length} customers + ${VENDORS.length} vendors (${created} new)`);
  console.log(`  Binding: ${subAcct} sub-account model | ${general} control-account (General AP/AR) model`);
  return { customerIds, vendorIds };
}

async function seedWarehouse(db: FirebaseFirestore.Firestore, companyId: string, userId: string, dryRun: boolean): Promise<string> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('warehouses');
  const existing = await col.limit(1).get();
  if (!existing.empty) {
    const wh = existing.docs[0].data();
    const id = wh.id || existing.docs[0].id;
    console.log(`✓ Warehouse: ${wh.code || wh.name || id}`);
    return id;
  }
  const id = randomUUID();
  const doc = { id, companyId, code: 'WH-MAIN', name: 'Main Warehouse', active: true, isDefault: true, createdBy: userId, createdAt: new Date(), updatedAt: new Date() };
  if (!dryRun) await col.doc(id).set(doc);
  console.log('+ Warehouse WH-MAIN');
  return id;
}

async function seedTaxCode(db: FirebaseFirestore.Firestore, companyId: string, userId: string, taxAccount: AccountRow, dryRun: boolean): Promise<string> {
  const col = db.collection('companies').doc(companyId)
    .collection('shared').doc('Data').collection('tax_codes');
  const existing = await col.where('code', '==', 'TAX10').limit(1).get();
  if (!existing.empty) {
    const data = existing.docs[0].data();
    const id = data.id || existing.docs[0].id;
    console.log(`✓ Tax code TAX10 (id=${id.slice(0, 8)}...)`);
    return id;
  }
  const id = randomUUID();
  const doc = { id, companyId, code: 'TAX10', name: '10% Sales Tax', rate: 0.10, taxType: 'VAT', scope: 'BOTH',
    salesTaxAccountId: taxAccount.id, purchaseTaxAccountId: taxAccount.id, priceIsInclusive: false,
    active: true, createdBy: userId, createdAt: new Date(), updatedAt: new Date() };
  if (!dryRun) await col.doc(id).set(doc);
  console.log('+ Tax code TAX10');
  return id;
}

// ---------------------------------------------------------------------------
// Opening stock for all PRODUCT items
// ---------------------------------------------------------------------------

async function seedAndPostOpeningStock(
  db: FirebaseFirestore.Firestore, companyId: string, userId: string,
  items: Map<string, { id: string; def: ItemDef }>, warehouseId: string,
  accounts: Accounts, dryRun: boolean,
): Promise<number> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('opening_stock_documents');

  // Check if a seed OV already exists (posted or draft)
  const existing = await col.where('seedTag', '==', 'seed-demo-tenant').get();
  const posted = existing.docs.find(d => d.data().status === 'POSTED');
  if (posted) {
    const data = posted.data();
    console.log(`✓ OV already POSTED (id=${(data.id || posted.id).slice(0, 8)}...) — skipping`);
    return data.lines?.reduce((s: number, l: any) => s + (l.totalValueBase || 0), 0) || 0;
  }
  // Delete any leftover drafts
  for (const d of existing.docs) {
    if (d.data().status === 'DRAFT') await d.ref.delete();
  }

  // Build OV with all PRODUCT items, quantity based on cost tier
  const allLines: any[] = [];
  let totalValue = 0;
  for (const [, entry] of items) {
    if (entry.def.type !== 'PRODUCT') continue;
    const qty = entry.def.cost < 1 ? 200 : entry.def.cost < 3 ? 100 : 50;
    const lineValue = +(qty * entry.def.cost).toFixed(2);
    totalValue += lineValue;
    allLines.push({
      lineId: randomUUID(), itemId: entry.id,
      quantity: qty, unitCostInMoveCurrency: entry.def.cost,
      moveCurrency: 'USD', fxRateMovToBase: 1, fxRateCCYToBase: 1,
      unitCostBase: entry.def.cost, totalValueBase: lineValue,
    });
  }

  if (dryRun) {
    console.log(`  [dry-run] OV: ${allLines.length} items, total value $${totalValue.toFixed(2)}`);
    return totalValue;
  }

  // Lazy-load DI once
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { PostOpeningStockDocumentUseCase } = await import('../src/application/inventory/use-cases/OpeningStockDocumentUseCases');
  const { SubledgerVoucherPostingService } = await import('../src/application/accounting/services/SubledgerVoucherPostingService');
  const { VoucherValidationService } = await import('../src/domain/accounting/services/VoucherValidationService');
  const { RecordStockMovementUseCase } = await import('../src/application/inventory/use-cases/RecordStockMovementUseCase');

  const postingService = new SubledgerVoucherPostingService(
    diContainer.voucherRepository, diContainer.ledgerRepository,
    diContainer.companyCurrencyRepository, diContainer.accountRepository,
    new VoucherValidationService(), diContainer.periodLockService,
  );
  const movementUC = new RecordStockMovementUseCase({
    itemRepository: diContainer.itemRepository, warehouseRepository: diContainer.warehouseRepository,
    stockMovementRepository: diContainer.stockMovementRepository, stockLevelRepository: diContainer.stockLevelRepository,
    companyRepository: diContainer.companyRepository, inventorySettingsRepository: diContainer.inventorySettingsRepository,
    transactionManager: diContainer.transactionManager,
  });
  const postOV = new PostOpeningStockDocumentUseCase(
    diContainer.openingStockDocumentRepository, diContainer.itemRepository,
    diContainer.itemCategoryRepository, diContainer.warehouseRepository,
    diContainer.inventorySettingsRepository, diContainer.companyRepository,
    diContainer.companyModuleRepository, diContainer.accountRepository,
    movementUC, postingService, diContainer.transactionManager,
  );

  // Split into batches of 10 items per OV to stay within Firestore transaction limits
  // Firestore transactions require reads-before-writes; the OV use case
  // interleaves per-line, so we must limit to 1 item per OV document.
  const BATCH_SIZE = 1;
  const batches: any[][] = [];
  for (let i = 0; i < allLines.length; i += BATCH_SIZE) {
    batches.push(allLines.slice(i, i + BATCH_SIZE));
  }

  console.log(`+ OV: ${allLines.length} product lines in ${batches.length} batches, total $${totalValue.toFixed(2)}`);

  for (let b = 0; b < batches.length; b++) {
    const batchLines = batches[b];
    const batchValue = +(batchLines.reduce((s: number, l: any) => s + l.totalValueBase, 0)).toFixed(2);
    const batchId = randomUUID();
    const ovDoc = {
      id: batchId, companyId, warehouseId, status: 'DRAFT',
      date: new Date().toISOString().slice(0, 10),
      lines: batchLines, totalValueBase: batchValue,
      openingBalanceAccountId: accounts.openingEquity.id,
      notes: `Seeded OV batch ${b + 1}/${batches.length}`, seedTag: 'seed-demo-tenant',
      createdBy: userId, createdAt: new Date(), updatedAt: new Date(),
    };
    await col.doc(batchId).set(ovDoc);
    await postOV.execute(companyId, batchId, userId);
    process.stdout.write(`  batch ${b + 1}/${batches.length} ✓  `);
    if ((b + 1) % 5 === 0 || b === batches.length - 1) console.log('');
  }

  console.log(`✓ All OV batches POSTED — $${totalValue.toFixed(2)} (DR Inventory / CR Equity)`);
  return totalValue;
}

// ---------------------------------------------------------------------------
// Transaction seeding — sales, returns, receipts, payments
// ---------------------------------------------------------------------------

async function ensureDirectPurchasePersonaAllowed(db: FirebaseFirestore.Firestore, companyId: string) {
  const ref = db.collection('companies').doc(companyId).collection('purchases').doc('settings');
  const snap = await ref.get();
  const data = snap.data() || {};
  const rules: any[] = data.governanceRules || [];
  const next: any = {};
  if (!rules.some((r: any) => r.persona === 'direct' && r.scope === 'company' && r.action === 'allow')) {
    rules.push({ id: 'seed-direct-purchase-allow', persona: 'direct', scope: 'company', action: 'allow' });
    next.governanceRules = rules;
  }
  if (!data.allowDirectInvoicing) {
    next.allowDirectInvoicing = true;
  }
  if (Object.keys(next).length > 0) {
    await ref.set(next, { merge: true });
  }
}

async function ensureDirectPersonaAllowed(db: FirebaseFirestore.Firestore, companyId: string) {
  const ref = db.collection('companies').doc(companyId).collection('sales').doc('settings');
  const snap = await ref.get();
  const data = snap.data() || {};
  const rules: any[] = data.governanceRules || [];
  if (!rules.some((r: any) => r.persona === 'direct' && r.scope === 'company' && r.action === 'allow')) {
    rules.push({ id: 'seed-direct-allow', persona: 'direct', scope: 'company', action: 'allow' });
    await ref.set({ governanceRules: rules }, { merge: true });
  }
}

async function seedTransactions(
  args: Args, db: FirebaseFirestore.Firestore,
  items: Map<string, { id: string; def: ItemDef }>,
  customerIds: Map<string, string>, vendorIds: Map<string, string>,
  warehouseId: string, taxCodeId: string, accounts: Accounts,
) {
  await ensureDirectPersonaAllowed(db, args.companyId);

  // Build use cases
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { CreateSalesOrderUseCase, ConfirmSalesOrderUseCase } = await import('../src/application/sales/use-cases/SalesOrderUseCases');
  const { CreateDeliveryNoteUseCase, PostDeliveryNoteUseCase } = await import('../src/application/sales/use-cases/DeliveryNoteUseCases');
  const { CreateSalesInvoiceUseCase, PostSalesInvoiceUseCase, CreateAndPostSalesInvoiceUseCase } = await import('../src/application/sales/use-cases/SalesInvoiceUseCases');
  const { CreateSalesReturnUseCase, PostSalesReturnUseCase } = await import('../src/application/sales/use-cases/SalesReturnUseCases');
  const { CreateVoucherUseCase } = await import('../src/application/accounting/use-cases/VoucherUseCases');
  const { RecordStockMovementUseCase } = await import('../src/application/inventory/use-cases/RecordStockMovementUseCase');
  const { SubledgerVoucherPostingService } = await import('../src/application/accounting/services/SubledgerVoucherPostingService');
  const { VoucherValidationService } = await import('../src/domain/accounting/services/VoucherValidationService');
  const { CreditCheckService } = await import('../src/application/sales/services/CreditCheckService');
  const { RecordChangeService } = await import('../src/application/system/services/RecordChangeService');
  const { SalesInventoryService } = await import('../src/application/inventory/services/SalesInventoryService');
  const { AccountValidationService } = await import('../src/application/accounting/services/AccountValidationService');

  const recordChangeService = new RecordChangeService(diContainer.recordChangeLogRepository);
  const movementUC = new RecordStockMovementUseCase({
    itemRepository: diContainer.itemRepository, warehouseRepository: diContainer.warehouseRepository,
    stockMovementRepository: diContainer.stockMovementRepository, stockLevelRepository: diContainer.stockLevelRepository,
    companyRepository: diContainer.companyRepository, inventorySettingsRepository: diContainer.inventorySettingsRepository,
    transactionManager: diContainer.transactionManager,
  });
  const invService = new SalesInventoryService(movementUC);
  const postingSvc = new SubledgerVoucherPostingService(
    diContainer.voucherRepository, diContainer.ledgerRepository,
    diContainer.companyCurrencyRepository, diContainer.accountRepository,
    new VoucherValidationService(), diContainer.periodLockService,
  );
  const creditCheck = new CreditCheckService(diContainer.salesInvoiceRepository);
  const alwaysAllow = { assertOrThrow: async () => {}, hasPermission: async () => true } as any;

  const createSO = new CreateSalesOrderUseCase(diContainer.salesSettingsRepository, diContainer.salesOrderRepository, diContainer.partyRepository, diContainer.itemRepository, diContainer.taxCodeRepository, diContainer.companyCurrencyRepository, diContainer.promotionRuleRepository, recordChangeService);
  const confirmSO = new ConfirmSalesOrderUseCase(diContainer.salesOrderRepository, diContainer.partyRepository, creditCheck, diContainer.creditOverrideRepository);
  const createDN = new CreateDeliveryNoteUseCase(diContainer.salesSettingsRepository, diContainer.deliveryNoteRepository, diContainer.salesOrderRepository, diContainer.partyRepository, diContainer.itemRepository, recordChangeService);
  const postDN = new PostDeliveryNoteUseCase(diContainer.salesSettingsRepository, diContainer.inventorySettingsRepository, diContainer.deliveryNoteRepository, diContainer.salesOrderRepository, diContainer.itemRepository, diContainer.itemCategoryRepository, diContainer.warehouseRepository, diContainer.uomConversionRepository, diContainer.companyCurrencyRepository, invService, diContainer.companyModuleRepository, postingSvc, diContainer.accountRepository, diContainer.transactionManager, recordChangeService);
  const createSI = new CreateSalesInvoiceUseCase(diContainer.salesSettingsRepository, diContainer.salesInvoiceRepository, diContainer.salesOrderRepository, diContainer.partyRepository, diContainer.itemRepository, diContainer.itemCategoryRepository, diContainer.taxCodeRepository, diContainer.companyCurrencyRepository, diContainer.promotionRuleRepository, creditCheck, diContainer.creditOverrideRepository, recordChangeService);
  const postSI = new PostSalesInvoiceUseCase(diContainer.salesSettingsRepository, diContainer.inventorySettingsRepository, diContainer.salesInvoiceRepository, diContainer.salesOrderRepository, diContainer.deliveryNoteRepository, diContainer.partyRepository, diContainer.taxCodeRepository, diContainer.itemRepository, diContainer.itemCategoryRepository, diContainer.warehouseRepository, diContainer.uomConversionRepository, diContainer.companyCurrencyRepository, invService, diContainer.companyModuleRepository, postingSvc, diContainer.accountRepository, diContainer.transactionManager, diContainer.paymentHistoryRepository, diContainer.voucherRepository, diContainer.voucherSequenceRepository, diContainer.ledgerRepository, diContainer.postingLogRepository, recordChangeService);
  const createAndPostSI = new CreateAndPostSalesInvoiceUseCase(createSI, postSI);
  const createSR = new CreateSalesReturnUseCase(diContainer.salesSettingsRepository, diContainer.salesReturnRepository, diContainer.salesInvoiceRepository, diContainer.deliveryNoteRepository, recordChangeService, diContainer.companyCurrencyRepository);
  const postSR = new PostSalesReturnUseCase(diContainer.salesSettingsRepository, diContainer.inventorySettingsRepository, diContainer.salesReturnRepository, diContainer.salesInvoiceRepository, diContainer.deliveryNoteRepository, diContainer.salesOrderRepository, diContainer.partyRepository, diContainer.taxCodeRepository, diContainer.itemRepository, diContainer.itemCategoryRepository, diContainer.uomConversionRepository, diContainer.companyCurrencyRepository, invService, diContainer.companyModuleRepository, postingSvc, diContainer.accountRepository, diContainer.transactionManager, recordChangeService, diContainer.postingLogRepository);
  const createVoucher = new CreateVoucherUseCase(diContainer.voucherRepository, diContainer.accountRepository, diContainer.companyModuleSettingsRepository, alwaysAllow, diContainer.transactionManager, diContainer.voucherTypeDefinitionRepository, diContainer.accountingPolicyConfigProvider, diContainer.ledgerRepository, undefined, diContainer.companyCurrencyRepository, diContainer.voucherSequenceRepository);

  const actor = { userId: args.userId, userEmail: 'seed@demo.local' };
  const itemArr = Array.from(items.values());
  const productItems = itemArr.filter(e => e.def.type === 'PRODUCT');
  const customerCodes = Array.from(customerIds.keys());

  // Helper: pick N random product items
  const pickItems = (n: number) => {
    const shuffled = [...productItems].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  // Helper: date offset from today
  const dateOffset = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  let txCount = 0;

  // ── 10 linked sales (SO → DN → SI) ────────────────────────────────
  console.log('\n--- Seeding 10 linked sales (SO → DN → SI) ---');
  const postedSIs: any[] = [];

  for (let i = 0; i < 10; i++) {
    const custCode = customerCodes[i % customerCodes.length];
    const custId = customerIds.get(custCode)!;
    const lineItems = pickItems(2 + Math.floor(Math.random() * 4)); // 2-5 items
    const orderDate = dateOffset(20 - i);

    const soInput: any = {
      companyId: args.companyId, customerId: custId, warehouseId,
      orderDate, currency: 'USD', exchangeRate: 1,
      lines: lineItems.map(e => ({
        itemId: e.id, orderedQty: 5 + Math.floor(Math.random() * 20),
        unitPriceDoc: e.def.price, taxCodeId, uom: e.def.uom,
      })),
      createdBy: args.userId,
    };
    const so = await createSO.execute(soInput, actor);
    await confirmSO.execute(args.companyId, so.id);

    const dnInput: any = {
      companyId: args.companyId, salesOrderId: so.id, customerId: custId, warehouseId,
      deliveryDate: orderDate,
      lines: so.lines.map((l: any) => ({ soLineId: l.lineId, itemId: l.itemId, deliveredQty: l.orderedQty, uom: l.uom })),
      createdBy: args.userId,
    };
    const dn = await createDN.execute(dnInput, actor);
    const postedDN = await postDN.execute(args.companyId, dn.id, true, undefined, actor);

    const siInput: any = {
      companyId: args.companyId, customerId: custId, salesOrderId: so.id,
      deliveryNoteIds: [dn.id], warehouseId,
      invoiceDate: orderDate, dueDate: dateOffset(20 - i - (CUSTOMERS[i % 10]?.terms || 30)),
      currency: 'USD', exchangeRate: 1, source: 'native', persona: 'linked',
      lines: postedDN.lines.map((l: any) => ({
        dnLineId: l.lineId, soLineId: l.soLineId, itemId: l.itemId,
        invoicedQty: l.deliveredQty, unitPriceDoc: soInput.lines.find((sl: any) => sl.itemId === l.itemId)?.unitPriceDoc || l.unitPriceDoc,
        taxCodeId, uom: l.uom,
      })),
      createdBy: args.userId,
    };
    const siResult = await createAndPostSI.execute(siInput, undefined, undefined, actor);
    const si = (siResult as any).salesInvoice ?? siResult;
    postedSIs.push(si);
    txCount++;
    console.log(`  ${txCount}. SO ${so.orderNumber} → DN → SI ${si.invoiceNumber}  ${custCode}  $${si.grandTotalBase}`);
  }

  // ── 10 direct sales invoices (no SO) ───────────────────────────────
  console.log('\n--- Seeding 10 direct sales invoices ---');
  for (let i = 0; i < 10; i++) {
    const custCode = customerCodes[(i + 5) % customerCodes.length];
    const custId = customerIds.get(custCode)!;
    const lineItems = pickItems(1 + Math.floor(Math.random() * 3));
    const invDate = dateOffset(10 - i);

    const siInput: any = {
      companyId: args.companyId, customerId: custId, warehouseId,
      invoiceDate: invDate, dueDate: dateOffset(10 - i - 30),
      currency: 'USD', exchangeRate: 1, source: 'native', persona: 'direct',
      voucherType: 'sales_invoice',
      lines: lineItems.map(e => ({
        itemId: e.id, invoicedQty: 3 + Math.floor(Math.random() * 10),
        unitPriceDoc: e.def.price, taxCodeId, uom: e.def.uom, warehouseId,
      })),
      createdBy: args.userId,
    };
    const siResult = await createAndPostSI.execute(siInput, undefined, undefined, actor);
    const si = (siResult as any).salesInvoice ?? siResult;
    postedSIs.push(si);
    txCount++;
    console.log(`  ${txCount}. Direct SI ${si.invoiceNumber}  ${custCode}  $${si.grandTotalBase}`);
  }

  // ── 5 Direct Purchase Invoices per vendor (stock replenishment) ────
  await ensureDirectPurchasePersonaAllowed(db, args.companyId);
  const { CreatePurchaseInvoiceUseCase, PostPurchaseInvoiceUseCase, CreateAndPostPurchaseInvoiceUseCase } = await import('../src/application/purchases/use-cases/PurchaseInvoiceUseCases');
  const { PurchasesInventoryService } = await import('../src/application/inventory/services/PurchasesInventoryService');

  const purchasesInvService = new PurchasesInventoryService(movementUC);
  const createPI = new CreatePurchaseInvoiceUseCase(
    diContainer.purchaseSettingsRepository, diContainer.purchaseInvoiceRepository, diContainer.purchaseOrderRepository,
    diContainer.partyRepository, diContainer.itemRepository, diContainer.taxCodeRepository, diContainer.companyCurrencyRepository,
  );
  const postPI = new PostPurchaseInvoiceUseCase(
    diContainer.purchaseSettingsRepository, diContainer.inventorySettingsRepository,
    diContainer.purchaseInvoiceRepository, diContainer.purchaseOrderRepository, diContainer.partyRepository,
    diContainer.taxCodeRepository, diContainer.itemRepository, diContainer.itemCategoryRepository,
    diContainer.warehouseRepository, diContainer.uomConversionRepository, diContainer.companyCurrencyRepository,
    diContainer.exchangeRateRepository, purchasesInvService, diContainer.companyModuleRepository,
    postingSvc, diContainer.accountRepository, diContainer.transactionManager,
    diContainer.paymentHistoryRepository, diContainer.voucherRepository, diContainer.voucherSequenceRepository,
    diContainer.ledgerRepository,
  );
  const createAndPostPI = new CreateAndPostPurchaseInvoiceUseCase(createPI, postPI);

  console.log('\n--- Seeding 10 direct purchase invoices (5 per vendor) ---');
  const vendorCodes = Array.from(vendorIds.keys());
  for (let i = 0; i < 10; i++) {
    const vendCode = vendorCodes[i % vendorCodes.length];
    const vendId = vendorIds.get(vendCode)!;
    const lineItems = pickItems(2 + Math.floor(Math.random() * 3)); // 2-4 items per PI
    const invDate = dateOffset(15 - i);

    const piInput: any = {
      companyId: args.companyId, vendorId: vendId,
      invoiceDate: invDate, dueDate: dateOffset(15 - i - 30),
      vendorInvoiceNumber: `${vendCode}-INV-${1000 + i}`,
      currency: 'USD', exchangeRate: 1, source: 'native', persona: 'direct',
      voucherType: 'purchase_invoice',
      lines: lineItems.map(e => ({
        itemId: e.id,
        invoicedQty: 20 + Math.floor(Math.random() * 30),
        unitPriceDoc: +(e.def.cost * (0.95 + Math.random() * 0.15)).toFixed(2), // ±10% of base cost
        taxCodeId, uom: e.def.uom, warehouseId,
      })),
      createdBy: args.userId,
    };
    try {
      const pi = await createAndPostPI.execute(piInput);
      txCount++;
      console.log(`  ${txCount}. Direct PI ${pi.invoiceNumber}  ${vendCode}  $${pi.grandTotalBase}`);
    } catch (err: any) {
      console.error(`  ✗ PI #${i + 1} for ${vendCode} failed: ${err?.message || err}`);
    }
  }

  // ── 3 Sales Returns ────────────────────────────────────────────────
  console.log('\n--- Seeding 3 sales returns ---');
  for (let i = 0; i < 3 && i < postedSIs.length; i++) {
    const si = postedSIs[i];
    const firstLine = si.lines?.[0];
    if (!firstLine) continue;

    const sr = await createSR.execute({
      companyId: args.companyId, salesInvoiceId: si.id,
      returnDate: new Date().toISOString().slice(0, 10), warehouseId,
      settlementMode: 'CREDIT_NOTE', reasonCode: 'DEFECTIVE',
      reason: 'Seed demo: return test',
      lines: [{ siLineId: firstLine.lineId, itemId: firstLine.itemId, returnQty: 1, unitPriceDoc: firstLine.unitPriceDoc, taxCodeId, uom: firstLine.uom }],
      createdBy: args.userId,
    } as any, actor);
    await postSR.execute(args.companyId, sr.id, true, undefined, actor);
    txCount++;
    console.log(`  ${txCount}. SR ${sr.returnNumber} against SI ${si.invoiceNumber}`);
  }

  // ── 5 Receipt vouchers (cash collections) ──────────────────────────
  console.log('\n--- Seeding 5 receipt vouchers ---');
  for (let i = 0; i < 5; i++) {
    const amount = +(50 + Math.random() * 200).toFixed(2);
    const rv = await createVoucher.execute(args.companyId, args.userId, {
      type: 'receipt', date: dateOffset(i), currency: 'USD', exchangeRate: 1,
      notes: `Customer payment #${i + 1}`,
      lines: [
        { accountId: accounts.cash.id, side: 'Debit', amount },
        { accountId: accounts.ar.id, side: 'Credit', amount },
      ],
    });
    txCount++;
    console.log(`  ${txCount}. RV ${rv.voucherNo}  $${amount}`);
  }

  // ── 3 Payment vouchers (vendor payments) ───────────────────────────
  console.log('\n--- Seeding 3 payment vouchers ---');
  for (let i = 0; i < 3; i++) {
    const amount = +(100 + Math.random() * 300).toFixed(2);
    const pv = await createVoucher.execute(args.companyId, args.userId, {
      type: 'payment', date: dateOffset(i), currency: 'USD', exchangeRate: 1,
      notes: `Vendor payment #${i + 1}`,
      lines: [
        { accountId: accounts.ap.id, side: 'Debit', amount },
        { accountId: accounts.cash.id, side: 'Credit', amount },
      ],
    });
    txCount++;
    console.log(`  ${txCount}. PV ${pv.voucherNo}  $${amount}`);
  }

  // ── 2 Journal vouchers ─────────────────────────────────────────────
  console.log('\n--- Seeding 2 journal vouchers ---');
  for (let i = 0; i < 2; i++) {
    const amount = +(25 + Math.random() * 75).toFixed(2);
    const jv = await createVoucher.execute(args.companyId, args.userId, {
      type: 'journal_entry', date: dateOffset(i), currency: 'USD', exchangeRate: 1,
      notes: `Adjusting entry #${i + 1}`,
      lines: [
        { accountId: accounts.revenue.id, side: 'Debit', amount },
        { accountId: accounts.cogs.id, side: 'Credit', amount },
      ],
    });
    txCount++;
    console.log(`  ${txCount}. JV ${jv.voucherNo}  $${amount}`);
  }

  console.log(`\n✓ Total transactions seeded: ${txCount}`);
}

// ---------------------------------------------------------------------------
// Phase 1: Per-party AP/AR hierarchy
// ---------------------------------------------------------------------------
//
// Builds the following structure under the existing AP/AR headers:
//
//   <AP header>                            (existing — e.g. "201 Accounts Payable")
//    ├─ <existing General AP>              (existing POSTING — e.g. "20100")
//    ├─ 20110 International Suppliers      NEW HEADER
//    │   └─ 20111 FarmDirect               NEW POSTING (vendor sub-account)
//    └─ 20120 Local Suppliers              NEW HEADER
//        └─ 20121 Pacific Coast            NEW POSTING (vendor sub-account)
//
//   <AR header>                            (existing — e.g. "104 Accounts Receivable")
//    ├─ <existing General AR>              (existing POSTING — e.g. "10401")
//    ├─ 10410 Wholesale Customers          NEW HEADER
//    │   └─ 10411..10415                   NEW POSTING (per-customer)
//    └─ 10420 Retail Customers             NEW HEADER
//        └─ 10421..10425                   NEW POSTING (per-customer)
//
// Phase 2 will bind each party to the correct leaf (or to the General).

type PartyChannel = 'INTERNATIONAL' | 'LOCAL' | 'WHOLESALE' | 'RETAIL' | 'GENERAL';

// Customer channel allocation (mixes sub-account model with control-account model)
const CUSTOMER_CHANNEL: Record<string, PartyChannel> = {
  'CUST-001': 'WHOLESALE',  // Sunrise Grocery
  'CUST-002': 'RETAIL',     // Green Valley Market
  'CUST-003': 'RETAIL',     // Downtown Deli
  'CUST-004': 'WHOLESALE',  // Riverside Restaurant
  'CUST-005': 'GENERAL',    // Happy Meals — control-account model
  'CUST-006': 'WHOLESALE',  // Seaside Hotel
  'CUST-007': 'WHOLESALE',  // Campus Fresh
  'CUST-008': 'GENERAL',    // QuickMart — control-account model
  'CUST-009': 'RETAIL',     // Hilltop Bakery
  'CUST-010': 'WHOLESALE',  // Organic Pantry
};

const VENDOR_CHANNEL: Record<string, PartyChannel> = {
  'VEND-001': 'INTERNATIONAL', // FarmDirect
  'VEND-002': 'LOCAL',         // Pacific Coast
};

interface PartyAccountAllocation {
  // Per-party AP/AR leaf account IDs (only populated for sub-account-model parties).
  perParty: Map<string, string>; // party code → account id
  // General AP and AR accounts (control-account-model parties point here).
  generalAP: AccountRow;
  generalAR: AccountRow;
  // Newly created group HEADER ids (for reporting/debug).
  intlSuppliers?: string;
  localSuppliers?: string;
  wholesaleCustomers?: string;
  retailCustomers?: string;
}

async function restructureAPAndAR(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  dryRun: boolean,
): Promise<PartyAccountAllocation> {
  const rows = await loadAccounts(db, companyId);

  // Find existing AP/AR headers and existing "general" leaves under them.
  const apHeader = rows.find((r) => r.classification === 'LIABILITY' && /accounts?\s*payable\b/i.test(r.name) && !r.parentId)
    || rows.find((r) => r.classification === 'LIABILITY' && /accounts?\s*payable\b/i.test(r.name));
  const arHeader = rows.find((r) => r.classification === 'ASSET' && /accounts?\s*receivable\b/i.test(r.name) && !r.parentId)
    || rows.find((r) => r.classification === 'ASSET' && /accounts?\s*receivable\b/i.test(r.name));
  if (!apHeader || !arHeader) {
    console.error('Cannot find AP/AR header accounts — run COA template first.');
    process.exit(1);
  }

  // "General" leaves = first POSTING child of each header. If header itself is POSTING (older template), use it.
  const apGeneral = rows.find((r) => r.parentId === apHeader.id && r.active && r.classification === 'LIABILITY') || apHeader;
  const arGeneral = rows.find((r) => r.parentId === arHeader.id && r.active && r.classification === 'ASSET') || arHeader;

  console.log(`✓ AP header: ${apHeader.code} ${apHeader.name} | General AP: ${apGeneral.code} ${apGeneral.name}`);
  console.log(`✓ AR header: ${arHeader.code} ${arHeader.name} | General AR: ${arGeneral.code} ${arGeneral.name}`);

  if (dryRun) {
    console.log('  [dry-run] would create AP/AR group headers + per-party leaves');
    return {
      perParty: new Map(),
      generalAP: apGeneral,
      generalAR: arGeneral,
    };
  }

  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const accountRepo = diContainer.accountRepository;

  const existingCodes = new Set(rows.map((r) => r.code));

  const createIfMissing = async (input: {
    code: string;
    name: string;
    classification: 'ASSET' | 'LIABILITY';
    accountRole: 'HEADER' | 'POSTING';
    parentId: string;
  }): Promise<string> => {
    if (existingCodes.has(input.code)) {
      const found = rows.find((r) => r.code === input.code)!;
      console.log(`  ✓ ${input.code} ${input.name} — exists`);
      return found.id;
    }
    const acc = await accountRepo.create(companyId, {
      userCode: input.code,
      name: input.name,
      classification: input.classification,
      accountRole: input.accountRole,
      parentId: input.parentId,
      currencyPolicy: 'INHERIT',
      createdBy: userId,
    } as any);
    console.log(`  + ${input.code} ${input.name} [${input.accountRole}]`);
    existingCodes.add(input.code);
    return acc.id;
  };

  // AP groups
  const intlSuppliersId = await createIfMissing({
    code: '20110', name: 'International Suppliers', classification: 'LIABILITY', accountRole: 'HEADER', parentId: apHeader.id,
  });
  const localSuppliersId = await createIfMissing({
    code: '20120', name: 'Local Suppliers', classification: 'LIABILITY', accountRole: 'HEADER', parentId: apHeader.id,
  });

  // AR groups
  const wholesaleCustId = await createIfMissing({
    code: '10410', name: 'Wholesale Customers', classification: 'ASSET', accountRole: 'HEADER', parentId: arHeader.id,
  });
  const retailCustId = await createIfMissing({
    code: '10420', name: 'Retail Customers', classification: 'ASSET', accountRole: 'HEADER', parentId: arHeader.id,
  });

  // Per-vendor leaves
  const perParty = new Map<string, string>();
  const vendorLeafBase: Record<PartyChannel, { parentId: string; codeBase: number; cls: 'LIABILITY' | 'ASSET' }> = {
    INTERNATIONAL: { parentId: intlSuppliersId, codeBase: 20111, cls: 'LIABILITY' },
    LOCAL:         { parentId: localSuppliersId, codeBase: 20121, cls: 'LIABILITY' },
    WHOLESALE:     { parentId: wholesaleCustId,  codeBase: 10411, cls: 'ASSET' },
    RETAIL:        { parentId: retailCustId,     codeBase: 10421, cls: 'ASSET' },
    GENERAL:       { parentId: '',               codeBase: 0,     cls: 'ASSET' }, // unused
  };

  const counters: Partial<Record<PartyChannel, number>> = {};
  const nextCode = (ch: PartyChannel): string => {
    const base = vendorLeafBase[ch].codeBase;
    const next = (counters[ch] ?? 0);
    counters[ch] = next + 1;
    return String(base + next);
  };

  for (const v of VENDORS) {
    const ch = VENDOR_CHANNEL[v.code];
    if (!ch || ch === 'GENERAL') continue;
    const code = nextCode(ch);
    const id = await createIfMissing({
      code, name: v.legalName, classification: 'LIABILITY', accountRole: 'POSTING', parentId: vendorLeafBase[ch].parentId,
    });
    perParty.set(v.code, id);
  }

  for (const c of CUSTOMERS) {
    const ch = CUSTOMER_CHANNEL[c.code];
    if (!ch || ch === 'GENERAL') continue;
    const code = nextCode(ch);
    const id = await createIfMissing({
      code, name: c.legalName, classification: 'ASSET', accountRole: 'POSTING', parentId: vendorLeafBase[ch].parentId,
    });
    perParty.set(c.code, id);
  }

  console.log(`✓ Per-party AP/AR leaves: ${perParty.size} created or reused`);
  return {
    perParty,
    generalAP: apGeneral,
    generalAR: arGeneral,
    intlSuppliers: intlSuppliersId,
    localSuppliers: localSuppliersId,
    wholesaleCustomers: wholesaleCustId,
    retailCustomers: retailCustId,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log(`\nseed-demo-tenant — companyId=${args.companyId}\n`);

  const db = admin.firestore();
  const companyDoc = await db.collection('companies').doc(args.companyId).get();
  if (!companyDoc.exists) { console.error(`Company ${args.companyId} not found.`); process.exit(1); }
  console.log(`✓ Company: ${companyDoc.data()?.name}`);

  const rows = await loadAccounts(db, args.companyId);
  const accounts = resolveAccounts(rows);
  console.log(`✓ Accounts resolved (AR, Revenue, Inventory, COGS, AP, Cash, Tax, Equity)`);

  console.log('\n--- Phase 1: Restructure AP/AR with per-party hierarchy ---');
  const allocation = await restructureAPAndAR(db, args.companyId, args.userId, args.dryRun);

  const warehouseId = await seedWarehouse(db, args.companyId, args.userId, args.dryRun);
  const taxCodeId = await seedTaxCode(db, args.companyId, args.userId, accounts.tax, args.dryRun);
  const items = await seedAllItems(db, args.companyId, args.userId, accounts, taxCodeId, args.dryRun);
  const { customerIds, vendorIds } = await seedAllParties(db, args.companyId, args.userId, accounts, allocation, args.dryRun);

  const ovTotal = await seedAndPostOpeningStock(db, args.companyId, args.userId, items, warehouseId, accounts, args.dryRun);

  if (!args.skipTxn && !args.dryRun) {
    await seedTransactions(args, db, items, customerIds, vendorIds, warehouseId, taxCodeId, accounts);
  } else if (args.skipTxn) {
    console.log('\n⏭ Transactions skipped (--skip-txn)');
  }

  console.log('\n✅ Demo tenant seed complete.');
  console.log(`   ${GROCERY_ITEMS.length} items | ${CUSTOMERS.length} customers | ${VENDORS.length} vendors`);
  console.log(`   OV total: $${ovTotal.toFixed(2)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err?.stack || err?.message || err);
  process.exit(1);
});
