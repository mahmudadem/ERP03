
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import ItemMasterCard from './ItemMasterCard';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';

export const ItemCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();
  const itemId = win.data?.itemId ?? win.data?.id;

  return (
    <MdiWindowFrame
      win={win}
      title={win.title}
      onClose={() => closeWindow(win.id)}
    >
      <ItemMasterCard
        itemId={itemId}
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={(item) => {
          win.data?.onSaved?.(item);
          closeWindow(win.id);
        }}
      />
    </MdiWindowFrame>
  );
};
