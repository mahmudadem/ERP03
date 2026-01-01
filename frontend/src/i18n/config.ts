import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: {
          errors: {
            AUTH_001: "Invalid email or password. Please try again.",
            AUTH_002: "Your session has expired. Please log in again.",
            AUTH_003: "Invalid authentication token. Please log in again.",
            AUTH_004: "You don't have permission to perform this action.",
            AUTH_005: "User account not found.",
            AUTH_006: "This account has been disabled. Please contact support.",
            VAL_001: "{{field}} is required.",
            VAL_002: "{{field}} has an invalid format.",
            VAL_003: "{{field}} already exists. Please use a different value.",
            VAL_004: "{{field}} must be between {{min}} and {{max}}.",
            VAL_005: "{{field}} has an invalid type.",
            VAL_006: "{{field}} length must be between {{min}} and {{max}} characters.",
            VOUCH_001: "This voucher has already been approved and cannot be modified.",
            VOUCH_002: "This voucher has already been posted and cannot be modified.",
            VOUCH_003: "Voucher not found.",
            VOUCH_004: "Cannot update voucher because it is {{status}}.",
            VOUCH_005: "Voucher is unbalanced. Total debits must equal total credits.",
            VOUCH_006: "Voucher must have at least one line item.",
            VOUCH_007: "This voucher is locked and cannot be modified.",
            ACC_001: "Insufficient balance in account {{accountName}}.",
            ACC_002: "Account not found.",
            ACC_003: "This account is inactive and cannot be used.",
            ACC_004: "The accounting period is closed. Cannot post transactions.",
            ACC_005: "Invalid account type for this operation.",
            INFRA_001: "Database error occurred. Please try again later.",
            INFRA_002: "Network error. Please check your connection and try again.",
            INFRA_003: "Service temporarily unavailable. Please try again later.",
            INFRA_004: "Request timed out. Please try again.",
            INFRA_999: "An unexpected error occurred. Please contact support if this persists."
          },
          success: {
            voucher_saved: "Voucher saved successfully!",
            voucher_submitted: "Voucher submitted for approval!",
            voucher_approved: "Voucher approved successfully!",
            voucher_rejected: "Voucher rejected.",
            voucher_deleted: "Voucher deleted successfully!",
            form_saved: "Form saved successfully!",
            settings_updated: "Settings updated successfully!"
          },
          fields: {
            voucherNumber: "Voucher No.",
            status: "Status",
            createdBy: "Created By",
            createdAt: "Created At",
            date: "Date",
            currency: "Currency",
            exchangeRate: "Exchange Rate",
            reference: "Reference",
            notes: "Notes",
            description: "Description",
            attachments: "Attachments",
            account: "Account",
            debit: "Debit",
            credit: "Credit",
            amount: "Amount",
            lineDescription: "Line Description",
            costCenter: "Cost Center",
            parity: "Parity",
            equivalent: "Equivalent"
          }
        }
      },
      ar: {
        common: {
          errors: {
            AUTH_001: "البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.",
            AUTH_002: "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
            AUTH_003: "رمز المصادقة غير صالح. يرجى تسجيل الدخول مرة أخرى.",
            AUTH_004: "ليس لديك إذن لتنفيذ هذا الإجراء.",
            AUTH_005: "لم يتم العثور على حساب المستخدم.",
            AUTH_006: "تم تعطيل هذا الحساب. يرجى الاتصال بالدعم.",
            VAL_001: "{{field}} مطلوب.",
            VAL_002: "{{field}} له تنسيق غير صالح.",
            VAL_003: "{{field}} موجود بالفعل. يرجى استخدام قيمة مختلفة.",
            VAL_004: "يجب أن يكون {{field}} بين {{min}} و {{max}}.",
            VAL_005: "{{field}} له نوع غير صالح.",
            VAL_006: "يجب أن يكون طول {{field}} بين {{min}} و {{max}} حرفًا.",
            VOUCH_001: "تمت الموافقة على هذا القيد بالفعل ولا يمكن تعديله.",
            VOUCH_002: "تم ترحيل هذا القيد بالفعل ولا يمكن تعديله.",
            VOUCH_003: "لم يتم العثور على القيد.",
            VOUCH_004: "لا يمكن تحديث القيد. الحالة الحالية: {{status}}.",
            VOUCH_005: "القيد غير متوازن. يجب أن تساوي إجمالي المدين إجمالي الدائن.",
            VOUCH_006: "يجب أن يحتوي القيد على بند واحد على الأقل.",
            VOUCH_007: "هذا القيد مقفل ولا يمكن تعديله.",
            ACC_001: "رصيد غير كافٍ في الحساب {{accountName}}.",
            ACC_002: "لم يتم العثور على الحساب.",
            ACC_003: "هذا الحساب غير نشط ولا يمكن استخدامه.",
            ACC_004: "الفترة المحاسبية مغلقة. لا يمكن ترحيل المعاملات.",
            ACC_005: "نوع حساب غير صالح لهذه العملية.",
            INFRA_001: "حدث خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى لاحقًا.",
            INFRA_002: "خطأ في الشبكة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
            INFRA_003: "الخدمة غير متوفرة مؤقتًا. يرجى المحاولة مرة أخرى لاحقًا.",
            INFRA_004: "انتهت مهلة الطلب. يرجى المحاولة مرة أخرى.",
            INFRA_999: "حدث خطأ غير متوقع. يرجى الاتصال بالدعم إذا استمر هذا."
          },
          success: {
            voucher_saved: "تم حفظ القيد بنجاح!",
            voucher_submitted: "تم إرسال القيد للموافقة!",
            voucher_approved: "تمت الموافقة على القيد بنجاح!",
            voucher_rejected: "تم رفض القيد.",
            voucher_deleted: "تم حذف القيد بنجاح!",
            form_saved: "تم حفظ النموذج بنجاح!",
            settings_updated: "تم تحديث الإعدادات بنجاح!"
          },
          fields: {
            voucherNumber: "رقم القيد",
            status: "الحالة",
            createdBy: "أنشئ بواسطة",
            createdAt: "تاريخ الإنشاء",
            date: "التاريخ",
            currency: "العملة",
            exchangeRate: "سعر الصرف",
            reference: "المرجع",
            notes: "ملاحظات",
            description: "الوصف",
            attachments: "المرفقات",
            account: "الحساب",
            debit: "مدين",
            credit: "دائن",
            amount: "المبلغ",
            lineDescription: "وصف البند",
            costCenter: "مركز التكلفة",
            parity: "التعادل",
            equivalent: "المعادل"
          }
        }
      }
    },
    lng: 'en', // Default language
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
