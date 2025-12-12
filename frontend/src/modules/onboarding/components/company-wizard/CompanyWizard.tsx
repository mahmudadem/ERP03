
import React, { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { WizardLayout } from './WizardLayout';
import { StepBasicInfo } from './StepBasicInfo';
import { StepBundleSelection } from './StepBundleSelection';
import { StepContactInfo } from './StepContactInfo';
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import { CompanyFormData, WizardStep, Bundle } from './types';

interface CompanyWizardProps {
  onCancel: () => void;
  onComplete: (createdCompanyId?: string) => void;
}


const initialData: CompanyFormData = {
  companyName: '',
  description: '',
  country: '',
  email: '', 
  logo: null,
  logoPreviewUrl: null,
  selectedBundleId: null, 
};

const CompanyWizard: React.FC<CompanyWizardProps> = ({ onCancel, onComplete }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.BasicInfo);
  // Initialize email with user's email if available
  const [formData, setFormData] = useState<CompanyFormData>({
    ...initialData,
    email: user?.email || '',
  });

  const updateFormData = (fields: Partial<CompanyFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, WizardStep.Success));
  };

  const prevStep = () => {
    if (currentStep === WizardStep.BasicInfo) {
      onCancel();
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, WizardStep.BasicInfo));
    }
  };

  const handleFinish = () => {
    onComplete(formData.createdCompanyId);
  };

  // Dynamic Title Handling
  const getStepHeader = () => {
    switch (currentStep) {
      case WizardStep.BasicInfo:
        return { title: "Company Basics", subtitle: "Let's start with the essentials." };
      case WizardStep.BundleSelection:
        return { title: "Select a Bundle", subtitle: "Choose the feature set that fits your needs." };
      case WizardStep.ContactInfo: // New header
        return { title: "Admin & Contact", subtitle: "Set up the primary contact for this company." };
      case WizardStep.Review:
        return { title: "Review & Create", subtitle: "Verify details before initializing the company." };
      case WizardStep.Success:
        return { title: "All Set!", subtitle: "" };
      default:
        return { title: "", subtitle: "" };
    }
  };

  const { title, subtitle } = getStepHeader();

  // Fetch bundles
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);

  React.useEffect(() => {
    // Only fetch if we haven't already
    import('../../api/onboardingApi').then(({ onboardingApi }) => {
       onboardingApi.getBundles()
         .then(setBundles)
         .catch(console.error)
         .finally(() => setLoadingBundles(false));
    });
  }, []);

  const renderStep = () => {
    const commonProps = {
      data: formData,
      updateData: updateFormData,
      onNext: nextStep,
      onBack: prevStep,
      bundles: bundles,
      loading: loadingBundles,
    };

    switch (currentStep) {
      case WizardStep.BasicInfo:
        return React.createElement(StepBasicInfo, commonProps);
      case WizardStep.BundleSelection:
        return React.createElement(StepBundleSelection, commonProps);
      case WizardStep.ContactInfo:
        return React.createElement(StepContactInfo, commonProps);
      case WizardStep.Review:
        return React.createElement(StepReview, commonProps);
      case WizardStep.Success:
        return React.createElement(StepSuccess, { ...commonProps, onComplete: handleFinish });
      default:
        return null;
    }
  };

  return (
    <WizardLayout currentStep={currentStep} title={title} subtitle={subtitle}>
      {renderStep()}
    </WizardLayout>
  );
};

export default CompanyWizard;
