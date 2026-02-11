# 04 - Cost Center (Full Implementation)

- Expanded CostCenter domain (status, validation, audit fields) and repository interface.
- Firestore cost center repository with CRUD/findByCode, timestamps, status; wired into DI.
- Use cases + controller/routes for list/create/update/deactivate with permissions.
- Frontend: cost center API functions; context provider; Cost Centers page with CRUD; CostCenter selector component; wired into voucher dynamic renderer.
- Tests: CostCenter entity validation/deactivation.
