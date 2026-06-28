import fs from 'fs';
import path from 'path';

const localesDir = 'd:/DEV2026/ERP03-auth-i18n/frontend/src/locales'; // Oh wait, I should check if it's in public/locales or src/locales. Let's check config.ts

const langs = ['en', 'ar', 'tr'];

const newKeys = {
  en: {
    invalidCredential: "Invalid email or password.",
    wrongPassword: "Incorrect password.",
    emailInUse: "Email is already registered.",
    weakPassword: "Password is too weak.",
    networkError: "Network error. Please check your connection."
  },
  ar: {
    invalidCredential: "البريد الإلكتروني أو كلمة المرور غير صالحة.",
    wrongPassword: "كلمة المرور غير صحيحة.",
    emailInUse: "البريد الإلكتروني مسجل بالفعل.",
    weakPassword: "كلمة المرور ضعيفة جداً.",
    networkError: "خطأ في الشبكة. يرجى التحقق من اتصالك."
  },
  tr: {
    invalidCredential: "Geçersiz e-posta veya şifre.",
    wrongPassword: "Yanlış şifre.",
    emailInUse: "E-posta zaten kayıtlı.",
    weakPassword: "Şifre çok zayıf.",
    networkError: "Ağ hatası. Lütfen bağlantınızı kontrol edin."
  }
};

langs.forEach(lang => {
  const filePath = path.join(localesDir, lang, 'common.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!data.onboarding) data.onboarding = {};
    if (!data.onboarding.landing) data.onboarding.landing = {};
    if (!data.onboarding.landing.errors) data.onboarding.landing.errors = {};
    
    Object.assign(data.onboarding.landing.errors, newKeys[lang]);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${lang} common.json`);
  } else {
    console.warn(`File not found: ${filePath}`);
  }
});
