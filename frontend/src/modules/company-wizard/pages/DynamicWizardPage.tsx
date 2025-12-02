import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { WizardSessionProvider, useWizardSession } from '../context/WizardSessionContext';
import { WizardStepRenderer } from '../WizardStepRenderer';
import { WizardNavigation } from '../WizardNavigation';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

const WizardRunner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionIdFromUrl = searchParams.get('sessionId');
  const { currentStep, isLastStep, loading, resumeSession, submitStep, completeWizard } = useWizardSession();
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionIdFromUrl) {
      resumeSession(sessionIdFromUrl);
    }
  }, [sessionIdFromUrl, resumeSession]);

  useEffect(() => {
    // Reset form when step changes
    setValues({});
  }, [currentStep?.id]);

  const handleNext = async () => {
    try {
      setError(null);
      await submitStep(values);
      setValues({});
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to submit step');
    }
  };

  const handleFinish = async () => {
    try {
      setError(null);
      // If we are on the last step and have unsaved values, persist them first
      if (Object.keys(values).length > 0) {
        await submitStep(values);
        setValues({});
      }
      const result = await completeWizard();
      window.alert('Company created successfully');
      navigate('/');
      return result.companyId;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to complete wizard');
    }
  };

  if (!sessionIdFromUrl) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">Missing session. Please start the wizard again.</p>
        <Button className="mt-4" onClick={() => navigate('/company-wizard')}>
          Go to Wizard Start
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loading && !currentStep && <Card className="p-4 text-gray-500">Loading wizard step...</Card>}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </Card>
      )}

      {currentStep && (
        <Card className="p-6 space-y-4">
          <WizardStepRenderer step={currentStep} values={values} onChange={(id, val) => setValues((prev) => ({ ...prev, [id]: val }))} />
          <WizardNavigation isLastStep={isLastStep} onNext={handleNext} onFinish={handleFinish} loading={loading} />
        </Card>
      )}
    </div>
  );
};

const DynamicWizardPage: React.FC = () => (
  <WizardSessionProvider>
    <WizardRunner />
  </WizardSessionProvider>
);

export default DynamicWizardPage;
