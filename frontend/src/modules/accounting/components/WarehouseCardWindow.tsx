
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import WarehouseMasterCard from '../../inventory/components/WarehouseMasterCard';
import { DraggableWindow } from './DraggableWindow';

export const WarehouseCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <DraggableWindow
      win={win}
      defaultSize={{ width: 900, height: 600 }}
      minSize={{ width: 750, height: 450 }}
    >
      <WarehouseMasterCard 
        warehouseId={win.data?.warehouseId} 
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={() => {
          closeWindow(win.id);
        }}
      />
    </DraggableWindow>
  );
};
