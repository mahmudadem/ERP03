import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';

const ApprovalSettingsPage: React.FC = () => {
  const { settings, updateSettings, isLoading } = useCompanySettings();
  const [strictMode, setStrictMode] = useState(true);

  useEffect(() => {
    if (settings) {
      setStrictMode(settings.strictApprovalMode);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({ strictApprovalMode: strictMode });
      errorHandler.showSuccess('common:success.SAVE');
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  if (isLoading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Approval Workflow Settings</h1>
      
      <Card className="p-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Strict Approval Mode</h3>
            <p className="text-sm text-gray-500 mb-4">
              When enabled, vouchers start as <strong>Draft</strong> and must be explicitly 
              <strong> Sent for Approval</strong> and then <strong>Approved</strong> before they can be locked.
              <br/><br/>
              When disabled (Flexible Mode), creating a voucher automatically sets it to <strong>Approved</strong>.
            </p>
          </div>
          
          <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
            <input 
              type="checkbox" 
              name="toggle" 
              id="toggle" 
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-blue-600 transition-all duration-300"
              style={{ right: strictMode ? '0' : 'auto', left: strictMode ? 'auto' : '0' }}
            />
            <label 
              htmlFor="toggle" 
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${strictMode ? 'bg-blue-600' : 'bg-gray-300'}`}
            ></label>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex justify-end">
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </Card>
    </div>
  );
};

export default ApprovalSettingsPage;
