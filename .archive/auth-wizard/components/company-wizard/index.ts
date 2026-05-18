
import React, { useState } from 'react';
import { WizardLayout } from './WizardLayout';
import { StepBasicInfo } from './StepBasicInfo';
import { StepBundleSelection } from './StepBundleSelection';
import { StepContactInfo } from './StepContactInfo'; // New import
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import { CompanyFormData, WizardStep } from './types';

interface CompanyWizardProps {
  onCancel: () => void;
  onComplete: () => void;
}

const initialData: CompanyFormData = {
  companyName: '',
  description: '',
  country: '',
  email: '', // Initial email
  logo: null,
  logoPreviewUrl: null,
  selectedBundleId: null, // 'standard' is often a good default, but let's force selection
};

const CompanyWizard: React.FC<CompanyWizardProps> = ({ onCancel, onComplete }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.BasicInfo);
  const [formData, setFormData] = useState<CompanyFormData>(initialData);

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
    onComplete();
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

  const renderStep = () => {
    const commonProps = {
      data: formData,
      updateData: updateFormData,
      onNext: nextStep,
      onBack: prevStep,
    };

    switch (currentStep) {
      case WizardStep.BasicInfo:
        return React.createElement(StepBasicInfo, commonProps);
      case WizardStep.BundleSelection:
        return React.createElement(StepBundleSelection, commonProps);
      case WizardStep.ContactInfo: // New Step Render
        return React.createElement(StepContactInfo, commonProps);
      case WizardStep.Review:
        return React.createElement(StepReview, commonProps);
      case WizardStep.Success:
        return React.createElement(StepSuccess, { ...commonProps, onComplete: handleFinish });
      default:
        return null;
    }
  };

  return React.createElement(WizardLayout, { 
    currentStep, 
    title, 
    subtitle 
  }, renderStep());
};

export default CompanyWizard;
