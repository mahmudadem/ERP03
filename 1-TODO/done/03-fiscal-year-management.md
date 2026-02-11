# 03 - Fiscal Year / Period Management

- Added fiscal year domain model with periods, status transitions, and helpers.
- Introduced FiscalYear repository interface and Firestore implementation; wired into DI and policy registry.
- Implemented use cases (create/list/close/reopen periods, close fiscal year with closing JE generation).
- Added controller + routes for fiscal year operations with permission guards.
- Extended PeriodLockPolicy to honor fiscal period status before date locks.
- Frontend: fiscal year tab in Accounting Settings with create/list/close/reopen actions; new API functions and types.
- Tests: FiscalYear entity behaviors; CloseYearUseCase integration with mocked repos.
