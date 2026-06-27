import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

const sourceFiles = project.getSourceFiles('src/**/*.{ts,tsx}');
let totalFixed = 0;

function isReactComponent(node) {
  // Check if function name starts with uppercase
  let name = null;
  if (node.isKind(SyntaxKind.FunctionDeclaration)) {
    name = node.getName();
  } else if (node.isKind(SyntaxKind.ArrowFunction) || node.isKind(SyntaxKind.FunctionExpression)) {
    const parent = node.getParent();
    if (parent.isKind(SyntaxKind.VariableDeclaration)) {
      name = parent.getName();
    }
  }
  
  if (name && /^[A-Z]/.test(name)) {
    // Check if it has JSX in it
    const jsx = node.getDescendantsOfKind(SyntaxKind.JsxElement);
    const jsxSelf = node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
    const jsxFrag = node.getDescendantsOfKind(SyntaxKind.JsxFragment);
    if (jsx.length > 0 || jsxSelf.length > 0 || jsxFrag.length > 0) {
      return true;
    }
  }
  return false;
}

for (const sf of sourceFiles) {
  let modified = false;
  let needsUseTranslation = false;
  let needsGlobalI18n = false;

  const componentsToInject = new Set();

  // Fix toast.success / error
  const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression).reverse();
  for (const call of callExpressions) {
    const expr = call.getExpression();
    if (expr.getText() === 'toast.success' || expr.getText() === 'toast.error' || expr.getText() === 'toast') {
      const args = call.getArguments();
      if (args.length > 0 && args[0].isKind(SyntaxKind.StringLiteral)) {
        const text = args[0].getText(); // includes quotes
        // Check if inside a React component
        const parentFunc = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                           call.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                           call.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
        
        let inReact = false;
        if (parentFunc && isReactComponent(parentFunc)) {
          inReact = true;
          componentsToInject.add(parentFunc);
          needsUseTranslation = true;
        } else {
          needsGlobalI18n = true;
        }

        if (inReact) {
          args[0].replaceWithText(`t(${text})`);
        } else {
          args[0].replaceWithText(`i18n.t(${text})`);
        }
        modified = true;
        totalFixed++;
      }
    }
  }

  // Fix JSX Text
  const jsxTexts = sf.getDescendantsOfKind(SyntaxKind.JsxText).reverse();
  for (const jsxText of jsxTexts) {
    const text = jsxText.getText();
    // Skip if it contains brackets (likely has expressions or is already translated) or newlines
    if (/[a-zA-Z]/.test(text) && !/^\s*$/.test(text) && !text.includes('{') && !text.includes('}') && !text.includes('\n')) {
      const trimmed = text.trim();
      const parentFunc = jsxText.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                         jsxText.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ||
                         jsxText.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
      
      if (parentFunc && isReactComponent(parentFunc)) {
        componentsToInject.add(parentFunc);
        needsUseTranslation = true;
      }
      
      const leadingSpace = text.match(/^\s*/)[0];
      const trailingSpace = text.match(/\s*$/)[0];
      
      // Escape backticks
      const escapedText = trimmed.replace(/`/g, "\\`");
      
      jsxText.replaceWithText(`${leadingSpace}{t(\`${escapedText}\`)}${trailingSpace}`);
      modified = true;
      totalFixed++;
    }
  }

  if (modified) {
    // Inject imports
    if (needsUseTranslation) {
      const imports = sf.getImportDeclarations();
      const hasImport = imports.some(i => i.getModuleSpecifierValue() === 'react-i18next');
      if (!hasImport) {
        sf.addImportDeclaration({
          namedImports: ['useTranslation'],
          moduleSpecifier: 'react-i18next'
        });
      }

      // Inject hook into components
      for (const comp of componentsToInject) {
        const body = comp.getBody();
        if (body && body.isKind(SyntaxKind.Block)) {
          const bodyText = body.getText();
          if (!bodyText.includes('useTranslation')) {
            body.insertStatements(0, `const { t } = useTranslation('common');`);
          }
        }
      }
    }

    if (needsGlobalI18n) {
      const imports = sf.getImportDeclarations();
      const hasImport = imports.some(i => i.getModuleSpecifierValue() === 'i18next');
      if (!hasImport) {
        sf.addImportDeclaration({
          defaultImport: 'i18n',
          moduleSpecifier: 'i18next'
        });
      }
    }

    sf.saveSync();
    console.log(`Updated ${sf.getFilePath()}`);
  }
}

console.log(`Successfully fixed ${totalFixed} translations!`);
