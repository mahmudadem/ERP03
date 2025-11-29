import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export const NewCompanyCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="p-6 flex flex-col items-start justify-between border-dashed border-2 border-gray-200">
      <div>
        <div className="flex items-center gap-2 text-blue-600 font-semibold text-lg">
          <span className="text-2xl">＋</span>
          <span>Create New Company</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">Start the guided setup to create a new company.</p>
      </div>
      <Button className="mt-4" onClick={() => navigate('/company-wizard')}>
        Start Wizard
      </Button>
    </Card>
  );
};
