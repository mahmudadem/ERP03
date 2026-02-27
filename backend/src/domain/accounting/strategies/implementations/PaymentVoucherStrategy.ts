import { IVoucherPostingStrategy } from '../IVoucherPostingStrategy';
import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

/**
 * PaymentVoucherStrategy
 * 
 * ONE-TO-MANY Structure:
 * - ONE source (payFromAccountId) - the account money comes from
 * - MANY destinations (lines with payToAccountId) - allocations to different accounts
 * 
 * Example: Pay 300 USD from Bank to multiple suppliers
 * Input:
 * {
 *   payFromAccountId: "acc_bank",
 *   currency: "USD",
 *   exchangeRate: 1,
 *   lines: [
 *     { payToAccountId: "acc_supplier_a", amount: 200, notes: "Inv#001" },
 *     { payToAccountId: "acc_supplier_b", amount: 100, notes: "Inv#002" }
 *   ]
 * }
 */
export class PaymentVoucherStrategy implements IVoucherPostingStrategy {
  async generateLines(header: any, companyId: string, baseCurrency: string): Promise<VoucherLineEntity[]> {
    const lines: VoucherLineEntity[] = [];

    const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

    const getByKeyCI = (obj: any, key: string) => {
      if (!obj || !key) return undefined;
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      const target = key.toLowerCase();
      const found = Object.keys(obj).find(k => k.toLowerCase() === target);
      if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== '') {
        return obj[found];
      }
      const normalizedTarget = normalizeKey(key);
      const foundNormalized = Object.keys(obj).find(k => normalizeKey(k) === normalizedTarget);
      if (foundNormalized && obj[foundNormalized] !== undefined && obj[foundNormalized] !== null && obj[foundNormalized] !== '') {
        return obj[foundNormalized];
      }
      return undefined;
    };

