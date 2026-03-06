
import { useTranslation } from 'react-i18next';

export default function ForbiddenPage() {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">{t('auth.forbidden.title')}</h2>
        <p className="text-gray-600 mb-8">
          {t('auth.forbidden.description')}
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {t('auth.forbidden.goBack')}
        </button>
      </div>
    </div>
  );
}
