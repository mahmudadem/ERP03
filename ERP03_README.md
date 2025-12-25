# ERP03 - Enterprise Resource Planning System

A modern, cloud-native ERP system built with Clean Architecture principles.

## 🎉 Latest Updates (December 9, 2025)

**Major Features Added**:
- ✅ Complete RBAC UI Protection
- ✅ Voucher Type Deletion for Super Admin
- ✅ Enhanced Security & User Experience

### 📖 Session Documentation
**Start here**: [`WELCOME_BACK.md`](./WELCOME_BACK.md) - Overview of recent changes

**Full Documentation**:
- [`FINAL_SESSION_SUMMARY.md`](./FINAL_SESSION_SUMMARY.md) - Comprehensive summary
- [`WORK_SESSION_REPORT.md`](./WORK_SESSION_REPORT.md) - Technical details
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - How to test new features
- [`QUICK_START_CHECKLIST.md`](./QUICK_START_CHECKLIST.md) - Review checklist

---

## 🏗️ Architecture

**Backend**: Firebase Functions + TypeScript + Clean Architecture  
**Frontend**: React + TypeScript + Vite  
**Database**: Firestore  
**Auth**: Firebase Authentication  

### Key Modules:
- **Accounting**: Vouchers, journals, reports
- **RBAC**: Role-based access control
- **Designer**: Dynamic voucher type builder
- **Super Admin**: System-level administration

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- Git

### Setup
```bash
# Clone repository
git clone [repository-url]
cd ERP03

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start emulators
firebase emulators:start

# In another terminal - Run backend
cd backend && npm run serve

# In another terminal - Run frontend
cd frontend && npm run dev
```

### Access
- **Frontend**: http://localhost:5173
- **Emulator UI**: http://localhost:4000
- **Backend API**: http://localhost:5001

---

## 📁 Project Structure

```
ERP03/
├── backend/              # Firebase Functions (Node.js/TypeScript)
│   ├── src/
│   │   ├── api/         # Controllers & routes
│   │   ├── application/ # Use cases (business logic)
│   │   ├── domain/      # Entities & interfaces
│   │   ├── infrastructure/ # External services (Firestore, etc.)
│   │   └── repository/  # Data access interfaces
│   └── package.json
│
├── frontend/            # React application
│   ├── src/
│   │   ├── api/        # API clients
│   │   ├── components/ # Reusable components
│   │   ├── modules/    # Feature modules
│   │   ├── hooks/      # Custom hooks
│   │   └── router/     # Routing configuration
│   └── package.json
│
└── shared/             # Shared types (if any)
```

---

## 🔐 Security Features

### RBAC (Role-Based Access Control)
- **Permission-based UI**: Users only see authorized actions
- **Route protection**: Automatic permission checks
- **Backend validation**: All endpoints verify permissions

### Supported Roles:
- **SUPER_ADMIN**: System-level administration
- **OWNER**: Company owner (all permissions)
- **ADMIN**: Company administrator
- **Custom Roles**: Configurable per company

---

## 🎨 Key Features

### ✅ Accounting Module
- Dynamic voucher types
- Multi-currency support
- Approval workflows
- Financial reports (Trial Balance, etc.)

### ✅ Designer Module
- Visual voucher type builder
- Custom field definitions
- Layout customization
- Permission: `accounting.designer.*` (View, Create, Modify)

### ✅ RBAC System
- Fine-grained permissions
- Module-level access control
- Company-specific roles
- Super admin capabilities

### ✅ Multi-Company
- Single platform, multiple companies
- Data isolation
- Company-specific settings
- Template replication

---

## 🧪 Testing

### Run Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Manual Testing
See [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) for comprehensive test scenarios.

---

## 📚 Documentation

### For Developers:
- [`RBAC_INTEGRATION_SUMMARY.md`](./RBAC_INTEGRATION_SUMMARY.md) - RBAC implementation
- [`ARCHITECTURE_AUDIT_REPORT.md`](./ARCHITECTURE_AUDIT_REPORT.md) - Architecture review
- [`SYSTEM_VOUCHER_TYPES_MIGRATION.md`](./SYSTEM_VOUCHER_TYPES_MIGRATION.md) - Storage migration

### For Operations:
- Migration scripts in `backend/src/migrations/`
- Seeder scripts in `backend/src/seeder/`
- Verification scripts in `backend/src/scripts/`

---

## 🔧 Development

### Main Commands

**Backend**:
```bash
npm run build      # Compile TypeScript
npm run serve      # Run locally
npm run deploy     # Deploy to Firebase
```

**Frontend**:
```bash
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
```

### Code Quality
- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting
- Clean Architecture enforced

---

## 🚀 Deployment

### Firebase Deployment
```bash
# Deploy backend
cd backend
npm run deploy

# Deploy frontend
cd frontend
npm run build
firebase deploy --only hosting
```

### Environment Variables
Configure in `.env` files:
- `VITE_FIREBASE_*` - Frontend Firebase config
- `GCLOUD_PROJECT` - Backend project ID

---

## 📊 Project Status

**Current Version**: Active Development  
**Production Ready**: ✅ Core features  
**Latest Session**: December 9, 2025

### Recent Additions:
- ✅ RBAC UI Protection
- ✅ Voucher Type Deletion
- ✅ System Voucher Types Migration
- ✅ Complete CRUD for templates

### In Progress:
- Reporting Module enhancements
- Inventory Module development
- Audit Trail implementation

---

## 🤝 Contributing

This is a private project. For authorized contributors:
1. Follow Clean Architecture principles
2. Maintain type safety
3. Write tests for new features
4. Document significant changes
5. Run build before committing

---

## 📄 License

Private/Proprietary

---

## 📞 Support

For questions or issues:
- Check documentation in project root
- Review session reports for recent changes
- Contact project maintainers

---

**Last Updated**: December 9, 2025  
**Maintainers**: Project Team  
**Status**: ✅ Production Ready
