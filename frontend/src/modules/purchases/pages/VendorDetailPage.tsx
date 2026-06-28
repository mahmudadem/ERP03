
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import PartyMasterCard from '../../shared/components/PartyMasterCard';

const VendorDetailPage: React.FC = () => { 
  const { t } = useTranslation(['purchases', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/purchases/vendors');
  };

  const handleSaved = () => {
    navigate('/purchases/vendors', { state: { masterDataRefreshToken: Date.now() } });
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950">
      <PartyMasterCard 
        partyId={id} 
        onClose={handleClose}
        onSaved={handleSaved}
        isWindow={false}
        role="VENDOR"
      />
    </div>
  );
};

export default VendorDetailPage;
