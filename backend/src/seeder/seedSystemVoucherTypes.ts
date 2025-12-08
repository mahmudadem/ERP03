import { VoucherTypeDefinition } from '../domain/designer/entities/VoucherTypeDefinition';
import { randomUUID } from 'crypto';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

const SYSTEM_COMPANY_ID = 'SYSTEM';

const templates = [
  {
    name: "Vendor Payment",
    code: "PAYMENT",
    module: "ACCOUNTING",
    headerFields: [
      { id: "vendorAccountId", label: "Vendor", type: "ACCOUNT_SELECT", required: true, config: { filterType: "LIABILITY" } },
      { id: "cashAccountId", label: "Pay From", type: "ACCOUNT_SELECT", required: true, config: { filterType: "ASSET" } },
      { id: "amount", label: "Amount", type: "NUMBER", required: true },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1 },
      { id: "description", label: "Description", type: "TEXT" }
    ],
    tableColumns: [],
    layout: {
      sections: [
        { id: "main", title: "Payment Details", fieldIds: ["vendorAccountId", "cashAccountId", "amount", "currency", "exchangeRate", "description"] }
      ]
    },
    workflow: { approvalRequired: true }
  },
  {
    name: "Customer Receipt",
    code: "RECEIPT",
    module: "ACCOUNTING",
    headerFields: [
      { id: "customerAccountId", label: "Customer", type: "ACCOUNT_SELECT", required: true, config: { filterType: "ASSET" } }, // Accounts Receivable
      { id: "cashAccountId", label: "Deposit To", type: "ACCOUNT_SELECT", required: true, config: { filterType: "ASSET" } },
      { id: "amount", label: "Amount", type: "NUMBER", required: true },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1 },
      { id: "description", label: "Description", type: "TEXT" }
    ],
    tableColumns: [],
    layout: {
      sections: [
        { id: "main", title: "Receipt Details", fieldIds: ["customerAccountId", "cashAccountId", "amount", "currency", "exchangeRate", "description"] }
      ]
    },
    workflow: { approvalRequired: true }
  },
  {
    name: "Currency Exchange",
    code: "FX",
    module: "ACCOUNTING",
    headerFields: [
      { id: "buyAccountId", label: "Buy Account", type: "ACCOUNT_SELECT", required: true },
      { id: "sellAccountId", label: "Sell Account", type: "ACCOUNT_SELECT", required: true },
      { id: "buyAmount", label: "Buy Amount", type: "NUMBER", required: true },
      { id: "sellAmount", label: "Sell Amount", type: "NUMBER", required: true },
      { id: "buyCurrency", label: "Buy Currency", type: "CURRENCY_SELECT", required: true },
      { id: "sellCurrency", label: "Sell Currency", type: "CURRENCY_SELECT", required: true },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", required: true },
      { id: "description", label: "Description", type: "TEXT" }
    ],
    tableColumns: [],
    layout: {
      sections: [
        { id: "main", title: "Exchange Details", fieldIds: ["buyAccountId", "sellAccountId", "buyAmount", "sellAmount", "buyCurrency", "sellCurrency", "exchangeRate", "description"] }
      ]
    },
    workflow: { approvalRequired: true }
  },
  {
    name: "Bank Transfer",
    code: "TRANSFER",
    module: "ACCOUNTING",
    headerFields: [
      { id: "fromAccountId", label: "From Account", type: "ACCOUNT_SELECT", required: true },
      { id: "toAccountId", label: "To Account", type: "ACCOUNT_SELECT", required: true },
      { id: "amount", label: "Amount", type: "NUMBER", required: true },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true },
      { id: "description", label: "Description", type: "TEXT" }
    ],
    tableColumns: [],
    layout: {
      sections: [
        { id: "main", title: "Transfer Details", fieldIds: ["fromAccountId", "toAccountId", "amount", "currency", "description"] }
      ]
    },
    workflow: { approvalRequired: true }
  },
  {
    name: "Journal Voucher",
    code: "JOURNAL",
    module: "ACCOUNTING",
    headerFields: [
      { id: "date", label: "Date", type: "DATE", required: true },
      { id: "reference", label: "Reference", type: "TEXT" },
      { id: "description", label: "Description", type: "TEXT" }
    ],
    tableColumns: [
      { fieldId: "accountId", width: "200px" },
      { fieldId: "debit", width: "100px" },
      { fieldId: "credit", width: "100px" },
      { fieldId: "description", width: "200px" }
    ],
    layout: {
      sections: [
        { id: "header", title: "Journal Header", fieldIds: ["date", "reference", "description"] }
      ]
    },
    workflow: { approvalRequired: true }
  }
];

export const seedSystemVoucherTypes = async (repo: IVoucherTypeDefinitionRepository) => {
  console.log('Seeding System Voucher Types...');
  
  const existingTemplates = await repo.getSystemTemplates();
  const existingCodes = new Set(existingTemplates.map(t => t.code));
  
  for (const t of templates) {
    if (!existingCodes.has(t.code)) {
      const id = randomUUID();
      const def = new VoucherTypeDefinition(
        id,
        SYSTEM_COMPANY_ID,
        t.name,
        t.code,
        t.module,
        t.headerFields as any[],
        t.tableColumns as any[],
        t.layout,
        t.workflow
      );
      
      await repo.createVoucherType(def);
      console.log(`Created template: ${t.name}`);
    } else {
      console.log(`Template ${t.name} already exists.`);
    }
  }
  
  console.log('System Voucher Types Seeding Complete.');
};
