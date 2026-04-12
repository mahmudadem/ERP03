
import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ItemMasterCard from '../components/ItemMasterCard';

const ItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Determine where to go back to based on current module
  const itemsBasePath = pathname.startsWith('/sales/')
    ? '/sales/items'
    : pathname.startsWith('/purchases/')
      ? '/purchases/items'
      : '/inventory/items';

  const handleClose = () => {
    navigate(itemsBasePath);
  };

  const handleSaved = () => {
    navigate(itemsBasePath);
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950">
      <ItemMasterCard 
        itemId={id} 
        onClose={handleClose}
        onSaved={handleSaved}
        isWindow={false}
      />
    </div>
  );
};

export default ItemDetailPage;
