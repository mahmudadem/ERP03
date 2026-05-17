# 📋 Task Backlog

> This file contains all deferred tasks, rabbit holes, and ideas for later.
> Tasks are numbered so you can prompt agents (e.g., "Work on Task #T1").

## Pending Tasks

- [ ] **#T1: Document Designer System Fields Not Rendering**
  `GenericVoucherRenderer` requires `headerFields` metadata which `DocumentDesigner` does not currently construct during "Test Run" config generation. Fix deferred for later.

- [ ] **#T2: Cleanup obsolete duplicate defaults**
  Existing physical duplicate default voucher form documents still remain in Firestore. The API now hides them and future init/sync will not create more, but a later cleanup script could delete obsolete duplicates after confirming no vouchers reference them.
- [ ] **#T3: in comamnd center i need...**
  in comamnd center i need a way to reopen closed job for more editing

