# 05 - Dashboard with Real Data

- Added dashboard summary API (counts, cash position from cash/bank accounts, recent vouchers, unbalanced draft detection, fiscal period status) and route.
- Voucher repository gains recent/count helpers; dashboard summary uses trial balance + accounts to compute cash.
- Frontend dashboard now pulls live data (total vouchers, cash, recent entries), refresh button/auto-refresh, financial report links, unbalanced alert, fiscal period badge.
- API client updated with dashboard summary call; loading skeletons added.
- Tests: existing suites unchanged and passing.
