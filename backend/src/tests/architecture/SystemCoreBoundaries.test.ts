import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');

const collectTsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
};

describe('Architecture guard: system core boundaries', () => {
  it.skip('250d: POS must not import Sales application or domain internals', () => {
    const posDir = path.resolve(SRC, 'application/pos');
    const offenders: string[] = [];
    for (const file of collectTsFiles(posDir)) {
      const content = fs.readFileSync(file, 'utf8');
      if (/from ['"]\.\.\/\.\.\/sales\//.test(content) || /from ['"].*domain\/sales\//.test(content)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('Phase 0 exposes system-core contracts through the barrel', () => {
    const barrel = fs.readFileSync(path.resolve(SRC, 'application/system-core/index.ts'), 'utf8');
    for (const contract of [
      'IDocumentCore',
      'INumberingEngine',
      'IMoneyCore',
      'ITaxEngine',
      'ICommercialCore',
      'IPolicyEngine',
      'IApprovalEngine',
      'IAccountingBridge',
      'IAuditEngine',
      'IInventoryCore',
    ]) {
      expect(barrel).toContain(`contracts/${contract}`);
    }
  });
});

