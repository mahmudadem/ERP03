import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import apiClient from '../api/client';
import { errorHandler } from '../services/errorHandler';
import { 
  Bell, 
  Send,
  AlertTriangle,
  Info,
  CheckCircle,
  FileText
} from 'lucide-react';

export const TestNotificationPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: 'Test Notification from UI',
    message: 'This is a custom message to test real-time delivery.',
    type: 'INFO',
    category: 'SYSTEM'
  });

  const handleSend = async () => {
    try {
      setLoading(true);
      await apiClient.post('/tenant/notifications/test', formData);
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
      errorHandler.showSuccess('Notification dispatched successfully');
    } catch (error) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
          <Bell className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Tester</h1>
          <p className="text-sm text-gray-500">Dispatch test notifications to your current user</p>
        </div>
      </div>

      <Card className="p-6">
        <form className="space-y-5" onSubmit={e => { e.preventDefault(); handleSend(); }}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Notification Title</label>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
              required 
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Message Body</label>
            <textarea 
              value={formData.message}
              onChange={e => setFormData({...formData, message: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none min-h-[100px]"
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Severity Type</label>
              <div className="relative">
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full appearance-none px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="INFO">Info</option>
                  <option value="SUCCESS">Success</option>
                  <option value="WARNING">Warning</option>
                  <option value="ERROR">Error</option>
                  <option value="ACTION_REQUIRED">Action Required</option>
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {formData.type === 'INFO' && <Info className="w-4 h-4" />}
                  {formData.type === 'SUCCESS' && <CheckCircle className="w-4 h-4" />}
                  {formData.type === 'WARNING' && <AlertTriangle className="w-4 h-4" />}
                  {formData.type === 'ERROR' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  {formData.type === 'ACTION_REQUIRED' && <Bell className="w-4 h-4 text-orange-500" />}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Category</label>
              <div className="relative">
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full appearance-none px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="SYSTEM">System</option>
                  <option value="APPROVAL">Approval</option>
                  <option value="CUSTODY">Custody</option>
                  <option value="HR">HR</option>
                  <option value="INVENTORY">Inventory</option>
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full md:w-auto px-8 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Dispatching...' : 'Dispatch Notification'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
