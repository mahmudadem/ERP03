// api-smoke.js
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/erp-03/us-central1/api/api/v1';
const TOKEN = process.env.TOKEN || 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoiU2VlZCBVc2VyIiwiZW1haWwiOiJzZWVkQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImF1dGhfdGltZSI6MTc2NDYyODcyNCwidXNlcl9pZCI6InNlZWQtdXNlciIsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsic2VlZEBleGFtcGxlLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn0sImlhdCI6MTc2NDYyODcyNCwiZXhwIjoxNzY0NjMyMzI0LCJhdWQiOiJlcnAtMDMiLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vZXJwLTAzIiwic3ViIjoic2VlZC11c2VyIn0.';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
});

const log = (step, ok, msg) => console.log(`${ok ? '✅' : '❌'} ${step}${msg ? ' - ' + msg : ''}`);

(async () => {
  try {
    // 1) List accounts (baseline)
    let res = await client.get('/accounting/accounts');
    const list1 = res.data?.data || res.data || [];
    log('List accounts', true, `count=${list1.length}`);

    // 2) Create account
    const acctPayload = { code: '1000', name: 'Cash', type: 'ASSET', parentId: null, currency: 'USD' };
    res = await client.post('/accounting/accounts', acctPayload);
    const accountId = (res.data?.data || res.data)?.id;
    log('Create account', true, `id=${accountId}`);

    // 3) List accounts again
    res = await client.get('/accounting/accounts');
    const list2 = res.data?.data || res.data || [];
    log('List accounts after create', true, `count=${list2.length}`);

    // 4) Create balanced voucher
    const voucherPayload = {
      type: 'INV',
      date: new Date().toISOString(),
      currency: 'USD',
      lines: [
        { accountId, description: 'Debit line', fxAmount: 100, baseAmount: 100, debitBase: 100, creditBase: 0 },
        { accountId, description: 'Credit line', fxAmount: -100, baseAmount: -100, debitBase: 0, creditBase: 100 },
      ],
      totalDebit: 100,
      totalCredit: 100,
      totalDebitBase: 100,
      totalCreditBase: 100,
    };
    res = await client.post('/accounting/vouchers', voucherPayload);
    const voucherId = (res.data?.data || res.data)?.id;
    log('Create voucher', true, `id=${voucherId}`);

    // 5) Approve voucher
    await client.post(`/accounting/vouchers/${voucherId}/approve`);
    log('Approve voucher', true);

    // 6) Lock voucher
    await client.post(`/accounting/vouchers/${voucherId}/lock`);
    log('Lock voucher', true);

    // 7) Trial balance
    res = await client.get('/accounting/reports/trial-balance');
    const tb = res.data?.data || res.data || [];
    log('Trial balance', true, `lines=${tb.length}`);

    // 8) Negative: duplicate account code
    try {
      await client.post('/accounting/accounts', acctPayload);
      log('Duplicate account code should fail', false);
    } catch (err) {
      log('Duplicate account code should fail', true, err.response?.statusText || 'failed as expected');
    }

    // 9) Negative: unbalanced voucher
    try {
      await client.post('/accounting/vouchers', { ...voucherPayload, lines: voucherPayload.lines.slice(0, 1) });
      log('Unbalanced voucher should fail', false);
    } catch (err) {
      log('Unbalanced voucher should fail', true, err.response?.statusText || 'failed as expected');
    }
  } catch (err) {
    console.error('Fatal error:', err.response?.status, err.response?.data || err.message);
  }
})();
