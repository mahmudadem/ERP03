import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import {
  GrossProfitInitiator,
  GrossProfitMode,
  GrossProfitParams,
  GrossProfitReportContent,
  grossProfitDefaultParams,
  grossProfitReportColumns,
} from './SalesGrossProfitReportPage';

const mode: GrossProfitMode = 'BY_ITEM';

const SalesGrossProfitByItemPage: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <ReportContainer<GrossProfitParams & { mode: GrossProfitMode }>
      title={t('salesGrossProfit.titleByItem', { defaultValue: 'Gross Profit by Item' })}
      subtitle={t('salesGrossProfit.subtitle', { defaultValue: 'Historical gross profit facts by invoice currency and base currency' })}
      initiator={({ onSubmit, initialParams }) => (
        <GrossProfitInitiator
          initialParams={initialParams}
          onSubmit={(params) => onSubmit({ ...params, mode })}
        />
      )}
      ReportContent={GrossProfitReportContent}
      defaultParams={{ ...grossProfitDefaultParams, mode }}
      config={{
        paginated: false,
        density: 'comfortable',
        availableColumns: grossProfitReportColumns,
      }}
    />
  );
};

export default SalesGrossProfitByItemPage;
