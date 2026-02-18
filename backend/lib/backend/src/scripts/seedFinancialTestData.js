"use strict";
/**
 * seedFinancialTestData.ts
 *
 * Reads the company's real Chart of Accounts + currencies, then creates
 * vouchers + ledger entries with known amounts so the Trial Balance and
 * Balance Sheet can be validated against the EXPECTED VALUES printed at the end.
 *
 * MULTI-CURRENCY: Each line uses the account's own currency.
 *   • debit / credit  → always in BASE currency (for TB/BS)
 *   • amount           → in the line's own currency
 *   • baseAmount       → same as debit or credit (base currency)
 *   • exchangeRate     → line currency → base currency rate
 *
 * Usage:
 *   npx ts-node --project tsconfig.json src/scripts/seedFinancialTestData.ts <companyId>
 *
 * Requires the Firestore emulator to be running.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// ─── Force Emulator ──────────────────────────────────────────────────────────
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();
// ─── Helpers ─────────────────────────────────────────────────────────────────
function accountingCol(companyId, sub) {
    return db.collection('companies').doc(companyId)
        .collection('accounting').doc('Data').collection(sub);
}
function isoToTimestamp(iso) {
    return firestore_1.Timestamp.fromDate(new Date(iso + 'T12:00:00Z'));
}
function roundMoney(n) {
    return Math.round(n * 100) / 100;
}
// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const companyId = process.argv[2];
    if (!companyId) {
        console.error('Usage: npx ts-node ... seedFinancialTestData.ts <companyId>');
        process.exit(1);
    }
    console.log(`\n📦 Company: ${companyId}`);
    console.log('─'.repeat(70));
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Read Chart of Accounts
    // ──────────────────────────────────────────────────────────────────────────
    const accountSnap = await accountingCol(companyId, 'accounts').get();
    if (accountSnap.empty) {
        console.error('❌ No accounts found!');
        process.exit(1);
    }
    // Determine base currency
    let baseCurrency = 'SYP';
    const currSnap = await db.collection('companies').doc(companyId)
        .collection('currencies').where('isBase', '==', true).limit(1).get();
    if (!currSnap.empty) {
        baseCurrency = currSnap.docs[0].id.toUpperCase();
    }
    else {
        // fallback to module settings
        const settingsSnap = await accountingCol(companyId, 'moduleSettings').limit(1).get();
        if (!settingsSnap.empty) {
            baseCurrency = (settingsSnap.docs[0].data().baseCurrency || 'SYP').toUpperCase();
        }
    }
    const accounts = accountSnap.docs.map(d => {
        const data = d.data();
        // Determine the account's operating currency
        let acctCurrency = baseCurrency;
        if (data.currencyPolicy === 'FIXED' && data.fixedCurrencyCode) {
            acctCurrency = data.fixedCurrencyCode.toUpperCase();
        }
        return {
            id: d.id,
            userCode: data.userCode || data.code || '',
            name: data.name || '',
            classification: data.classification || data.type || '',
            accountRole: data.accountRole || 'POSTING',
            parentId: data.parentId || null,
            currency: acctCurrency,
        };
    });
    console.log(`📋 Found ${accounts.length} accounts | Base currency: ${baseCurrency}`);
    // ──────────────────────────────────────────────────────────────────────────
    // 2. List posting accounts with their currencies
    // ──────────────────────────────────────────────────────────────────────────
    const posting = accounts.filter(a => a.accountRole !== 'HEADER');
    const byClass = (cls) => posting.filter(a => a.classification === cls);
    const assets = byClass('ASSET');
    const liabs = byClass('LIABILITY');
    const equities = byClass('EQUITY');
    const revenues = byClass('REVENUE');
    const expenses = byClass('EXPENSE');
    console.log(`\n  POSTING accounts by classification:`);
    for (const cls of ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) {
        const accs = byClass(cls);
        console.log(`    ${cls}: ${accs.length}`);
        for (const a of accs.sort((x, y) => x.userCode.localeCompare(y.userCode))) {
            console.log(`        ${a.userCode.padEnd(10)} ${a.name.padEnd(30)} [${a.currency}]`);
        }
    }
    if (assets.length < 1 || liabs.length < 1) {
        console.error('❌ Need at least 1 ASSET and 1 LIABILITY posting account');
        process.exit(1);
    }
    // ──────────────────────────────────────────────────────────────────────────
    // 3. Define exchange rates for known foreign currencies
    //    (These are illustrative rates vs the base currency)
    // ──────────────────────────────────────────────────────────────────────────
    const exchangeRates = {
        [baseCurrency]: 1,
        // Common rates against SYP-like base (adjust if your base is USD, etc.)
        'USD': 13000,
        'EUR': 14500,
        'GBP': 16500,
        'SAR': 3500,
        'AED': 3550,
        'TRY': 400,
        'JOD': 18350,
        'LBP': 0.15,
        'EGP': 265,
    };
    const getRate = (currency) => {
        if (currency === baseCurrency)
            return 1;
        if (exchangeRates[currency])
            return exchangeRates[currency];
        // Unknown currency → use 1:1 and warn
        console.warn(`⚠️  No exchange rate for ${currency}, defaulting to 1`);
        return 1;
    };
    // Helper: create a balanced line pair
    // Amount is always specified in BASE currency, we back-calculate the FX amount
    // IMPORTANT: VoucherLineEntity validates baseAmount == roundMoney(amount × rate)
    // So we must NOT round the FX amount, OR we must recalculate baseAmount to match.
    const makeLine = (account, side, targetBaseAmount) => {
        const rate = getRate(account.currency);
        if (rate === 1) {
            // Same currency — no conversion needed
            return {
                accountId: account.id,
                side,
                amount: targetBaseAmount,
                currency: account.currency,
                exchangeRate: 1,
                baseAmount: targetBaseAmount,
            };
        }
        // FX: compute amount in foreign currency, keep full precision
        const fxAmount = targetBaseAmount / rate;
        // Recalculate baseAmount to satisfy the invariant: baseAmount = round(fxAmount × rate)
        const actualBaseAmount = roundMoney(fxAmount * rate);
        return {
            accountId: account.id,
            side,
            amount: fxAmount,
            currency: account.currency,
            exchangeRate: rate,
            baseAmount: actualBaseAmount,
        };
    };
    // ──────────────────────────────────────────────────────────────────────────
    // 4. Pick accounts
    // ──────────────────────────────────────────────────────────────────────────
    const cash1 = assets[0];
    const cash2 = assets.length > 1 ? assets[1] : assets[0];
    const ar = assets.find(a => a.name.toLowerCase().includes('receiv')) || assets[assets.length - 1];
    const ap = liabs[0];
    const eq = equities[0] || null;
    const rev = revenues[0] || null;
    const exp = expenses[0] || null;
    console.log(`\n🎯  Selected accounts for seeding:`);
    const picks = [
        ['Cash-1', cash1], ['Cash-2', cash2], ['A/R', ar],
        ['A/P', ap], ['Equity', eq], ['Revenue', rev], ['Expense', exp],
    ];
    for (const [label, acc] of picks) {
        if (!acc)
            continue;
        console.log(`    ${(label + ':').padEnd(12)} ${acc.userCode.padEnd(10)} ${acc.name.padEnd(28)} [${acc.currency}] rate=${getRate(acc.currency)}`);
    }
    console.log();
    // ──────────────────────────────────────────────────────────────────────────
    // 5. Build vouchers — all amounts specified in BASE currency
    //    Dates: Jan 1-10, 2026
    //
    //  V1: 01-Jan  Owner invests                Dr Cash-1  100,000 base   Cr Equity 100,000 base
    //  V2: 02-Jan  Purchase on credit           Dr Expense   5,000 base   Cr A/P      5,000 base
    //  V3: 03-Jan  Cash sale                    Dr Cash-1   20,000 base   Cr Revenue 20,000 base
    //  V4: 04-Jan  Pay supplier                 Dr A/P       3,000 base   Cr Cash-1    3,000 base
    //  V5: 05-Jan  Transfer                     Dr Cash-2   10,000 base   Cr Cash-1   10,000 base
    //  V6: 06-Jan  Invoice on credit            Dr A/R      15,000 base   Cr Revenue 15,000 base
    //  V7: 07-Jan  Receive payment              Dr Cash-1    8,000 base   Cr A/R       8,000 base
    //  V8: 08-Jan  Pay rent                     Dr Expense   2,500 base   Cr Cash-1    2,500 base
    //  V9: 09-Jan  Additional sale              Dr Cash-2   12,000 base   Cr Revenue 12,000 base
    // V10: 10-Jan  DRAFT purchase (unposted)    Dr Expense   1,000 base   Cr A/P       1,000 base
    // ──────────────────────────────────────────────────────────────────────────
    const vouchers = [];
    // V1 – Owner invests cash
    vouchers.push({
        date: '2026-01-01', narration: 'SEED: Owner capital investment',
        status: 'POSTED',
        lines: [
            makeLine(cash1, 'Debit', 100000),
            makeLine(eq || ap, 'Credit', 100000),
        ]
    });
    // V2 – Purchase on credit
    if (exp) {
        vouchers.push({
            date: '2026-01-02', narration: 'SEED: Office supplies on credit',
            status: 'POSTED',
            lines: [makeLine(exp, 'Debit', 5000), makeLine(ap, 'Credit', 5000)]
        });
    }
    // V3 – Cash sale
    if (rev) {
        vouchers.push({
            date: '2026-01-03', narration: 'SEED: Cash sale',
            status: 'POSTED',
            lines: [makeLine(cash1, 'Debit', 20000), makeLine(rev, 'Credit', 20000)]
        });
    }
    // V4 – Pay supplier
    vouchers.push({
        date: '2026-01-04', narration: 'SEED: Pay supplier',
        status: 'POSTED',
        lines: [makeLine(ap, 'Debit', 3000), makeLine(cash1, 'Credit', 3000)]
    });
    // V5 – Internal transfer
    if (cash1.id !== cash2.id) {
        vouchers.push({
            date: '2026-01-05', narration: 'SEED: Internal cash transfer',
            status: 'POSTED',
            lines: [makeLine(cash2, 'Debit', 10000), makeLine(cash1, 'Credit', 10000)]
        });
    }
    // V6 – Client invoice on credit
    if (rev) {
        vouchers.push({
            date: '2026-01-06', narration: 'SEED: Invoice to client Alpha',
            status: 'POSTED',
            lines: [makeLine(ar, 'Debit', 15000), makeLine(rev, 'Credit', 15000)]
        });
    }
    // V7 – Receive partial payment
    vouchers.push({
        date: '2026-01-07', narration: 'SEED: Collection from client Alpha',
        status: 'POSTED',
        lines: [makeLine(cash1, 'Debit', 8000), makeLine(ar, 'Credit', 8000)]
    });
    // V8 – Pay rent
    if (exp) {
        vouchers.push({
            date: '2026-01-08', narration: 'SEED: Office rent',
            status: 'POSTED',
            lines: [makeLine(exp, 'Debit', 2500), makeLine(cash1, 'Credit', 2500)]
        });
    }
    // V9 – Additional sale
    if (rev) {
        vouchers.push({
            date: '2026-01-09', narration: 'SEED: Cash sale to client Beta',
            status: 'POSTED',
            lines: [makeLine(cash2, 'Debit', 12000), makeLine(rev, 'Credit', 12000)]
        });
    }
    // V10 – DRAFT (for TC-16.19 — should NOT appear in TB)
    if (exp) {
        vouchers.push({
            date: '2026-01-10', narration: 'SEED: DRAFT — NOT POSTED',
            status: 'DRAFT',
            lines: [makeLine(exp, 'Debit', 1000), makeLine(ap, 'Credit', 1000)]
        });
    }
    // ──────────────────────────────────────────────────────────────────────────
    // 6. Write to Firestore
    // ──────────────────────────────────────────────────────────────────────────
    const voucherCol = accountingCol(companyId, 'vouchers');
    const ledgerCol = accountingCol(companyId, 'ledger');
    // ── Cleanup: delete previously seeded data ──
    console.log('🧹 Cleaning up previously seeded data...');
    const oldVouchers = await voucherCol.where('createdBy', '==', 'seed-script').get();
    if (!oldVouchers.empty) {
        const delBatch = db.batch();
        for (const doc of oldVouchers.docs) {
            delBatch.delete(doc.ref);
        }
        await delBatch.commit();
        console.log(`   Deleted ${oldVouchers.size} old seed vouchers`);
    }
    // Also delete old seed ledger entries (they start with 'seed_')
    // Check both 'ledger' and 'ledgerEntries' (in case old bad data exists)
    for (const colName of ['ledger', 'ledgerEntries']) {
        const col = accountingCol(companyId, colName);
        const oldLedger = await col.get();
        const seedLedgerDocs = oldLedger.docs.filter(d => d.id.startsWith('seed_'));
        if (seedLedgerDocs.length > 0) {
            for (let chunk = 0; chunk < seedLedgerDocs.length; chunk += 500) {
                const batch = db.batch();
                seedLedgerDocs.slice(chunk, chunk + 500).forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            console.log(`   Deleted ${seedLedgerDocs.length} old seed entries from '${colName}'`);
        }
    }
    console.log();
    const accountTotals = new Map();
    const addToTotal = (accId, d, c) => {
        const cur = accountTotals.get(accId) || { debit: 0, credit: 0 };
        cur.debit += d;
        cur.credit += c;
        accountTotals.set(accId, cur);
    };
    let postedCount = 0;
    let draftCount = 0;
    for (let i = 0; i < vouchers.length; i++) {
        const v = vouchers[i];
        const vId = `seed_v${(i + 1).toString().padStart(3, '0')}`;
        const voucherNo = `SEED-${(i + 1).toString().padStart(3, '0')}`;
        const isPosted = v.status === 'POSTED';
        // Total debit/credit in base currency for voucher header
        const totalDebit = v.lines.filter(l => l.side === 'Debit').reduce((s, l) => s + l.baseAmount, 0);
        const totalCredit = v.lines.filter(l => l.side === 'Credit').reduce((s, l) => s + l.baseAmount, 0);
        // Firestore lines
        const firestoreLines = v.lines.map((line, idx) => ({
            id: idx + 1,
            accountId: line.accountId,
            side: line.side,
            amount: line.amount,
            baseAmount: line.baseAmount,
            currency: line.currency,
            baseCurrency: baseCurrency,
            exchangeRate: line.exchangeRate,
            notes: '',
            costCenterId: null,
            metadata: {},
        }));
        const voucherData = {
            id: vId,
            companyId,
            type: 'journal_entry',
            voucherNo,
            date: v.date,
            status: isPosted ? 'posted' : 'draft',
            narration: v.narration,
            currency: baseCurrency,
            baseCurrency,
            exchangeRate: 1,
            totalDebit,
            totalCredit,
            lines: firestoreLines,
            history: [{
                    action: 'created',
                    userId: 'seed-script',
                    timestamp: new Date().toISOString(),
                    notes: 'Auto-generated by seedFinancialTestData.ts'
                }],
            createdBy: 'seed-script',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: {},
        };
        if (isPosted) {
            voucherData.postedAt = new Date(v.date + 'T12:00:00Z').toISOString();
            voucherData.postedBy = 'seed-script';
        }
        await voucherCol.doc(vId).set(voucherData);
        // Ledger entries — ONLY for posted vouchers
        if (isPosted) {
            const batch = db.batch();
            for (let li = 0; li < v.lines.length; li++) {
                const line = v.lines[li];
                const ledgerId = `${vId}_${li + 1}`;
                const debit = line.side === 'Debit' ? line.baseAmount : 0;
                const credit = line.side === 'Credit' ? line.baseAmount : 0;
                batch.set(ledgerCol.doc(ledgerId), {
                    id: ledgerId,
                    companyId,
                    accountId: line.accountId,
                    voucherId: vId,
                    voucherLineId: li + 1,
                    date: isoToTimestamp(v.date),
                    debit,
                    credit,
                    currency: line.currency,
                    amount: line.amount,
                    baseCurrency,
                    baseAmount: line.baseAmount,
                    exchangeRate: line.exchangeRate,
                    side: line.side,
                    notes: '',
                    costCenterId: null,
                    metadata: {},
                    isPosted: true,
                    reconciliationId: null,
                    bankStatementLineId: null,
                    createdAt: new Date().toISOString(),
                });
                addToTotal(line.accountId, debit, credit);
            }
            await batch.commit();
            postedCount++;
        }
        else {
            draftCount++;
        }
        const currInfo = v.lines.map(l => `${l.side === 'Debit' ? 'Dr' : 'Cr'} ${l.baseAmount.toLocaleString()} ${baseCurrency}` +
            (l.currency !== baseCurrency ? ` (${l.amount.toLocaleString()} ${l.currency})` : '')).join(' / ');
        console.log(`  ${isPosted ? '✅' : '📝'} ${voucherNo} ${v.date}  ${currInfo}`);
        console.log(`     ${v.narration}`);
    }
    // ──────────────────────────────────────────────────────────────────────────
    // 7. Print EXPECTED VALUES
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('📊  EXPECTED VALUES (All amounts in base currency: ' + baseCurrency + ')');
    console.log('═'.repeat(70));
    console.log(`  Posted: ${postedCount}   |   Draft: ${draftCount}`);
    console.log('─'.repeat(70));
    const classifications = {};
    let grandDebit = 0;
    let grandCredit = 0;
    console.log(`\n  PER-ACCOUNT LEDGER TOTALS (added by this seed):`);
    console.log('  ' + '-'.repeat(66));
    console.log(`  ${'Code'.padEnd(10)} ${'Name'.padEnd(26)} ${'Ccy'.padEnd(5)} ${'Debit'.padStart(14)} ${'Credit'.padStart(14)}`);
    console.log('  ' + '-'.repeat(66));
    const sortedAccounts = [...accountTotals.entries()]
        .map(([id, totals]) => {
        const acc = accounts.find(a => a.id === id);
        return Object.assign(Object.assign({}, acc), totals);
    })
        .sort((a, b) => a.userCode.localeCompare(b.userCode));
    for (const acc of sortedAccounts) {
        const cls = acc.classification;
        if (!classifications[cls])
            classifications[cls] = { debit: 0, credit: 0 };
        classifications[cls].debit += acc.debit;
        classifications[cls].credit += acc.credit;
        grandDebit += acc.debit;
        grandCredit += acc.credit;
        const d = acc.debit ? acc.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
        const c = acc.credit ? acc.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
        console.log(`  ${acc.userCode.padEnd(10)} ${acc.name.substring(0, 26).padEnd(26)} ${acc.currency.padEnd(5)} ${d.padStart(14)} ${c.padStart(14)}`);
    }
    console.log('  ' + '-'.repeat(66));
    console.log(`  ${'GRAND TOTAL'.padEnd(41)} ${grandDebit.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${grandCredit.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)}`);
    console.log(`  ${'BALANCED?'.padEnd(41)} ${Math.abs(grandDebit - grandCredit) < 0.01 ? '✅ YES' : '❌ NO'}`);
    console.log();
    // TB closing columns (per-account: max(0, D-C) for closing debit, max(0, C-D) for closing credit)
    console.log('  EXPECTED TRIAL BALANCE (closing columns):');
    console.log('  ' + '-'.repeat(66));
    console.log(`  ${'Code'.padEnd(10)} ${'Account'.padEnd(26)} ${'Close D'.padStart(14)} ${'Close C'.padStart(14)}`);
    console.log('  ' + '-'.repeat(66));
    let tbCloseD = 0;
    let tbCloseC = 0;
    for (const acc of sortedAccounts) {
        const net = acc.debit - acc.credit;
        const cd = Math.max(0, net);
        const cc = Math.max(0, -net);
        tbCloseD += cd;
        tbCloseC += cc;
        const ds = cd ? cd.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
        const cs = cc ? cc.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
        console.log(`  ${acc.userCode.padEnd(10)} ${acc.name.substring(0, 26).padEnd(26)} ${ds.padStart(14)} ${cs.padStart(14)}`);
    }
    console.log('  ' + '-'.repeat(66));
    console.log(`  ${'TB GRAND TOTAL'.padEnd(36)} ${tbCloseD.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${tbCloseC.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)}`);
    console.log(`  ${'BALANCED?'.padEnd(36)} ${Math.abs(tbCloseD - tbCloseC) < 0.01 ? '✅ YES' : '❌ NO'}`);
    console.log();
    // BS expected values
    const assetNet = (((_a = classifications['ASSET']) === null || _a === void 0 ? void 0 : _a.debit) || 0) - (((_b = classifications['ASSET']) === null || _b === void 0 ? void 0 : _b.credit) || 0);
    const liabNet = (((_c = classifications['LIABILITY']) === null || _c === void 0 ? void 0 : _c.credit) || 0) - (((_d = classifications['LIABILITY']) === null || _d === void 0 ? void 0 : _d.debit) || 0);
    const eqNet = (((_e = classifications['EQUITY']) === null || _e === void 0 ? void 0 : _e.credit) || 0) - (((_f = classifications['EQUITY']) === null || _f === void 0 ? void 0 : _f.debit) || 0);
    const revNet = (((_g = classifications['REVENUE']) === null || _g === void 0 ? void 0 : _g.credit) || 0) - (((_h = classifications['REVENUE']) === null || _h === void 0 ? void 0 : _h.debit) || 0);
    const expNet = (((_j = classifications['EXPENSE']) === null || _j === void 0 ? void 0 : _j.debit) || 0) - (((_k = classifications['EXPENSE']) === null || _k === void 0 ? void 0 : _k.credit) || 0);
    const re = revNet - expNet;
    console.log('  EXPECTED BALANCE SHEET:');
    console.log('  ' + '-'.repeat(50));
    console.log(`    Total Assets:           ${assetNet.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Total Liabilities:      ${liabNet.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Equity (excl RE):       ${eqNet.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Revenue (net):          ${revNet.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Expenses (net):         ${expNet.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Retained Earnings:      ${re.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    Total Equity + RE:      ${(eqNet + re).toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    L + E + RE:             ${(liabNet + eqNet + re).toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(14)} ${baseCurrency}`);
    console.log(`    A = L+E+RE?             ${Math.abs(assetNet - (liabNet + eqNet + re)) < 0.01 ? '✅ YES' : '❌ NO'}`);
    console.log('  ' + '-'.repeat(50));
    console.log('\n' + '═'.repeat(70));
    console.log(`⚠️  NOTE: These values ADD to any existing data in the company.`);
    console.log(`    For clean validation, clear existing vouchers/ledger first,`);
    console.log(`    or compare the DELTA from before vs. after.`);
    console.log('═'.repeat(70));
    console.log('\n✅ Seeding complete!\n');
}
main().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seedFinancialTestData.js.map