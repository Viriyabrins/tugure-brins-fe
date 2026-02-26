import React from 'react';
import PageHeader from "@/components/common/PageHeader";
import NotificationList from '@/components/common/NotificationList';

export default function NotificationCenter() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        subtitle="View and manage your notifications"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Notifications' }
        ]}
        backUrl=""
        actions={<></>}
      />

      <NotificationList />
    </div>
  );
}