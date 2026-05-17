# Feature 02: Unit of Measure (UoM) Conversion

## Overview
A system for handling different units for inventory tracking (base UoM) and purchases/sales (transaction UoM).

## Entities

### `UnitOfMeasure`
```typescript
{
  id: string; // e.g., 'kg', 'pcs', 'box', 'pallet'
  companyId: string;
  code: string;
  name: string;
  isActive: boolean;
}
```

### `UoMConversion`
```typescript
{
  id: string;
  companyId: string;
  itemId?: string; // Optional: specific to an item
  fromUomId: string;
  toUomId: string;
  factor: number; // multiplier: [from] * factor = [to]
}
```

## Firestore Paths
- `companies/{companyId}/shared/Data/units_of_measure`
- `companies/{companyId}/shared/Data/uom_conversions`

## Services
- `UoMConversionService`
  - `convert(quantity: number, fromUom: string, toUom: string, itemId?: string): number`
  - Uses item-specific conversion first, falls back to global conversion.
  - Throws error if no conversion path found.

## API Routes
- `GET, POST, PUT, DELETE` on `/api/shared/units-of-measure`
- `GET, POST, PUT, DELETE` on `/api/shared/uom-conversions`

## Frontend Pages
- **Settings → Units of Measure:** Manage global UoMs and global conversions.
- **Inventory → Item Form:** New tab to manage item-specific UoM conversions.

## Verification
- [ ] Create Box and Pieces UoM. Create conversion: 1 Box = 12 Pieces.
- [ ] Sell 2 Boxes; verify inventory reduces by 24 Pieces.
