import fs from 'fs';
import path from 'path';

const filesToI18n = [
  'src/components/ui/DataTable/DataTable.tsx',
  'src/layout/WindowManager.tsx',
  'src/modules/accounting/pages/settings/components/ExchangeRateHistory.tsx',
  'src/modules/accounting/pages/settings/components/ExchangeRateMatrix.tsx',
  'src/modules/purchases/pages/VendorStatementPage.tsx',
  'src/modules/sales/pages/CustomerStatementPage.tsx',
  'src/modules/shared/pages/settings/components/ExchangeRateHistory.tsx',
  'src/modules/shared/pages/settings/components/ExchangeRateMatrix.tsx',
  'src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx',
  'src/pages/dev/apex-ledger/components/reports/ApexCashFlow.tsx',
  'src/pages/super-admin/pages/SuperAdminFieldLibraryPage.tsx'
];

for (const f of filesToI18n) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) {
      console.log(`Missing ${p}`);
      continue;
  }
  let text = fs.readFileSync(p, 'utf-8');
  
  if (!text.includes("import i18n from 'i18next'")) {
      text = `import i18n from 'i18next';\n` + text;
  }
  
  // replace {t( with {i18n.t(
  text = text.replace(/\{t\(/g, '{i18n.t(');
  // replace >t( with >i18n.t(
  text = text.replace(/>t\(/g, '>i18n.t(');
  // replace  t( with  i18n.t(
  text = text.replace(/\s+t\(/g, (match) => match.replace('t(', 'i18n.t('));

  fs.writeFileSync(p, text);
  console.log(`Fixed ${f}`);
}

const vtp = path.join(process.cwd(), 'src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx');
if (fs.existsSync(vtp)) {
  let text = fs.readFileSync(vtp, 'utf-8');
  text = text.replace(/const \{ t \} = useTranslation\('common'\);\s*const \{ t \} = useTranslation\('common'\);/g, "const { t } = useTranslation('common');");
  fs.writeFileSync(vtp, text);
}
