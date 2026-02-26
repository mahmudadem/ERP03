import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Check, Trash2, Filter, Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { client } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { errorHandler } from '../../../services/errorHandler';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItem {
  id: string;
  type: 'ACTION_REQUIRED' | 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  category: string;
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: string;
  readBy: string[];
}

const resolveNotificationActionUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (/^\/accounting\/vouchers\/[^/]+$/.test(url)) {
    return `${url}/view`;
  }
  return url;
};

export const NotificationInboxPage: React.FC = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { companyId } = useCompanyAccess();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await client.get('/tenant/notifications?limit=100');
      const payload = (response as any)?.data ?? response;
      if (payload?.notifications) {
        setNotifications(payload.notifications);
      }
    } catch (error) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.uid && companyId) {
      fetchNotifications();
    }
  }, [user?.uid, companyId]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await client.post(`/tenant/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, readBy: [...(n.readBy || []), user?.uid || ''] } : n
        )
      );
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
    } catch (error) {
      errorHandler.showError(error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await client.post('/tenant/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => ({ ...n, readBy: [...(n.readBy || []), user?.uid || ''] }))
      );
      window.dispatchEvent(new CustomEvent('notifications:refresh'));
    } catch (error) {
      errorHandler.showError(error);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    const isRead = notification.readBy?.includes(user?.uid || '');
    if (!isRead) {
      handleMarkAsRead(notification.id);
    }
    const actionUrl = resolveNotificationActionUrl(notification.actionUrl);
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ACTION_REQUIRED': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'WARNING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ERROR': return 'bg-red-100 text-red-800 border-red-200';
      case 'SUCCESS': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const isRead = n.readBy?.includes(user?.uid || '');
    if (filter === 'UNREAD' && isRead) return false;
    if (filter === 'READ' && !isRead) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!n.title.toLowerCase().includes(term) && !n.message.toLowerCase().includes(term) && !n.category.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  const unreadCount = notifications.filter(n => !n.readBy?.includes(user?.uid || '')).length;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-500" />
            Notifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['ALL', 'UNREAD', 'READ'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border transition-colors ${
                filter === f
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Bell className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-300">All caught up!</p>
            <p className="text-sm">No notifications found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredNotifications.map((notification) => {
              const isRead = notification.readBy?.includes(user?.uid || '');
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer flex gap-4 ${
                    !isRead ? 'bg-indigo-50/30 dark:bg-indigo-500/5' : ''
                  }`}
                >
                  <div className="mt-1 flex-shrink-0">
                    {!isRead ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${getTypeColor(notification.type)}`}>
                        {notification.category}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm md:text-base font-semibold truncate ${!isRead ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {notification.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {notification.message}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationInboxPage;
