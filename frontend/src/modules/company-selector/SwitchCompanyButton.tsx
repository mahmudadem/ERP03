import React from 'react';
import { Button } from '../../components/ui/Button';

interface Props {
  companyId: string;
  onSwitch: (companyId: string) => void;
}

export const SwitchCompanyButton: React.FC<Props> = ({ companyId, onSwitch }) => {
  return (
    <Button size="sm" onClick={() => onSwitch(companyId)}>
      Enter Company
    </Button>
  );
};
