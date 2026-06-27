import i18n from '../i18n/config';

// List of Arab League countries (ISO 3166-1 alpha-2 codes)
const ARAB_COUNTRIES = [
  'AE', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'JO', 'KM', 'KW', 'LB', 
  'LY', 'MA', 'MR', 'OM', 'PS', 'QA', 'SA', 'SD', 'SO', 'SY', 'TN', 'YE'
];

/**
 * Detects the user's country using their IP and updates the i18n language
 * if they haven't explicitly chosen one yet.
 */
export async function detectAndSetIpLanguage() {
  // If the user has already selected a language, don't overwrite it
  if (localStorage.getItem('i18nextLng')) {
    return;
  }

  try {
    const response = await fetch('https://get.geojs.io/v1/ip/country.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch IP country: ${response.statusText}`);
    }
    
    const data = await response.json();
    const countryCode = data.country;
    
    if (!countryCode) return;
    
    let targetLang = 'en';
    
    if (ARAB_COUNTRIES.includes(countryCode)) {
      targetLang = 'ar';
    } else if (countryCode === 'TR') {
      targetLang = 'tr';
    }
    
    // Change language and save preference so it's not checked again unnecessarily
    i18n.changeLanguage(targetLang);
    localStorage.setItem('i18nextLng', targetLang);
    
    console.log(`Detected country ${countryCode}, set default language to ${targetLang}`);
  } catch (error) {
    console.warn('Failed to detect language by IP:', error);
  }
}
