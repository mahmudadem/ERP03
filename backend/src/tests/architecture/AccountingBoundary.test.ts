import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIRS = [
  path.resolve(__dirname, '../../application/purchases/use-cases'),
  path.resolve(__dirname, '../../application/sales/use-cases'),
  path.resolve(__dirname, '../../application/inventory/use-cases'),
];

const BANNED_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Direct IVoucherRepository dependency',
    pattern: /\bIVoucherRepository\b/,
  },
  {
    label: 'Direct ILedgerRepository dependency',
    pattern: /\bILedgerRepository\b/,
  },
  {
    label: 'Direct voucherRepo usage',
    pattern: /\bvoucherRepo\./,
  },
  {
    label: 'Direct ledgerRepo usage',
    pattern: /\bledgerRepo\./,
  },
];

const collectTsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
};

describe('Architecture guard: accounting boundary', () => {
  it('purchases/sales/inventory use-cases do not directly depend on voucher/ledger repositories', () => {
    const files = TARGET_DIRS.flatMap((dir) => collectTsFiles(dir));
    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');

      for (const rule of BANNED_RULES) {
        if (rule.pattern.test(content)) {
          const relativePath = path.relative(path.resolve(__dirname, '../..'), filePath);
          violations.push(`${relativePath}: ${rule.label}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

