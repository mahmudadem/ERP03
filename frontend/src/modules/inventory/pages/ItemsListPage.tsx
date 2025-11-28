import React from 'react';
import { Card } from '../../../components/ui/Card';

const ItemsListPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inventory Items</h1>
      <Card className="p-6">
        <p>List of inventory products will go here.</p>
      </Card>
    </div>
  );
};

export default ItemsListPage;