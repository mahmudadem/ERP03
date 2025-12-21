import React, { createContext, useContext, useState, useEffect } from 'react';

type Direction = 'ltr' | 'rtl';
type Language = 'en' | 'ar';

interface LanguageContextType {
  direction: Direction;
  language: Language;
  toggleLanguage: () => void;
  isRTL: boolean;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: "Dashboard",
    vouchers: "Vouchers",
    journalVoucher: "Journal Voucher",
    legacyJournalVoucher: "Legacy Journal Entry",
    paymentVoucher: "Payment Voucher",
    receiptVoucher: "Receipt Voucher",
    accounts: "Accounts",
    finance: "Finance",
    settings: "Settings",
    close: "Close",
    minimize: "Minimize",
    save: "Save",
    print: "Print",
    audit: "Audit",
    preview: "Preview",
    delete: "Delete",
    new: "New",
    add: "Add",
    modify: "Modify",
    dataTools: "Data Tools",
    importImage: "Import Image",
    exportCSV: "Export CSV",
    account: "Account",
    notes: "Notes",
    debit: "Debit",
    credit: "Credit",
    currency: "Currency",
    parity: "Parity",
    equivalent: "Equivalent",
    category: "Category",
    date: "Date",
    postingDate: "Posting Date",
    sum: "Sum",
    diff: "Diff",
    securityLevel: "Security Level",
    appName: "CloudERP",
    // New Legacy Voucher Keys
    exchangeRate: "Exchange Rate (to base)",
    transactionCurrency: "Transaction Currency",
    referenceDocument: "Reference Document",
    documentNumber: "Document Number",
    paymentMethod: "Payment Method",
    submitForApproval: "Submit for Approval",
    saveAsDraft: "Save as Draft",
    cancel: "Cancel",
    created: "Created",
    status: "Status",
    pending: "Pending",
    description: "Description",
    totalDebit: "Total Debit",
    totalCredit: "Total Credit",
    totalAmount: "Total Amount",
    addLine: "Add Line"
  },
  ar: {
    dashboard: "لوحة القيادة",
    vouchers: "السندات",
    journalVoucher: "سند قيد",
    legacyJournalVoucher: "سند قيد (قديم)",
    paymentVoucher: "سند صرف",
    receiptVoucher: "سند قبض",
    accounts: "الحسابات",
    finance: "المالية",
    settings: "الإعدادات",
    close: "إغلاق",
    minimize: "تصغير",
    save: "حفظ",
    print: "طباعة",
    audit: "تدقيق",
    preview: "معاينة",
    delete: "حذف",
    new: "جديد",
    add: "إضافة",
    modify: "تعديل",
    dataTools: "أدوات البيانات",
    importImage: "استيراد صورة",
    exportCSV: "تصدير CSV",
    account: "الحساب",
    notes: "البيان",
    debit: "مدين",
    credit: "دائن",
    currency: "العملة",
    parity: "سعر الصرف",
    equivalent: "المكافئ",
    category: "التصنيف",
    date: "التاريخ",
    postingDate: "تاريخ الترحيل",
    sum: "المجموع",
    diff: "الفرق",
    securityLevel: "مستوى الأمان",
    appName: "سحابة ERP",
    // New Legacy Voucher Keys
    exchangeRate: "سعر الصرف (للعملة الأساسية)",
    transactionCurrency: "عملة المعاملة",
    referenceDocument: "مستند مرجعي",
    documentNumber: "رقم السند",
    paymentMethod: "طريقة الدفع",
    submitForApproval: "إرسال للموافقة",
    saveAsDraft: "حفظ مسودة",
    cancel: "إلغاء",
    created: "تم الإنشاء",
    status: "الحالة",
    pending: "قيد الانتظار",
    description: "الوصف",
    totalDebit: "مجموع المدين",
    totalCredit: "مجموع الدائن",
    totalAmount: "المبلغ الإجمالي",
    addLine: "إضافة سطر"
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [direction, setDirection] = useState<Direction>('ltr');

  useEffect(() => {
    // Update HTML dir attribute
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

  const toggleLanguage = () => {
    setLanguage(prev => {
      const newLang = prev === 'en' ? 'ar' : 'en';
      setDirection(newLang === 'ar' ? 'rtl' : 'ltr');
      return newLang;
    });
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ direction, language, toggleLanguage, isRTL: direction === 'rtl', t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};