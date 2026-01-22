export const getCountryDefaults = (country: string) => {
  const defaults = {
    currency: 'USD',
    fiscalYearStart: '01-01',
    fiscalYearEnd: '12-31',
    language: 'en', // Default language
    timezone: 'UTC', // Default timezone
    dateFormat: 'MM/DD/YYYY', // Default date format
  };

  switch (country) {
    // Arab Countries - Arabic Language
    case 'United Arab Emirates':
      defaults.currency = 'AED';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Dubai';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Saudi Arabia':
      defaults.currency = 'SAR';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Riyadh';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Egypt':
      defaults.currency = 'EGP';
      defaults.language = 'ar';
      defaults.timezone = 'Africa/Cairo';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Qatar':
      defaults.currency = 'QAR';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Qatar';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Kuwait':
      defaults.currency = 'KWD';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Kuwait';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Bahrain':
      defaults.currency = 'BHD';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Bahrain';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Oman':
      defaults.currency = 'OMR';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Muscat';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Jordan':
      defaults.currency = 'JOD';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Amman';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Lebanon':
      defaults.currency = 'LBP';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Beirut';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Iraq':
      defaults.currency = 'IQD';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Baghdad';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Yemen':
      defaults.currency = 'YER';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Aden';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Syria':
      defaults.currency = 'SYP';
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Damascus';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Palestine':
      defaults.currency = 'ILS'; 
      defaults.language = 'ar';
      defaults.timezone = 'Asia/Hebron';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    
    // Turkey - Turkish Language
    case 'Turkey':
      defaults.currency = 'TRY';
      defaults.language = 'tr';
      defaults.timezone = 'Europe/Istanbul';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;

    // English / Other
    case 'United Kingdom':
      defaults.currency = 'GBP';
      defaults.fiscalYearStart = '04-01';
      defaults.fiscalYearEnd = '03-31';
      defaults.timezone = 'Europe/London';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'United States':
      defaults.currency = 'USD';
      defaults.fiscalYearStart = '01-01'; 
      defaults.fiscalYearEnd = '12-31';
      defaults.timezone = 'America/New_York'; // General US default
      defaults.dateFormat = 'MM/DD/YYYY';
      break;
    case 'India':
      defaults.currency = 'INR';
      defaults.fiscalYearStart = '04-01';
      defaults.fiscalYearEnd = '03-31';
      defaults.timezone = 'Asia/Kolkata';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Canada':
      defaults.currency = 'CAD';
      defaults.timezone = 'America/Toronto';
      defaults.dateFormat = 'YYYY-MM-DD';
      break;
    case 'Germany':
      defaults.currency = 'EUR';
      defaults.timezone = 'Europe/Berlin';
      defaults.dateFormat = 'DD.MM.YYYY';
      break;
    case 'France':
      defaults.currency = 'EUR';
      defaults.timezone = 'Europe/Paris';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Spain':
      defaults.currency = 'EUR';
      defaults.timezone = 'Europe/Madrid';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Italy':
      defaults.currency = 'EUR';
      defaults.timezone = 'Europe/Rome';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Netherlands':
      defaults.currency = 'EUR';
      defaults.timezone = 'Europe/Amsterdam';
      defaults.dateFormat = 'DD-MM-YYYY';
      break;
    case 'Australia':
      defaults.currency = 'AUD';
      defaults.fiscalYearStart = '07-01';
      defaults.fiscalYearEnd = '06-30';
      defaults.timezone = 'Australia/Sydney';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'Japan':
      defaults.currency = 'JPY';
      defaults.fiscalYearStart = '04-01';
      defaults.fiscalYearEnd = '03-31';
      defaults.timezone = 'Asia/Tokyo';
      defaults.dateFormat = 'YYYY/MM/DD';
      break;
    case 'Singapore':
      defaults.currency = 'SGD';
      defaults.timezone = 'Asia/Singapore';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    case 'China':
      defaults.currency = 'CNY';
      defaults.timezone = 'Asia/Shanghai';
      defaults.dateFormat = 'YYYY/MM/DD';
      break;
    case 'South Korea':
      defaults.currency = 'KRW';
      defaults.timezone = 'Asia/Seoul';
      defaults.dateFormat = 'YYYY.MM.DD';
      break;
    case 'Russia':
      defaults.currency = 'RUB';
      defaults.timezone = 'Europe/Moscow';
      defaults.dateFormat = 'DD.MM.YYYY';
      break;
    case 'Brazil':
      defaults.currency = 'BRL';
      defaults.timezone = 'America/Sao_Paulo';
      defaults.dateFormat = 'DD/MM/YYYY';
      break;
    
    default:
      break;
  }

  return defaults;
};
