"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCashLikeAccount = void 0;
const LEGACY_CASH_ROLES = new Set([
    'CASH',
    'BANK',
    'PETTY_CASH',
    'BANK_ACCOUNT',
]);
const CASH_HINTS = [
    'cash',
    'bank',
    'petty',
    'treasury',
    'register',
    'safe',
    'vault',
    'kasa',
    'banka',
];
const CASH_CODE_PREFIXES = ['101', '102'];
function isCashLikeAccount(account) {
    if (!account)
        return false;
    const classification = String(account.classification || '').toUpperCase();
    if (classification !== 'ASSET')
        return false;
    const role = String(account.accountRole || '').toUpperCase();
    if (LEGACY_CASH_ROLES.has(role))
        return true;
    // Ignore structural/header rows to avoid including aggregate nodes.
    if (role === 'HEADER')
        return false;
    const text = `${account.name || ''} ${account.userCode || ''} ${account.systemCode || ''}`.toLowerCase();
    if (CASH_HINTS.some((hint) => text.includes(hint)))
        return true;
    const numericCode = String(account.userCode || account.systemCode || '').replace(/[^0-9]/g, '');
    return CASH_CODE_PREFIXES.some((prefix) => numericCode.startsWith(prefix));
}
exports.isCashLikeAccount = isCashLikeAccount;
//# sourceMappingURL=cashAccountMatcher.js.map