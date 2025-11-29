import React, { useEffect, useState } from 'react';
import { Card } from '../../../../components/ui/Card';
import { Button } from '../../../../components/ui/Button';
import { wizardApi } from '../api';
import { WizardSessionProvider, useWizardSession } from '../context/WizardSessionContext';
import { useNavigate } from 'react-router-dom';

const SelectModelForm: React.FC = () => {
  const navigate = useNavigate();
  const { startWizard, loading } = useWizardSession();
  const [companyName, setCompanyName] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<Array<{ id: string; labelEn: string }>>([]);

  useEffect(() => {
    const load = async () => {
      const data = await wizardApi.getAvailableModels();
      setModels(data);
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !model) return;
    const sessionId = await startWizard(companyName, model);
    navigate(`/company-wizard/run?sessionId=${sessionId}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Create Company</h1>
          <p className="text-sm text-gray-500">Select the business model to start the guided setup.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-800">Company Name</label>
            <input
              type="text"
              className="border rounded px-3 py-2 text-sm"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-800">Model</label>
            <select
              className="border rounded px-3 py-2 text-sm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
            >
              <option value="">Select a model</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Starting...' : 'Start Wizard'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

const SelectModelPage: React.FC = () => (
  <WizardSessionProvider>
    <SelectModelForm />
  </WizardSessionProvider>
);

export default SelectModelPage;
