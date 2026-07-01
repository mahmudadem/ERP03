import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(frontendDir, '..');
const seedSourcePath = path.join(repoDir, 'backend', 'src', 'seeder', 'seedSystemVoucherTypes.ts');

if (!fs.existsSync(seedSourcePath)) {
  if (process.env.VERCEL) {
    console.warn(
      `[check-voucher-locales] SKIP — backend seed source is not available in Vercel frontend-only build: ${seedSourcePath}`,
    );
    process.exit(0);
  }

  throw new Error(`Voucher seed source not found: ${seedSourcePath}`);
}

const seedSource = fs.readFileSync(seedSourcePath, 'utf8');
const resolverSource = fs.readFileSync(
  path.join(frontendDir, 'src', 'utils', 'voucherDisplayName.ts'),
  'utf8',
);

const seededCodes = [
  ...new Set([...seedSource.matchAll(/^\s*code:\s*"([^"]+)"/gm)].map((match) => match[1])),
];

const mapBlock = resolverSource.match(
  /const TRANSLATION_KEY_BY_CODE:[\s\S]*?=\s*\{([\s\S]*?)\n\};/,
)?.[1];
if (!mapBlock) {
  throw new Error('Could not read TRANSLATION_KEY_BY_CODE from voucherDisplayName.ts');
}

const translationKeyByCode = Object.fromEntries(
  [...mapBlock.matchAll(/^\s{2}([a-z0-9_]+):\s*'([^']+)'/gm)]
    .map((match) => [match[1], match[2]]),
);

const failures = [];
for (const code of seededCodes) {
  if (!translationKeyByCode[code]) {
    failures.push(`Missing resolver mapping for seeded voucher code "${code}"`);
  }
}

const locales = {};
for (const language of ['en', 'ar', 'tr']) {
  const locale = JSON.parse(
    fs.readFileSync(path.join(frontendDir, 'src', 'locales', language, 'common.json'), 'utf8'),
  );
  locales[language] = locale;
  for (const code of seededCodes) {
    const key = translationKeyByCode[code];
    if (!key || !String(locale.defaultVoucherNames?.[key] || '').trim()) {
      failures.push(`Missing ${language} defaultVoucherNames.${key || code}`);
    }
  }
}

const compiledResolver = ts.transpileModule(resolverSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const resolverModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledResolver).toString('base64')}`,
);
const arabicT = (key, options) => {
  const localeKey = String(key).replace(/^defaultVoucherNames\./, '');
  return locales.ar.defaultVoucherNames?.[localeKey] || options?.defaultValue || key;
};

const arabicPayment = resolverModule.resolveVoucherDisplayName(arabicT, {
  name: 'Payment Voucher',
  code: 'payment',
  isSystemGenerated: true,
});
if (arabicPayment !== 'سند صرف') {
  failures.push(`Arabic resolver returned "${arabicPayment}" for payment`);
}

const customName = 'فاتورة الجملة الخاصة';
const preservedCustomName = resolverModule.resolveVoucherDisplayName(arabicT, {
  name: customName,
  code: 'sales_invoice_direct',
  isDefault: false,
  isSystemGenerated: false,
  isLocked: false,
});
if (preservedCustomName !== customName) {
  failures.push('Tenant custom form names must not be translated or overwritten');
}

if (failures.length > 0) {
  console.error('[check-voucher-locales] FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `[check-voucher-locales] OK — ${seededCodes.length} seeded voucher templates covered in EN/AR/TR.`,
);
