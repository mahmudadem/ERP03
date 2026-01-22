import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

export const NewCompanyCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="p-5 flex flex-col justify-between border-dashed border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-300 group cursor-pointer" onClick={() => navigate('/company-wizard')}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:border-blue-200 group-hover:bg-white transition-all">
            <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              Add Company
            </h3>
            <p className="text-sm font-medium text-gray-500">
              Create a new workspace
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 group-hover:border-blue-100 group-hover:bg-blue-50/50 transition-all">
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
            Need another workspace for a different entity or project? Start the guided setup wizard.
          </p>
        </div>
      </div>
      
      <div className="mt-6 pt-4">
        <Button 
          variant="outline"
          className="w-full border-gray-200 hover:border-blue-500 hover:text-blue-600 font-semibold py-2.5 rounded-xl transition-all"
        >
          Start Wizard
        </Button>
      </div>
    </Card>
  );
};
