import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, CheckCircle2, AlertCircle, RefreshCw, Trash2, Check
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import { format } from 'date-fns';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Notification.list();
      setNotifications(data || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (id) => {
    try {
      await base44.entities.Notification.update(id, { is_read: true });
      loadData();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      for (const notif of unread) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
      setSuccessMessage('All notifications marked as read');
      loadData();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all notifications?')) return;
    
    try {
      for (const notif of notifications) {
        await base44.entities.Notification.delete(notif.id);
      }
      setSuccessMessage('All notifications deleted');
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        subtitle={`${unreadNotifications.length} unread notifications`}
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Notifications' }
        ]}
        actions={
          <div className="flex gap-2">
            {unreadNotifications.length > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                <Check className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="outline" onClick={handleDeleteAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No notifications</p>
          </CardContent>
        </Card>
      )}

      {!loading && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card 
              key={notif.id} 
              className={notif.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200'}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${notif.is_read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                    <Bell className={`w-5 h-5 ${notif.is_read ? 'text-gray-500' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className={`font-semibold ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                          {notif.title}
                        </h4>
                        <Badge variant="outline">{notif.type?.replace(/_/g, ' ')}</Badge>
                        <Badge variant="outline">{notif.module}</Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(notif.created_date), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className={`text-sm mb-3 ${notif.is_read ? 'text-gray-600' : 'text-gray-700'}`}>
                      {notif.message}
                    </p>
                    {!notif.is_read && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkAsRead(notif.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}