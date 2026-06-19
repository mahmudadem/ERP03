
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import PartyMasterCard from '../../shared/components/PartyMasterCard';
import { MdiWindowFrame } from '../../../components/mdi/MdiWindowFrame';

export const PartyCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <MdiWindowFrame
      win={win}
      title={win.title}
      onClose={() => closeWindow(win.id)}
    >
      <PartyMasterCard 
        partyId={win.data?.partyId} 
        role={win.data?.role || 'CUSTOMER'}
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={(party) => {
          win.data?.onSaved?.(party);
          closeWindow(win.id);
        }}
      />
    </MdiWindowFrame>
  );
};
