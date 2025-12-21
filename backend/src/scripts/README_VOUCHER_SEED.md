# Default Voucher Types Seeder

## What It Does

Seeds **4 default voucher types** to `system_metadata/voucher_types/items/`:

1. **Journal Entry** (JE-)
2. **Payment Voucher** (PV-)
3. **Receipt Voucher** (RV-)
4. **Invoice** (INV-)

These are system-wide templates that ANY company can use as starting points.

---

## How to Run

### From Backend Directory:

```bash
cd backend
npm run seed:vouchers
```

**OR**

```bash
cd backend
ts-node --transpile-only src/scripts/seedDefaultVoucherTypes.ts
```

---

## Output Example:

```
🌱 Starting to seed default voucher types...
  ✅ Prepared: Journal Entry (JE-)
  ✅ Prepared: Payment Voucher (PV-)
  ✅ Prepared: Receipt Voucher (RV-)
  ✅ Prepared: Invoice (INV-)

✅ SUCCESS! Seeded default voucher types to Firestore
   Location: system_metadata/voucher_types/items/
   Count: 4 voucher types

Default Voucher Types:
  - Journal Entry (JE-) - JOURNAL_ENTRY
  - Payment Voucher (PV-) - PAYMENT_VOUCHER
  - Receipt Voucher (RV-) - RECEIPT_VOUCHER
  - Invoice (INV-) - INVOICE

🎉 Seed completed successfully!
```

---

## Firestore Structure Created:

```
system_metadata (collection)
  └─ voucher_types (document)
      └─ items (subcollection)
          ├─ journal_entry (document)
          ├─ payment_voucher (document)
          ├─ receipt_voucher (document)
          └─ invoice (document)
```

---

## Each Voucher Type Includes:

- ✅ Complete layout (classic & windows modes)
- ✅ Field configurations
- ✅ Table columns
- ✅ Business rules (approval, cash validation, etc.)
- ✅ Enabled actions (print, email, PDF)
- ✅ System metadata (timestamps, flags)

---

## After Seeding:

1. **Frontend will load** these as templates in Step 1
2. **Users can select** them when creating new vouchers
3. **Companies can clone** them to create custom versions
4. **Readonly** - cannot be edited by companies (must clone)

---

## To Modify Templates:

1. Edit `seedDefaultVoucherTypes.ts`
2. Update the voucher definitions
3. Re-run the seed script

**Note:** Re-running will overwrite existing templates!

---

## Environment:

- Uses Firebase Admin SDK
- Connects to emulator if `FIRESTORE_EMULATOR_HOST` is set
- Otherwise connects to production Firestore

---

**Ready to seed!** 🌱
