import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; import { } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';

/**
 * Forms Designer Page — DEPRECATED
 * 
 * This legacy accounting-specific forms designer has been replaced by the
 * unified Tools Forms Designer at /tools/forms-designer.
 * 
 * This component now redirects to the new location with the Accounting module pre-selected.
 */
export default function FormsDesignerPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/tools/forms-designer', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <Spinner size="lg" variant="indigo" className="mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Redirecting to Document Form Designer...</p>
        <p className="text-slate-400 text-sm mt-2">The Accounting Forms Designer has moved to Tools.</p>
      </div>
    </div>
  );
}
