import React from 'react';
import { Button } from '../../components/ui/Button';

interface Props {
  isLastStep: boolean;
  onNext: () => void;
  onFinish: () => void;
  loading?: boolean;
}

export const WizardNavigation: React.FC<Props> = ({ isLastStep, onNext, onFinish, loading }) => {
  return (
    <div className="flex justify-end gap-3 pt-6">
      <Button variant="secondary" disabled>
        Back
      </Button>
      {!isLastStep ? (
        <Button onClick={onNext} disabled={loading}>
          {loading ? 'Saving...' : 'Next'}
        </Button>
      ) : (
        <Button onClick={onFinish} disabled={loading}>
          {loading ? 'Finishing...' : 'Finish'}
        </Button>
      )}
    </div>
  );
};
