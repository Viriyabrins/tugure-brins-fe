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

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    user: '',
    module: 'all',
    action: ''
  });

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

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      startDate: null,
      endDate: null,
      user: '',
      module: 'all',
      action: ''
    });
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-9 justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, 'PP') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(d) => handleFilterChange('startDate', d)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-9 justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, 'PP') : 'Select'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(d) => handleFilterChange('endDate', d)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">User</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search user..."
                  value={filters.user}
                  onChange={(e) => handleFilterChange('user', e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Module</label>
              <Select value={filters.module} onValueChange={(v) => handleFilterChange('module', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="AUTH">Authentication</SelectItem>
                  <SelectItem value="DEBTOR">Debtor</SelectItem>
                  <SelectItem value="BORDERO">Bordero</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                  <SelectItem value="RECONCILIATION">Reconciliation</SelectItem>
                  <SelectItem value="CLAIM">Claim</SelectItem>
                  <SelectItem value="CONFIG">Configuration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full h-9">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Logs</p>
              <p className="text-2xl font-bold">{logs.length}</p>
            </div>
            <Shield className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Filtered Results</p>
              <p className="text-2xl font-bold">{filteredLogs.length}</p>
            </div>
            <Filter className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unique Users</p>
              <p className="text-2xl font-bold">{new Set(logs.map(l => l.user_email)).size}</p>
            </div>
            <User className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Activity</p>
              <p className="text-2xl font-bold">
                {logs.filter(l => {
                  const today = new Date();
                  const logDate = new Date(l.created_date);
                  return logDate.toDateString() === today.toDateString();
                }).length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

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