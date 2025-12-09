/**
 * Test the P&L API endpoint directly via HTTP
 */

const companyId = 'demo_company_1764981773080';
const fromDate = '2025-01-01';
const toDate = '2025-12-31';

const apiUrl = `http://localhost:5001/erp-03/us-central1/api/tenant/accounting/reports/profit-loss?from=${fromDate}&to=${toDate}`;

console.log('🧪 Testing P&L API Endpoint...\n');
console.log(`URL: ${apiUrl}\n`);

fetch(apiUrl, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Note: In real app, you'd need Authorization header with Bearer token
  }
})
  .then(response => {
    console.log(`Status: ${response.status} ${response.statusText}`);
    return response.json();
  })
  .then(data => {
    console.log('\n✅ Response:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
  });
