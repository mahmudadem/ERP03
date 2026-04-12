
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import ItemMasterCard from './ItemMasterCard';
import { DraggableWindow } from '../../accounting/components/DraggableWindow';

export const ItemCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <DraggableWindow
      win={win}
      defaultSize={{ width: 950, height: 650 }}
      minSize={{ width: 800, height: 500 }}
    >
      <ItemMasterCard 
        itemId={win.data?.itemId} 
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={() => {
          closeWindow(win.id);
        }}
      />
    </DraggableWindow>
  );
};
