
import React, { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { WizardLayout } from './WizardLayout';
import { StepBasicInfo } from './StepBasicInfo';
import { StepBundleSelection } from './StepBundleSelection';
import { StepContactInfo } from './StepContactInfo';
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import { CompanyFormData, WizardStep, Bundle } from './types';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');
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
        return { 
          title: t('onboarding.companyWizard.basic.title', { defaultValue: "Company Basics" }), 
          subtitle: t('onboarding.companyWizard.basic.subtitle', { defaultValue: "Let's start with the essentials." }) 
        };
      case WizardStep.BundleSelection:
        return { 
          title: t('onboarding.companyWizard.bundle.title', { defaultValue: "Select a Bundle" }), 
          subtitle: t('onboarding.companyWizard.bundle.subtitle', { defaultValue: "Choose the feature set that fits your needs." }) 
        };
      case WizardStep.ContactInfo:
        return { 
          title: t('onboarding.companyWizard.contact.title', { defaultValue: "Admin & Contact" }), 
          subtitle: t('onboarding.companyWizard.contact.subtitle', { defaultValue: "Set up the primary contact for this company." }) 
        };
      case WizardStep.Review:
        return { 
          title: t('onboarding.companyWizard.review.title', { defaultValue: "Review & Create" }), 
          subtitle: t('onboarding.companyWizard.review.subtitle', { defaultValue: "Verify details before initializing the company." }) 
        };
      case WizardStep.Success:
        return { 
          title: t('onboarding.companyWizard.success.title', { defaultValue: "All Set!" }), 
          subtitle: "" 
        };
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
