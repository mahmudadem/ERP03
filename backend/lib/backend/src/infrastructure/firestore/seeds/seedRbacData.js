"use strict";
/**
 * Seed script to populate initial RBAC permissions and system role templates
 * Run this once to initialize the Firestore database with permission data
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedRbacData = void 0;
const admin = __importStar(require("firebase-admin"));
const permissions = [
    // Accounting
    { id: 'accounting.vouchers.create', category: 'accounting', labelEn: 'Create Voucher', labelAr: 'إنشاء سند', labelTr: 'Fiş Oluştur', descriptionEn: 'Create new accounting vouchers' },
    { id: 'accounting.vouchers.view', category: 'accounting', labelEn: 'View Vouchers', labelAr: 'عرض السندات', labelTr: 'Fişleri Görüntüle', descriptionEn: 'View existing vouchers' },
    { id: 'accounting.vouchers.edit', category: 'accounting', labelEn: 'Edit Voucher', labelAr: 'تعديل سند', labelTr: 'Fiş Düzenle', descriptionEn: 'Edit draft vouchers' },
    { id: 'accounting.vouchers.approve', category: 'accounting', labelEn: 'Approve Voucher', labelAr: 'اعتماد سند', labelTr: 'Fiş Onayla', descriptionEn: 'Approve pending vouchers' },
    { id: 'accounting.vouchers.lock', category: 'accounting', labelEn: 'Lock Voucher', labelAr: 'قفل سند', labelTr: 'Fiş Kilitle', descriptionEn: 'Lock approved vouchers' },
    { id: 'accounting.vouchers.cancel', category: 'accounting', labelEn: 'Cancel Voucher', labelAr: 'إلغاء سند', labelTr: 'Fiş İptal Et', descriptionEn: 'Cancel vouchers' },
    { id: 'accounting.vouchers.changeStatus', category: 'accounting', labelEn: 'Change Voucher Status', labelAr: 'تغيير حالة السند', labelTr: 'Fiş Durumunu Değiştir', descriptionEn: 'Change voucher status' },
    { id: 'accounting.reports.trialBalance.view', category: 'accounting', labelEn: 'View Trial Balance', labelAr: 'عرض ميزان المراجعة', labelTr: 'Mizan Görüntüle', descriptionEn: 'View trial balance report' },
    { id: 'accounting.reports.profitAndLoss.view', category: 'accounting', labelEn: 'View Profit & Loss', labelAr: 'عرض الأرباح والخسائر', labelTr: 'Kar Zarar Görüntüle', descriptionEn: 'View profit and loss report' },
    { id: 'accounting.reports.generalLedger.view', category: 'accounting', labelEn: 'View General Ledger', labelAr: 'عرض دفتر الأستاذ', labelTr: 'Genel Muhasebe Defteri Görüntüle', descriptionEn: 'View general ledger' },
    { id: 'accounting.accounts.create', category: 'accounting', labelEn: 'Create Account', labelAr: 'إنشاء حساب', labelTr: 'Hesap Oluştur', descriptionEn: 'Create chart of accounts' },
    // Inventory
    { id: 'inventory.items.manage', category: 'inventory', labelEn: 'Manage Items', labelAr: 'إدارة الأصناف', labelTr: 'Ürünleri Yönet', descriptionEn: 'Create, edit, and delete inventory items' },
    { id: 'inventory.warehouses.manage', category: 'inventory', labelEn: 'Manage Warehouses', labelAr: 'إدارة المستودعات', labelTr: 'Depoları Yönet', descriptionEn: 'Manage warehouse locations' },
    { id: 'inventory.stock.view', category: 'inventory', labelEn: 'View Stock', labelAr: 'عرض المخزون', labelTr: 'Stok Görüntüle', descriptionEn: 'View stock levels' },
    { id: 'inventory.stock.in', category: 'inventory', labelEn: 'Stock In', labelAr: 'إدخال مخزون', labelTr: 'Stok Girişi', descriptionEn: 'Receive stock into warehouse' },
    { id: 'inventory.stock.out', category: 'inventory', labelEn: 'Stock Out', labelAr: 'إخراج مخزون', labelTr: 'Stok Çıkışı', descriptionEn: 'Issue stock from warehouse' },
    { id: 'inventory.reports.stockCard.view', category: 'inventory', labelEn: 'View Stock Card', labelAr: 'عرض بطاقة المخزون', labelTr: 'Stok Kartı Görüntüle', descriptionEn: 'View stock card reports' },
    // Designer
    { id: 'designer.vouchers.modify', category: 'designer', labelEn: 'Modify Voucher Forms', labelAr: 'تعديل نماذج السندات', labelTr: 'Fiş Formlarını Düzenle', descriptionEn: 'Design and modify voucher form layouts' },
    { id: 'designer.forms.modify', category: 'designer', labelEn: 'Modify Forms', labelAr: 'تعديل النماذج', labelTr: 'Formları Düzenle', descriptionEn: 'Design and modify general forms' },
    // System
    { id: 'system.company.settings.manage', category: 'system', labelEn: 'Manage Company Settings', labelAr: 'إدارة إعدادات الشركة', labelTr: 'Şirket Ayarlarını Yönet', descriptionEn: 'Manage company-wide settings' },
    { id: 'system.roles.manage', category: 'system', labelEn: 'Manage Roles', labelAr: 'إدارة الأدوار', labelTr: 'Rolleri Yönet', descriptionEn: 'Create and manage user roles and permissions' },
    { id: 'system.users.manage', category: 'system', labelEn: 'Manage Users', labelAr: 'إدارة المستخدمين', labelTr: 'Kullanıcıları Yönet', descriptionEn: 'Manage company users' },
    { id: 'system.company.users.manage', category: 'system', labelEn: 'Manage Company Users', labelAr: 'إدارة مستخدمي الشركة', labelTr: 'Şirket Kullanıcılarını Yönet', descriptionEn: 'Manage users within company' },
    // HR
    { id: 'hr.employees.manage', category: 'hr', labelEn: 'Manage Employees', labelAr: 'إدارة الموظفين', labelTr: 'Çalışanları Yönet', descriptionEn: 'Manage employee records' },
    { id: 'hr.payroll.manage', category: 'hr', labelEn: 'Manage Payroll', labelAr: 'إدارة الرواتب', labelTr: 'Bordro Yönet', descriptionEn: 'Process payroll' },
];
const systemRoleTemplates = [
    {
        id: 'template_admin',
        name: 'Administrator',
        description: 'Full access to all features',
        permissions: permissions.map(p => p.id),
        isCore: true
    },
    {
        id: 'template_accountant',
        name: 'Accountant',
        description: 'Full accounting access',
        permissions: permissions.filter(p => p.category === 'accounting').map(p => p.id),
        isCore: true
    },
    {
        id: 'template_inventory_manager',
        name: 'Inventory Manager',
        description: 'Manage inventory and stock',
        permissions: permissions.filter(p => p.category === 'inventory').map(p => p.id),
        isCore: true
    },
    {
        id: 'template_viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
            'accounting.vouchers.view',
            'accounting.reports.trialBalance.view',
            'inventory.stock.view'
        ],
        isCore: true
    }
];
async function seedRbacData() {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    const db = admin.firestore();
    console.log('Seeding permissions...');
    for (const permission of permissions) {
        await db.collection('system_metadata').doc('permissions').collection('items').doc(permission.id).set(permission);
    }
    console.log(`✓ Seeded ${permissions.length} permissions`);
    // Seed role templates
    console.log('Seeding role templates...');
    for (const template of systemRoleTemplates) {
        await db.collection('system_metadata').doc('role_templates').collection('items').doc(template.id).set({
            id: template.id,
            name: template.name,
            description: template.description,
            permissions: template.permissions,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }
    console.log(`✓ Seeded ${systemRoleTemplates.length} role templates`);
    console.log('RBAC data seeded successfully!');
}
exports.seedRbacData = seedRbacData;
// Run if executed directly
if (require.main === module) {
    seedRbacData()
        .then(() => process.exit(0))
        .catch((error) => {
        console.error('Error seeding RBAC data:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=seedRbacData.js.map