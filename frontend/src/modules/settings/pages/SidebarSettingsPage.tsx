import React from 'react';
import { Card } from '../../../components/ui/Card';

const SidebarSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Menu Configuration</h1>
      <Card className="p-6">
        <p>Configure visibility of sidebar items here.</p>
      </Card>
    </div>
  );
};

export default SidebarSettingsPage;