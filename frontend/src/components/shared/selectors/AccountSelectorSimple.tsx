// Canonical re-export. The implementation lives at
// modules/accounting/components/AccountSelectorSimple.tsx for historical
// reasons; new code should import from '@/components/shared/selectors'.
// The richer `AccountSelector` (with hierarchy navigation) remains module-
// local in accounting; promote it separately when its hierarchy logic is
// generalized.
export { AccountSelectorSimple } from '../../../modules/accounting/components/AccountSelectorSimple';
