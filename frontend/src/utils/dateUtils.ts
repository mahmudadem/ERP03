
import { CompanySettings } from '../api/companyApi';

/**
 * Formats a date string or object according to company settings.
 * @param date The date to format (string, number, or Date object)
 * @param settings The company settings containing timezone and dateFormat
 * @returns Formatted date string
 */
export const formatCompanyDate = (
  date: string | number | Date | null | undefined,
  settings: CompanySettings | null
): string => {
  if (!date) return '-';

  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '-';

  const timezone = settings?.timezone || 'UTC';
  const format = settings?.dateFormat || 'YYYY-MM-DD';

  // Use Intl.DateTimeFormat for timezone conversion
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);
  
  const partMap: Record<string, string> = {};
  parts.forEach(part => {
    partMap[part.type] = part.value;
  });

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;

  // Apply the requested format
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
};

/**
 * Formats a date specifically for HTML date inputs (YYYY-MM-DD)
 * This should always be YYYY-MM-DD even if display format is different.
 */
export const formatForInput = (date: string | number | Date | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Gets "Today" in YYYY-MM-DD format based on company timezone.
 */
export const getCompanyToday = (settings: CompanySettings | null): string => {
  const timezone = settings?.timezone || 'UTC';
  const now = new Date();
  
  // Use Intl to get strings in the specific timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // en-CA returns YYYY-MM-DD
  return formatter.format(now);
};

/**
 * Formats a date's time according to company timezone.
 */
export const formatCompanyTime = (
  date: string | number | Date | null | undefined,
  settings: CompanySettings | null
): string => {
  if (!date) return '-';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const timezone = settings?.timezone || 'UTC';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
};
/**
 * Parses a localized date string back to YYYY-MM-DD based on company settings.
 * @param dateStr Localized date string (e.g. "31/12/2023")
 * @param settings Company settings containing dateFormat
 * @returns ISO date string (YYYY-MM-DD) or null if invalid
 */
export const parseCompanyDate = (
  dateStr: string,
  settings: CompanySettings | null
): string | null => {
  if (!dateStr) return null;

  const format = settings?.dateFormat || 'YYYY-MM-DD';
  
  // Normalize date string by replacing common separators (-, ., /) with a space
  const normalized = dateStr.replace(/[-./]/g, ' ').trim();
  const parts = normalized.split(/\s+/);
  
  if (parts.length !== 3) return null;

  let day, month, year;

  try {
    if (format === 'DD/MM/YYYY') {
      [day, month, year] = parts;
    } else if (format === 'MM/DD/YYYY') {
      [month, day, year] = parts;
    } else {
      // YYYY-MM-DD or default
      [year, month, day] = parts;
    }

    // Basic numerical validation
    const nYear = Number(year);
    const nMonth = Number(month);
    const nDay = Number(day);

    if (isNaN(nYear) || isNaN(nMonth) || isNaN(nDay)) return null;

    // Create date for validation
    const d = new Date(nYear, nMonth - 1, nDay);
    if (isNaN(d.getTime())) return null;

    // Return as YYYY-MM-DD
    return `${String(nYear).padStart(4, '0')}-${String(nMonth).padStart(2, '0')}-${String(nDay).padStart(2, '0')}`;
  } catch (e) {
    return null;
  }
};
