import pathlib,re 
txt=pathlib.Path('src/modules/accounting/components/VoucherTable.tsx').read_text(encoding='utf-8') 
lines=txt.splitlines() 
import itertools 
