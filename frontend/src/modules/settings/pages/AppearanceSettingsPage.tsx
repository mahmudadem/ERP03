import React from 'react';
import { Card } from '../../../components/ui/Card';

const AppearanceSettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Appearance</h1>
      <Card className="p-6">
        <p>Theme configuration settings will appear here.</p>
      </Card>
    </div>
  );
};

export default AppearanceSettingsPage;