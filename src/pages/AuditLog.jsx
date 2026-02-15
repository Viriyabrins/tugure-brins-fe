import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Calendar as CalendarIcon, Filter, Download, 
  RefreshCw, User, FileText, Eye, Search
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import GradientStatCard from '@/components/dashboard/GradientStatCard';
import FilterTab from '@/components/common/FilterTab';

const defaultFilter = {
  contract: "all",
  batch: "",
  submitStatus: "all",
  status: "all",
  startDate: "",
  endDate: "",
  module: "all",
}

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(defaultFilter);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      let data = await base44.entities.AuditLog.list();
      
      // Filter out any logs with sibernetik email
      if (data && data.length > 0) {
        data = data.filter(log => 
          !log.user_email?.includes('sibernetik') && 
          !log.user_email?.includes('@base44')
        );
      }
      
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Entity Type', 'Entity ID'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.created_date).toLocaleString('id-ID'),
        log.user_email,
        log.user_role,
        log.module,
        log.action,
        log.entity_type,
        log.entity_id
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredLogs = logs.filter(log => {
    if (filters.module !== 'all' && log.module !== filters.module) return false;
    if (filters.user && !log.user_email?.toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.action && !log.action?.toLowerCase().includes(filters.action.toLowerCase())) return false;
    if (filters.startDate && new Date(log.created_date) < filters.startDate) return false;
    if (filters.endDate && new Date(log.created_date) > filters.endDate) return false;
    return true;
  });

  const getActionColor = (action) => {
    if (action?.includes('CREATE') || action?.includes('SUBMIT')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (action?.includes('APPROVE') || action?.includes('SUCCESS')) return 'bg-green-100 text-green-700 border-green-200';
    if (action?.includes('REJECT') || action?.includes('DELETE')) return 'bg-red-100 text-red-700 border-red-200';
    if (action?.includes('UPDATE') || action?.includes('MATCH')) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const columns = [
    { 
      header: 'Timestamp',
      cell: (row) => (
        <div className="text-sm">
          <p className="font-medium">{format(new Date(row.created_date), 'MMM d, yyyy')}</p>
          <p className="text-gray-500 text-xs">{format(new Date(row.created_date), 'HH:mm:ss')}</p>
        </div>
      ),
      width: '140px'
    },
    {
      header: 'User',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <div>
            <p className="font-medium text-sm">{row.user_email}</p>
            <Badge variant="outline" className="text-xs">
              {row.user_role}
            </Badge>
          </div>
        </div>
      )
    },
    {
      header: 'Module',
      cell: (row) => (
        <Badge variant="outline">
          {row.module}
        </Badge>
      )
    },
    {
      header: 'Action',
      cell: (row) => (
        <Badge variant="outline" className={getActionColor(row.action)}>
          {row.action}
        </Badge>
      )
    },
    {
      header: 'Entity',
      cell: (row) => (
        <div className="text-sm">
          <p className="font-medium">{row.entity_type}</p>
          <p className="text-gray-500 text-xs font-mono">{row.entity_id?.slice(0, 12)}</p>
        </div>
      )
    },
    {
      header: 'Changes',
      cell: (row) => (
        <Button variant="ghost" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      ),
      width: '80px'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="System activity and change tracking"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Audit Log' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />

      {/* Gradient Stat Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GradientStatCard
          title="Total Logs"
          value={logs.length}
          subtitle="All recorded activities"
          icon={Shield}
          gradient="from-blue-500 to-blue-600"
        />
        <GradientStatCard
          title="Filtered Results"
          value={filteredLogs.length}
          subtitle="Filtered audit logs count"
          icon={Filter}
          gradient="from-green-500 to-green-600"
        />
        <GradientStatCard
          title="Unique Users"
          value={new Set(logs.map(l => l.user_email)).size}
          subtitle="Number of unique users"
          icon={User}
          gradient="from-purple-500 to-purple-600"
        />
        <GradientStatCard
          title="Today's Activity"
          value={logs.filter(l => {
            const today = new Date();
            const logDate = new Date(l.created_date);
            return logDate.toDateString() === today.toDateString();
          }).length}
          subtitle="Today's audit log count"
          icon={FileText}
          gradient="from-orange-500 to-orange-600"
        />
      </div>

      {/* Filters */}
      <FilterTab
        filters={filters}
        onFilterChange={setFilters}
        defaultFilters={defaultFilter}
        filterConfig={[
          {
            key:"user",
            placeholder:"Search user...",
            label: "User",
            icon: Search,
            type: "input"
          },
          {
            key:"module",
            label: "Module",
            icon: Filter,
            options: [
              { value: 'all', label: 'All Modules' },
              { value: 'AUTH', label: 'Authentication' },
              { value: 'DEBTOR', label: 'Debtor' },
              { value: 'BORDERO', label: 'Bordero' },
              { value: 'PAYMENT', label: 'Payment' },
              { value: 'RECONCILIATION', label: 'Reconciliation' },
              { value: 'CLAIM', label: 'Claim' },
              { value: 'CONFIG', label: 'Configuration' },
            ]
          },
          {
              key: "startDate",
              placeholder: "Start Date",
              label: "Start Date",
              type: "date"
          },
          {
              key: "endDate",
              placeholder: "End Date",
              label: "End Date",
              type: "date"
          },
        ]}
      />

      {/* Audit Log Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        isLoading={loading}
        emptyMessage="No audit logs found"
      />
    </div>
  );
}