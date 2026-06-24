import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const arCommonPath = path.join(__dirname, 'frontend/src/locales/ar/common.json');
const arPosPath = path.join(__dirname, 'frontend/src/locales/ar/pos.json');
const arInvPath = path.join(__dirname, 'frontend/src/locales/ar/inventory.json');

function updateJson(filePath, updater) {
  let data = {};
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  data = updater(data);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 1. common.json
updateJson(arCommonPath, (data) => {
  data.owner = "المالك";
  data.admin = "مسؤول النظام";
  data.cashier = "كاشير";
  return data;
});

// 2. pos.json
updateJson(arPosPath, (data) => {
  if (!data.registers) data.registers = {};
  if (!data.registers.settlement) data.registers.settlement = {};
  data.registers.settlement.CARD = "حساب تسوية البطاقة (CARD)";
  data.registers.settlement.BANK_TRANSFER = "حساب تسوية التحويل البنكي (BANK_TRANSFER)";
  data.registers.settlement.CUSTOM = "حساب التسوية المخصص (CUSTOM)";
  return data;
});

// 3. inventory.json
updateJson(arInvPath, (data) => {
  data["Select warehouse..."] = "اختر المستودع...";
  return data;
});

console.log("JSON files updated.");
