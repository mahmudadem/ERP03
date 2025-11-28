import React from 'react';
import { Card } from '../../../components/ui/Card';

const EmployeesListPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Employees</h1>
      <Card className="p-6">
        <p>Employee directory will go here.</p>
      </Card>
    </div>
  );
};

export default EmployeesListPage;