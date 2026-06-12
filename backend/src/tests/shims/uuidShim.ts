/**
 * Jest-only shim for the `uuid` package.
 *
 * uuid@14 ships ESM-only (`"type": "module"`, no CommonJS entry). Jest runs under
 * ts-jest's CommonJS runtime, which can't parse uuid's `export ...` syntax, so any
 * test suite that (transitively) imports a file using `uuid` fails to load with
 * `SyntaxError: Unexpected token 'export'` — silently disabling whole suites.
 *
 * Every production import is `import { v4 as uuidv4 } from 'uuid'`, so this shim
 * only needs `v4`, backed by Node's built-in crypto. It is wired in via
 * `moduleNameMapper` in jest.config.js and never affects the production bundle.
 */
import { randomUUID } from 'crypto';

export const v4 = (): string => randomUUID();

export default { v4 };
