import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { UserCompany } from './api';
import { formatCompanyDate } from '../../utils/dateUtils';

interface Props {
  company: UserCompany;
  onEnter: (companyId: string) => void;
}

export const CompanyCard: React.FC<Props> = ({ company, onEnter }) => {
  return (
    <Card className="p-4 flex flex-col justify-between">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">{company.name}</h3>
        <p className="text-sm text-gray-500">
          {company.model} • {company.role}
        </p>
        {company.createdAt && (
          <p className="text-xs text-gray-400">Created: {formatCompanyDate(company.createdAt, null)}</p>
        )}
        {company.lastAccessedAt && (
          <p className="text-xs text-gray-400">Last accessed: {formatCompanyDate(company.lastAccessedAt, null)}</p>
        )}
      </div>
      <div className="mt-4">
        <Button onClick={() => onEnter(company.id)} className="w-full">
          Enter Company
        </Button>
      </div>
    </Card>
  );
};
