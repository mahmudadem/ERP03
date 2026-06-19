
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import WarehouseMasterCard from '../../inventory/components/WarehouseMasterCard';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';

export const WarehouseCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <MdiWindowFrame
      win={win}
      title={win.title}
      onClose={() => closeWindow(win.id)}
    >
      <WarehouseMasterCard 
        warehouseId={win.data?.warehouseId} 
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={(warehouse) => {
          win.data?.onSaved?.(warehouse);
          closeWindow(win.id);
        }}
      />
    </MdiWindowFrame>
  );
};
