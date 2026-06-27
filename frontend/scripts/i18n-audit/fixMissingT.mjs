import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

const filesToFix = [
  'src/components/ui/DataTable/DataTable.tsx',
  'src/layout/WindowManager.tsx',
  'src/modules/accounting/pages/settings/components/ExchangeRateHistory.tsx',
  'src/modules/accounting/pages/settings/components/ExchangeRateMatrix.tsx',
  'src/modules/ai-assistant/pages/ChatGptMockPage.tsx',
  'src/modules/inventory/pages/StockAdjustmentPage.tsx',
  'src/modules/purchases/pages/VendorStatementPage.tsx',
  'src/modules/sales/pages/CustomerStatementPage.tsx',
  'src/modules/shared/pages/settings/components/ExchangeRateHistory.tsx',
  'src/modules/shared/pages/settings/components/ExchangeRateMatrix.tsx',
  'src/modules/super-admin/pages/AiSetupWizardPage.tsx',
  'src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx',
  'src/pages/dev/apex-ledger/components/reports/ApexCashFlow.tsx',
  'src/pages/super-admin/pages/SuperAdminFieldLibraryPage.tsx'
];

for (const filePath of filesToFix) {
  const sf = project.getSourceFile(filePath);
  if (!sf) {
    console.log(`Could not find ${filePath}`);
    continue;
  }
  
  // Inject import if needed
  const imports = sf.getImportDeclarations();
  const hasImport = imports.some(i => i.getModuleSpecifierValue() === 'react-i18next');
  if (!hasImport) {
    sf.addImportDeclaration({
      namedImports: ['useTranslation'],
      moduleSpecifier: 'react-i18next'
    });
  }

  // Find the top-level React component (first function declaration or arrow function assigned to variable that starts with Capital)
  let componentBody = null;
  
  for (const func of sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
      const name = func.getName();
      if (name && /^[A-Z]/.test(name)) {
          componentBody = func.getBody();
          break;
      }
  }

  if (!componentBody) {
      for (const arrow of sf.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
          const parent = arrow.getParent();
          if (parent.isKind(SyntaxKind.VariableDeclaration)) {
              const name = parent.getName();
              if (name && /^[A-Z]/.test(name)) {
                  componentBody = arrow.getBody();
                  break;
              }
          }
      }
  }

  if (componentBody && componentBody.isKind(SyntaxKind.Block)) {
      const text = componentBody.getText();
      if (!text.includes('useTranslation')) {
          componentBody.insertStatements(0, `const { t } = useTranslation('common');`);
      }
  } else {
      console.log(`Could not find component body in ${filePath}`);
  }

  sf.saveSync();
  console.log(`Fixed ${filePath}`);
}

// Fix VoucherTemplateEditorPage (duplicate t)
const vtp = project.getSourceFile('src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx');
if (vtp) {
  const block = vtp.getText();
  // We can just remove the second one or replace Duplicate identifiers
  // I will just use a regex replace for duplicate t in the file
  let newText = block.replace(/const { t } = useTranslation\('common'\);\s*const { t } = useTranslation\('common'\);/g, "const { t } = useTranslation('common');");
  fs.writeFileSync(vtp.getFilePath(), newText);
  console.log(`Fixed duplicate t in VoucherTemplateEditorPage`);
}

