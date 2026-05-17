# Feature 05: Print Templates

## Overview
A service for managing HTML templates (Handlebars syntax) used to generate printable views and PDF exports of business documents.

## Entities

### `PrintTemplate`
```typescript
{
  id: string;
  companyId: string;
  documentType: string; // e.g., 'SalesInvoice', 'PurchaseOrder'
  name: string;
  isDefault: boolean;
  htmlContent: string; // The raw Handlebars template
  cssContent?: string;
  paperSize: 'A4' | 'Letter' | 'Receipt';
  orientation: 'portrait' | 'landscape';
}
```

## Firestore Paths
- `companies/{companyId}/shared/Data/print_templates`

## Services
- `PrintTemplateService`
  - `renderTemplate(templateId, documentData): string`
  - Merges `documentData` (e.g., the JSON representation of an invoice + company info + customer info) into the `htmlContent` using Handlebars.
  - Returns raw HTML string that frontend can throw into an iframe to print, or backend can pass to a PDF library (e.g., Puppeteer/Playwright if server-side PDF generation is needed).

## API Routes
- `GET, POST, PUT, DELETE` on `/api/shared/print-templates`
- `POST /api/shared/print-templates/render` (Preview generation)

## Frontend Pages
- **Settings → Print Templates:** A code editor (Monaco or simple textarea) to edit HTML/CSS for templates.
- **Shared Functionality:** A "Print" button on document detail pages that fetches the default template, renders it, and opens the browser's print dialog.

## Verification
- [ ] Create a trivial template for `SalesOrder`.
- [ ] Render it with mock data.
- [ ] Ensure `renderTemplate` returns correct HTML with data interpolated.