    const extractAccountRef = (value: any): string | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'string') return value;
      if (typeof value === 'object') {
        if (typeof value.id === 'string' && value.id) return value.id;
        if (typeof value.code === 'string' && value.code) return value.code;
        if (typeof value.accountId === 'string' && value.accountId) return value.accountId;
        if (typeof value.account === 'string' && value.account) return value.account;
      }
      return undefined;
    };

    const resolveAccountId = (obj: any, primaryKey: string): string | undefined => {
      const direct =
        extractAccountRef(getByKeyCI(obj, primaryKey)) ||
        extractAccountRef(getByKeyCI(obj, 'accountId')) ||
        extractAccountRef(getByKeyCI(obj, 'account'));
      if (direct) return direct;

      const metadata = getByKeyCI(obj, 'metadata');
      const metadataDirect =
        extractAccountRef(getByKeyCI(metadata, primaryKey)) ||
        extractAccountRef(getByKeyCI(metadata, 'accountId')) ||
        extractAccountRef(getByKeyCI(metadata, 'account'));
      if (metadataDirect) return metadataDirect;

      const fallbackKey = Object.keys(obj || {}).find(k => normalizeKey(k).includes('account'));
      if (fallbackKey) return extractAccountRef(obj[fallbackKey]);

      const metadataFallbackKey = Object.keys(metadata || {}).find(k => normalizeKey(k).includes('account'));
      if (metadataFallbackKey) return extractAccountRef(metadata[metadataFallbackKey]);

      return undefined;
    };
    
    const payFromAccountId = resolveAccountId(header, 'payFromAccountId');
    const headerCurrency = String(header.currency || baseCurrency).toUpperCase();
    const normalizedBaseCurrency = String(baseCurrency).toUpperCase();
    const isHeaderInBaseCurrency = headerCurrency === normalizedBaseCurrency;
    const headerRate = isHeaderInBaseCurrency ? 1 : (Number(header.exchangeRate) || 1);

    const allocations = header.lines || [];

    // Compatibility mode: accept canonical JV-style lines (side/accountId/amount)
    // that may come from cloned forms or legacy UI pipelines.
    const canonicalLines = (allocations || []).filter((line: any) => {
      const accountRef = resolveAccountId(line, 'accountId');
      const side = String(line?.side || '').toLowerCase();
      const amount = Math.abs(Number(line?.amount) || 0);
      return !!accountRef && (side === 'debit' || side === 'credit') && amount > 0;
    });

    if (canonicalLines.length > 0 && canonicalLines.length === allocations.length) {
      return canonicalLines.map((line: any, idx: number) => {
        const accountId = resolveAccountId(line, 'accountId') as string;
        const sideRaw = String(line.side || '').toLowerCase();
        const side: 'Debit' | 'Credit' = sideRaw === 'credit' ? 'Credit' : 'Debit';
        const amountFx = Math.abs(Number(line.amount) || 0);
        const lineCurrency = String(line.lineCurrency || line.currency || headerCurrency).toUpperCase();
        const lineParity = Number(line.exchangeRate || line.parity || 1);
        const lineRate = lineCurrency === normalizedBaseCurrency
          ? 1
          : (lineCurrency === headerCurrency ? headerRate : roundMoney(headerRate * lineParity));
        const lineBaseCurrency = String(line.baseCurrency || baseCurrency).toUpperCase();
        const baseAmountRaw = Number(line.baseAmount);
        const baseAmount = Number.isFinite(baseAmountRaw) && baseAmountRaw > 0
          ? roundMoney(baseAmountRaw)
          : roundMoney(amountFx * lineRate);

        return new VoucherLineEntity(
          idx + 1,
          accountId,
          side,
          baseAmount,
          lineBaseCurrency,
          amountFx,
          lineCurrency,
          lineRate,
          line.notes || line.description || '',
          line.costCenterId || line.costCenter,
          line.metadata || {}
        );
      });
    }
    
    if (!payFromAccountId) {
      throw new Error('Payment requires payFromAccountId (Pay From account)');
    }
    
    if (!allocations || allocations.length === 0) {
      throw new Error('Payment requires at least one allocation line');
    }
    
    let totalFx = 0;
    let totalBaseCalculated = 0;
    
    // 1. Generate DEBIT lines for each allocation
    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const amountFx = Number(allocation.amount) || 0;
        const lineCurrency = String(allocation.lineCurrency || allocation.currency || headerCurrency).toUpperCase();
        const lineParity = Number(allocation.exchangeRate || allocation.parity || 1);
        const absoluteRate = lineCurrency === normalizedBaseCurrency
          ? 1
          : (lineCurrency === headerCurrency ? headerRate : roundMoney(headerRate * lineParity));
        const amountBase = roundMoney(amountFx * absoluteRate);
        
        totalFx = roundMoney(totalFx + amountFx);
        totalBaseCalculated = roundMoney(totalBaseCalculated + amountBase);

        const payToAccountId = resolveAccountId(allocation, 'payToAccountId');
        
        if (!payToAccountId) {
            const keys = Object.keys(allocation || {}).join(', ');
            throw new Error(`Line ${i + 1}: Allocation must have payToAccountId (received keys: ${keys || 'none'})`);
        }
        
        const debitLine = new VoucherLineEntity(
            i + 1,
            payToAccountId,
            'Debit',
            amountBase,        // baseAmount
            normalizedBaseCurrency, // baseCurrency
            amountFx,          // amount
            lineCurrency,      // currency
            absoluteRate,


            allocation.notes || allocation.description || 'Payment allocation',
            allocation.costCenterId || allocation.costCenter,
            allocation.metadata || {}
        );
        lines.push(debitLine);
    }
    
    // 2. Generate single CREDIT line for source account
    // We use totalBaseCalculated (sum of rounded lines) instead of totalFx * exchangeRate
    // to ensure the voucher balances perfectly in base currency.
    const creditCurrency = lines[0]?.currency || headerCurrency;
    const creditRate = creditCurrency === normalizedBaseCurrency
      ? 1
      : (creditCurrency === headerCurrency ? headerRate : Number(lines[0]?.exchangeRate || headerRate || 1));
    
    const creditLine = new VoucherLineEntity(
        lines.length + 1,
        payFromAccountId,
        'Credit',
        totalBaseCalculated, // baseAmount (SUM OF DEBITS)
        normalizedBaseCurrency, // baseCurrency
        totalFx,           // amount
        creditCurrency,    // currency
        creditRate,


        header.description || 'Payment from account',
        undefined,
        {}
    );
    lines.push(creditLine);
    
    return lines;
  }
}
