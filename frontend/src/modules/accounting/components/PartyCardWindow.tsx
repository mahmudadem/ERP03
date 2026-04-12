
import React from 'react';
import { UIWindow, useWindowManager } from '../../../context/WindowManagerContext';
import PartyMasterCard from '../../shared/components/PartyMasterCard';
import { DraggableWindow } from './DraggableWindow';

export const PartyCardWindow: React.FC<{ win: UIWindow }> = ({ win }) => {
  const { closeWindow } = useWindowManager();

  return (
    <DraggableWindow
      win={win}
      defaultSize={{ width: 950, height: 650 }}
      minSize={{ width: 800, height: 500 }}
    >
      <PartyMasterCard 
        partyId={win.data?.partyId} 
        role={win.data?.role || 'CUSTOMER'}
        isWindow={true}
        onClose={() => closeWindow(win.id)}
        onSaved={() => {
          // Standard refresh logic can go here
          closeWindow(win.id);
        }}
      />
    </DraggableWindow>
  );
};
