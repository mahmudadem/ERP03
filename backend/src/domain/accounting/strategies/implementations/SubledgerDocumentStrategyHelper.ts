import { VoucherLineEntity, roundMoney } from '../../entities/VoucherLineEntity';

type RawVoucherSide = 'Debit' | 'Credit' | 'debit' | 'credit';

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSide = (value: any): 'Debit' | 'Credit' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'debit') return 'Debit';
  if (normalized === 'credit') return 'Credit';
  throw new Error(`Invalid voucher line side: ${value}`);
};

const requirePositive = (value: number, fieldName: string, lineNo: number): number => {
  if (value <= 0) {
    throw new Error(`Line ${lineNo}: ${fieldName} must be greater than 0`);
  }
  return value;
};

const resolveCurrency = (line: any, headerCurrency: string, baseCurrency: string): string => {
  const raw = line?.currency || line?.docCurrency || line?.lineCurrency || headerCurrency || baseCurrency;
  return String(raw || baseCurrency).toUpperCase();
};

const resolveExchangeRate = (line: any, defaultRate: number): number => {
  const rate = toNumber(line?.exchangeRate || line?.effectiveRate || line?.rate || defaultRate);
  if (rate <= 0) return defaultRate > 0 ? defaultRate : 1;
  return rate;
};

const resolveAmounts = (
  line: any,
  lineCurrency: string,
  baseCurrency: string,
  headerRate: number,
  lineNo: number
): { baseAmount: number; docAmount: number; exchangeRate: number } => {
  let baseAmount = Math.abs(toNumber(line?.baseAmount ?? line?.amountBase));
  let docAmount = Math.abs(toNumber(line?.docAmount ?? line?.amount ?? line?.amountDoc));
  let exchangeRate = 1;

  if (lineCurrency === baseCurrency) {
    if (baseAmount <= 0 && docAmount <= 0) {
      throw new Error(`Line ${lineNo}: amount is required`);
    }
    if (baseAmount <= 0) baseAmount = docAmount;
    if (docAmount <= 0) docAmount = baseAmount;
    exchangeRate = 1;
  } else {
    exchangeRate = resolveExchangeRate(line, headerRate);
    if (baseAmount <= 0 && docAmount <= 0) {
      throw new Error(`Line ${lineNo}: baseAmount or docAmount is required`);
    }
    if (docAmount <= 0) {
      docAmount = baseAmount / exchangeRate;
    }
    if (baseAmount <= 0) {
      baseAmount = docAmount * exchangeRate;
    }
  }

  baseAmount = roundMoney(requirePositive(baseAmount, 'baseAmount', lineNo));
  docAmount = roundMoney(requirePositive(docAmount, 'docAmount', lineNo));
  exchangeRate = lineCurrency === baseCurrency ? 1 : roundMoney(requirePositive(exchangeRate, 'exchangeRate', lineNo));

  return { baseAmount, docAmount, exchangeRate };
};

export const generateSubledgerDocumentLines = async (
  header: any,
  baseCurrencyRaw: string
): Promise<VoucherLineEntity[]> => {
  const baseCurrency = String(baseCurrencyRaw || '').toUpperCase();
  const headerCurrency = String(header?.currency || baseCurrency).toUpperCase();
  const parsedHeaderRate = toNumber(header?.exchangeRate);
  const headerRate = headerCurrency === baseCurrency ? 1 : (parsedHeaderRate > 0 ? parsedHeaderRate : 1);
  const inputLines = Array.isArray(header?.lines) ? header.lines : [];

  if (!inputLines.length) {
    throw new Error('Subledger voucher requires at least one line');
  }

  return inputLines.map((line: any, idx: number) => {
    const lineNo = idx + 1;
    const accountId = String(line?.accountId || '').trim();
    if (!accountId) {
      throw new Error(`Line ${lineNo}: accountId is required`);
    }

    const side = normalizeSide(line?.side as RawVoucherSide);
    const lineCurrency = resolveCurrency(line, headerCurrency, baseCurrency);
    const { baseAmount, docAmount, exchangeRate } = resolveAmounts(
      line,
      lineCurrency,
      baseCurrency,
      headerRate,
      lineNo
    );

    return new VoucherLineEntity(
      lineNo,
      accountId,
      side,
      baseAmount,
      baseCurrency,
      docAmount,
      lineCurrency,
      exchangeRate,
      line?.notes || line?.description || '',
      line?.costCenterId || line?.costCenter,
      line?.metadata || {}
    );
  });
};
