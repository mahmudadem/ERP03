import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(frontendDir, 'src');
const localesDir = path.join(srcDir, 'locales');
const configPath = path.join(srcDir, 'i18n', 'config.ts');
const languages = ['en', 'ar', 'tr'];
const failures = [];

const config = fs.readFileSync(configPath, 'utf8');

const configNsMatch = config.match(/ns:\s*\[([^\]]+)\]/m);
if (!configNsMatch) {
  failures.push('Could not find i18n ns array in config.ts');
}

const configuredNamespaces = new Set(
  [...(configNsMatch?.[1] || '').matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]),
);

for (const language of languages) {
  const files = fs.readdirSync(path.join(localesDir, language)).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const namespace = file.replace(/\.json$/, '');
    if (!configuredNamespaces.has(namespace)) {
      failures.push(`${language}/${file} exists but namespace "${namespace}" is not listed in i18n config ns`);
    }

    const importName = `${language}${namespace[0].toUpperCase()}${namespace.slice(1)}`;
    if (!config.includes(`import ${importName} from '../locales/${language}/${file}'`)) {
      failures.push(`${language}/${file} exists but config.ts does not import it as ${importName}`);
    }

    if (!new RegExp(`${namespace}:\\s*${importName}\\b`).test(config)) {
      failures.push(`${language}/${file} exists but resources.${language}.${namespace} is not wired`);
    }
  }

  for (const namespace of configuredNamespaces) {
    const localePath = path.join(localesDir, language, `${namespace}.json`);
    if (!fs.existsSync(localePath)) {
      failures.push(`Namespace "${namespace}" is configured but ${language}/${namespace}.json is missing`);
    }
  }
}

const sourceFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      walk(fullPath);
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(fullPath);
    }
  }
};
walk(srcDir);

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/useTranslation\((['"])([^'"]+)\1/g)) {
    const namespace = match[2];
    if (!configuredNamespaces.has(namespace)) {
      failures.push(`${path.relative(frontendDir, file)} uses unconfigured i18n namespace "${namespace}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check-i18n-config] FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[check-i18n-config] OK - ${configuredNamespaces.size} namespaces wired for ${languages.join('/')}.`);
