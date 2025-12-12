import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { companyModulesApi } from '../../api/companyModules';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CheckCircle, Loader2 } from 'lucide-react';

interface ModuleInitializationWizardProps {
  moduleCode: string;
  moduleName: string;
  description: string;
  steps?: React.ReactNode;
  onComplete?: () => void;
  redirectPath?: string;
}

/**
 * Generic initialization wizard template for modules
 * Can be customized per module with specific setup steps
 */
export const ModuleInitializationWizard: React.FC<ModuleInitializationWizardProps> = ({
  moduleCode,
  moduleName,
  description,
  steps,
  onComplete,
  redirectPath,
}) => {
  const { companyId } = useCompanyAccess();
  const navigate = useNavigate();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!companyId) return;

    try {
      setIsCompleting(true);
      setError(null);

      // Mark module as initialized
      await companyModulesApi.initialize(companyId, moduleCode, {
        completedAt: new Date().toISOString(),
      });

      // Call custom completion handler if provided
      if (onComplete) {
        onComplete();
      }

      // Redirect to module home or specified path
      const target = redirectPath || `/${moduleCode}`;
      navigate(target, { replace: true });
    } catch (err) {
      console.error('Failed to complete module initialization:', err);
      setError('Failed to complete setup. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to {moduleName}
          </h1>
          <p className="text-gray-600">{description}</p>
        </div>

        {/* Custom setup steps (if provided) */}
        {steps && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            {steps}
          </div>
        )}

        {/* Default message if no steps */}
        {!steps && (
          <div className="mb-8 text-center text-gray-600">
            <p>
              This module is ready to use. Click "Complete Setup" below to get started.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            disabled={isCompleting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            isLoading={isCompleting}
            leftIcon={isCompleting ? undefined : <CheckCircle className="w-4 h-4" />}
          >
            {isCompleting ? 'Completing...' : 'Complete Setup'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ModuleInitializationWizard;
