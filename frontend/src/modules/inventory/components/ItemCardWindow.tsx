
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import ItemMasterCard from './ItemMasterCard';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';

export const ItemCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <MdiWindowFrame
      win={win}
      title={win.title}
      onClose={() => closeWindow(win.id)}
    >
      <ItemMasterCard 
        itemId={win.data?.itemId} 
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={() => {
          closeWindow(win.id);
        }}
      />
    </MdiWindowFrame>
  );
};
