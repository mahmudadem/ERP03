import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

const sourceFiles = project.getSourceFiles('src/**/*.{ts,tsx}');

let leakCount = 0;

for (const sf of sourceFiles) {
  let fileHasLeaks = false;
  const filePath = sf.getFilePath();

  // Find toast.success('string') and toast.error('string')
  const callExpressions = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExpressions) {
    const expr = call.getExpression();
    if (expr.getText() === 'toast.success' || expr.getText() === 'toast.error') {
      const args = call.getArguments();
      if (args.length > 0 && (args[0].isKind(SyntaxKind.StringLiteral) || args[0].isKind(SyntaxKind.NoSubstitutionTemplateLiteral))) {
        console.log(`[TOAST LEAK] ${filePath}:${call.getStartLineNumber()} => ${args[0].getText()}`);
        fileHasLeaks = true;
        leakCount++;
      }
    }
  }

  // Find JSX text nodes with letters
  const jsxTexts = sf.getDescendantsOfKind(SyntaxKind.JsxText);
  for (const jsxText of jsxTexts) {
    const text = jsxText.getText();
    if (/[a-zA-Z]/.test(text) && !/^\s*$/.test(text)) {
      console.log(`[JSX TEXT LEAK] ${filePath}:${jsxText.getStartLineNumber()} => ${text.trim()}`);
      fileHasLeaks = true;
      leakCount++;
    }
  }
}

console.log(`Total potential leaks found: ${leakCount}`);
