import type { TFunction } from 'i18next';

type MetadataCategory = 'bundles' | 'businessDomains' | 'currencies' | 'coaTemplates';
type MetadataField = 'name' | 'description' | 'recommended';

interface LocalizedMetadataRecord {
  id: string;
  name: string;
  description?: string;
}

const getLocalizedMetadataText = (
  category: MetadataCategory,
  id: string,
  field: MetadataField,
  fallback: string,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  t(`systemMetadata.${category}.${id}.${field}`, {
    lng: language,
    defaultValue: fallback,
  });

export const getLocalizedBundleName = (
  bundle: Pick<LocalizedMetadataRecord, 'id' | 'name'>,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string => getLocalizedMetadataText('bundles', bundle.id, 'name', bundle.name, t, language);

export const getLocalizedBundleDescription = (
  bundle: LocalizedMetadataRecord,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  getLocalizedMetadataText(
    'bundles',
    bundle.id,
    'description',
    bundle.description ?? '',
    t,
    language
  );

export const getLocalizedBusinessDomainName = (
  domain: Pick<LocalizedMetadataRecord, 'id' | 'name'>,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  getLocalizedMetadataText('businessDomains', domain.id, 'name', domain.name, t, language);

export const getLocalizedBusinessDomainDescription = (
  domain: LocalizedMetadataRecord,
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  getLocalizedMetadataText(
    'businessDomains',
    domain.id,
    'description',
    domain.description ?? '',
    t,
    language
  );

export const getLocalizedMetadataSearchText = (
  record: LocalizedMetadataRecord,
  category: 'bundles' | 'businessDomains',
  t: TFunction
): string => {
  const getName =
    category === 'bundles' ? getLocalizedBundleName : getLocalizedBusinessDomainName;
  const getDescription =
    category === 'bundles'
      ? getLocalizedBundleDescription
      : getLocalizedBusinessDomainDescription;

  return (['ar', 'en', 'tr'] as const)
    .flatMap((language) => [
      getName(record, t, language),
      getDescription(record, t, language),
    ])
    .concat(record.id, record.name, record.description ?? '')
    .join(' ')
    .toLocaleLowerCase();
};

export const getLocalizedCurrencyName = (
  currency: { code: string; name: string },
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  getLocalizedMetadataText('currencies', currency.code, 'name', currency.name, t, language);

export const getLocalizedCurrencySearchText = (
  currency: { code: string; name: string },
  t: TFunction
): string =>
  (['ar', 'en', 'tr'] as const)
    .map((language) => getLocalizedCurrencyName(currency, t, language))
    .concat(currency.code, currency.name)
    .join(' ')
    .toLocaleLowerCase();

export const getLocalizedCoaTemplateText = (
  template: { id: string; name: string; description?: string; recommended?: string },
  field: 'name' | 'description' | 'recommended',
  t: TFunction,
  language?: 'ar' | 'en' | 'tr'
): string =>
  getLocalizedMetadataText(
    'coaTemplates',
    template.id,
    field,
    template[field] ?? '',
    t,
    language
  );

export const getLocalizedCoaTemplateSearchText = (
  template: { id: string; name: string; description?: string; recommended?: string },
  t: TFunction
): string =>
  (['ar', 'en', 'tr'] as const)
    .flatMap((language) =>
      (['name', 'description', 'recommended'] as const).map((field) =>
        getLocalizedCoaTemplateText(template, field, t, language)
      )
    )
    .concat(
      template.id,
      template.name,
      template.description ?? '',
      template.recommended ?? ''
    )
    .join(' ')
    .toLocaleLowerCase();
