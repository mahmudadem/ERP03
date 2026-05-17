const fs=require('fs'); 
const lines=fs.readFileSync('frontend/src/modules/accounting/pages/AccountingSettingsPage.tsx','utf8').split(/\r?\n/); 
const out=lines.slice(430,440).map((l,i)=>(430+i+1)+': '+l).join('\n'); 
console.log(out); 
