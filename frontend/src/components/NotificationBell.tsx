import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { client } from '../api/client';
import { getDatabase, ref, onValue, off } from 'firebase/database';

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

/**
 * NotificationBell Component
 * 
 * Displays a bell icon with an unread count badge.
 * Listens to Firebase Realtime DB for real-time updates.
 * Shows a dropdown with recent notifications on click.
 */
export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { companyId } = useCompanyAccess();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Listen to Firebase Realtime DB for real-time updates
  useEffect(() => {
    if (!user?.uid || !companyId) return;

    try {
      const db = getDatabase();
      const notificationsRef = ref(db, `notifications/${companyId}/${user.uid}`);
      
      const unsubscribe = onValue(notificationsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const items: NotificationItem[] = Object.values(data);
          // Sort by createdAt descending
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNotifications(items.slice(0, 10));
          
          // Count unread
          const unread = items.filter(n => !n.readBy?.includes(user.uid)).length;
          setUnreadCount(unread);
        }
      });

      return () => {
        off(notificationsRef);
      };
    } catch (error) {
      console.error('[NotificationBell] Firebase RTDB error:', error);
      // Fallback to polling
      fetchNotifications();
    }
  }, [user?.uid, companyId]);

  // Fallback: Fetch via API
  const fetchNotifications = async () => {
    if (!user?.uid || !companyId) return;
    try {
      const response = await client.get('/notifications/unread');
      if (response.data?.notifications) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.total || 0);
      }
    } catch (error) {
      console.error('[NotificationBell] API fetch error:', error);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await client.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, readBy: [...(n.readBy || []), user?.uid || ''] }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('[NotificationBell] Mark as read error:', error);
    }
  };

  // Navigate to action URL
  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.readBy?.includes(user?.uid || '')) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    setIsOpen(false);
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {notifications.map(notification => {
                const isRead = notification.readBy?.includes(user?.uid || '');
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      !isRead ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      {!isRead && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getTypeColor(notification.type)}`}>
                            {notification.category}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {notification.actionUrl && (
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
