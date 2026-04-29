const fs = require('fs');
const p = 'D:/DEV2026/ERP03/frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx';
let c = fs.readFileSync(p, 'utf8');

// Remove currenciesInstructions import
c = c.replace('  currenciesInstructions,\n', '');

// Update the activeTab type to remove 'currencies'
c = c.replace("<'general' | 'currencies' | 'policies'", "<'general' | 'policies'");

fs.writeFileSync(p, c);
console.log('done');
