import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { format } from 'date-fns';
import { backend } from '@/api/backendClient';

export default function NotificationList() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  
  const [notifications, setNotifications] = useState([]);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [notifPage, setNotifPage] = useState(1);
  const notifPageSize = 10;

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { default: keycloakService } = await import('@/services/keycloakService');
      const userInfo = keycloakService.getCurrentUserInfo();
      if (userInfo) {
        setCurrentUserId(userInfo.id || '');
        setIsUserLoaded(true);
        return userInfo.id || '';
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
    setIsUserLoaded(true);
    return '';
  };

  const loadNotifications = async (pageToLoad = notifPage, userId = currentUserId) => {
    try {
      const result = await backend.listNotifications({
        unread: 'true',
        page: pageToLoad,
        limit: notifPageSize,
        target_user: userId
      });
      setNotifications(Array.isArray(result.data) ? result.data : []);
      setTotalNotifications(Number(result.pagination?.total) || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
      setTotalNotifications(0);
    }
  };

  useEffect(() => {
    if (isUserLoaded) {
      loadNotifications(notifPage, currentUserId);
    }
  }, [notifPage, currentUserId, isUserLoaded]);

  const handleMarkAsRead = async (notifId) => {
    try {
      await backend.updateNotification(notifId, { is_read: true });
      loadNotifications(notifPage, currentUserId);
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const notifTotal = totalNotifications;
  const notifTotalPages = Math.max(1, Math.ceil(notifTotal / notifPageSize));
  const notifFrom = notifTotal === 0 ? 0 : (notifPage - 1) * notifPageSize + 1;
  const notifTo = Math.min(notifTotal, notifPage * notifPageSize);
  const pageNotifications = Array.isArray(notifications) ? notifications : [];

  // Keep page within bounds
  useEffect(() => {
    if (notifPage > notifTotalPages && notifTotalPages > 0) setNotifPage(notifTotalPages);
  }, [notifTotalPages, notifPage]);

  return (
    <div className="space-y-3">
      {!pageNotifications || pageNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No notifications</p>
          </CardContent>
        </Card>
      ) : (
        pageNotifications.map((notif) => (
          <Card key={notif.id} className={notif.is_read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${notif.is_read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                  <Bell className={`w-5 h-5 ${notif.is_read ? 'text-gray-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                      <Badge variant="outline">{notif.type.replace(/_/g, ' ')}</Badge>
                      {notif.module && <Badge variant="outline">{notif.module}</Badge>}
                      {notif.is_read && <Badge className="bg-gray-300 text-gray-700">Read</Badge>}
                    </div>
                    {notif.created_at && (
                      <span className="text-xs text-gray-500">
                        {format(new Date(notif.created_at), 'MMM d, HH:mm')}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{notif.message}</p>
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
        ))
      )}

      {/* Notification Pagination */}
      {pageNotifications.length > 0 && notifTotalPages > 1 && (
        <div className="flex justify-between items-center py-3">
          <p className="text-sm text-gray-500">
            Showing {notifFrom} to {notifTo} of {notifTotal} results
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={notifPage === 1}
              onClick={() => setNotifPage(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={notifPage === 1}
              onClick={() => setNotifPage(notifPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-gray-600">
              Page {notifPage} of {notifTotalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={notifPage === notifTotalPages}
              onClick={() => setNotifPage(notifPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={notifPage === notifTotalPages}
              onClick={() => setNotifPage(notifTotalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
