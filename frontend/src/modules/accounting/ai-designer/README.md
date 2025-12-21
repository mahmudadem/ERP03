# AI Designer - Voucher Designer & Renderer

This folder contains the original code from the `ai-designer` project, integrated into the ERP03 accounting module.

## Structure

```
ai-designer/
├── components/
│   ├── VoucherDesigner.tsx       # Main designer component (35KB)
│   ├── GenericVoucherRenderer.tsx # Main renderer component (9KB)
│   ├── JournalVoucher.tsx        # Journal voucher component
│   ├── LegacyJournalVoucher.tsx  # Legacy journal voucher
│   ├── VoucherTypeManager.tsx    # Voucher type management
│   ├── Sidebar.tsx               # Sidebar component
│   ├── WindowFrame.tsx           # Window frame wrapper
│   └── ui/
│       └── Button.tsx            # Button component
├── services/
│   └── geminiService.ts          # Gemini AI service for schema generation
├── types.ts                      # TypeScript type definitions
├── VoucherContext.tsx            # Voucher state management context
├── LanguageContext.tsx           # Language/translation context
├── index.ts                      # Main export file
└── README.md                     # This file
```

## Components

### VoucherDesigner
The main designer component that provides a visual interface for creating and editing voucher templates.

```tsx
import { VoucherDesigner } from '@/modules/accounting/ai-designer';

function MyComponent() {
  return <VoucherDesigner />;
}
```

### GenericVoucherRenderer
The renderer component that displays vouchers based on their schema/template.

```tsx
import { GenericVoucherRenderer } from '@/modules/accounting/ai-designer';

function MyComponent() {
  return <GenericVoucherRenderer voucher={voucherData} />;
}
```

## Contexts

### VoucherContext
Manages voucher state and operations.

```tsx
import { VoucherProvider, useVoucher } from '@/modules/accounting/ai-designer';

// Wrap your app
<VoucherProvider>
  <YourApp />
</VoucherProvider>

// Use in components
const { voucher, updateVoucher } = useVoucher();
```

### LanguageContext
Manages language and translations.

```tsx
import { LanguageProvider, useLanguage } from '@/modules/accounting/ai-designer';

// Wrap your app
<LanguageProvider>
  <YourApp />
</LanguageProvider>

// Use in components
const { language, setLanguage, t } = useLanguage();
```

## Services

### Gemini Service
Provides AI-powered voucher schema generation using Google's Gemini API.

```tsx
import { generateVoucherSchema, analyzeVoucherType } from '@/modules/accounting/ai-designer';

// Generate schema
const schema = await generateVoucherSchema(voucherType, options);

// Analyze voucher type
const analysis = await analyzeVoucherType(description);
```

## Original Source

This code was copied from: `ERP03/ai-designer/`

No modifications were made to preserve the original implementation of the designer and renderer.

## Integration Notes

- All original code has been preserved without changes
- The designer and renderer can be used as standalone components
- Contexts may need to be integrated with the existing ERP03 state management
- The Gemini service requires an API key to be configured

## Dependencies

Check the original `ai-designer/package.json` for required npm packages that may need to be added to the main frontend project.
