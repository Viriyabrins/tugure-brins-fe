import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3, Users, FileText, DollarSign, Activity, Filter,
  RefreshCw, Download, Calendar
} from 'lucide-react';
import { AdminKPICard } from '@/features/adminDashboard/components/AdminKPICard';
import { TransactionTable } from '@/features/adminDashboard/components/TransactionTable';
import { AuditLogViewer } from '@/features/adminDashboard/components/AuditLogViewer';
import { useAdminDashboardData } from '@/features/adminDashboard/hooks/useAdminDashboardData';

export default function AdminDashboard() {
  const {
    kpiData,
    transactions,
    auditLog,
    loading,
    transactionFilters,
    auditFilters,
    dateRange,
    setTransactionFilters,
    setAuditFilters,
    setDateRange,
    loadTransactions,
    loadAuditLog,
    refreshAll,
  } = useAdminDashboardData();

  const [activeTab, setActiveTab] = useState('kpi');

  // Extract pagination from state (would normally come from API response)
  const transactionPagination = {
    page: transactionFilters.page || 1,
    limit: transactionFilters.limit || 50,
    total: transactions.length || 0,
  };

  const auditPagination = {
    page: auditFilters.page || 1,
    limit: auditFilters.limit || 50,
    total: auditLog.length || 0,
  };

  const handleTransactionPageChange = (newPage) => {
    loadTransactions({ ...transactionFilters, page: newPage });
  };

  const handleAuditPageChange = (newPage) => {
    loadAuditLog({ ...auditFilters, page: newPage });
  };

  const handleDateRangeChange = (field, value) => {
    const newRange = { ...dateRange, [field]: value };
    setDateRange(newRange);
    refreshAll();
  };

  // Get KPI summary
  const summary = kpiData?.summary || {};
  const kpis = kpiData?.kpis || {};
  const userActivity = kpiData?.userActivity || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">System-wide transaction tracking and audit logs</p>
        </div>
        <Button
          onClick={refreshAll}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Filter by Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 block mb-2">From</label>
              <Input
                type="date"
                value={dateRange.startDate || ''}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value || null)}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 block mb-2">To</label>
              <Input
                type="date"
                value={dateRange.endDate || ''}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value || null)}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDateRange({ startDate: null, endDate: null });
                  refreshAll();
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kpi">KPI Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* KPI Tab */}
        <TabsContent value="kpi" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminKPICard
              title="Total Batches"
              value={kpis.totalBatches || 0}
              icon={BarChart3}
              unit="batches"
            />
            <AdminKPICard
              title="Total Debtors"
              value={kpis.totalDebtors || 0}
              icon={Users}
              unit="debtors"
            />
            <AdminKPICard
              title="Total Claims"
              value={kpis.totalClaims || 0}
              icon={FileText}
              unit="claims"
            />
            <AdminKPICard
              title="Total Exposure"
              value={`Rp ${(kpis.totalExposure || 0).toLocaleString('id-ID')}`}
              icon={DollarSign}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminKPICard
              title="Gross Premium"
              value={`Rp ${(kpis.totalGrossPremium || 0).toLocaleString('id-ID')}`}
              icon={DollarSign}
            />
            <AdminKPICard
              title="Net Premium"
              value={`Rp ${(kpis.totalNetPremium || 0).toLocaleString('id-ID')}`}
              icon={DollarSign}
            />
            <AdminKPICard
              title="Total Claims Amount"
              value={`Rp ${(kpis.totalClaimAmount || 0).toLocaleString('id-ID')}`}
              icon={DollarSign}
            />
            <AdminKPICard
              title="Reinsurance Share (TUGURE)"
              value={`Rp ${(kpis.totalTugureShare || 0).toLocaleString('id-ID')}`}
              icon={DollarSign}
            />
          </div>

          {/* User Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Top Users by Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userActivity.length > 0 ? (
                  userActivity.slice(0, 10).map((user, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                    >
                      <span className="font-mono text-sm">{user.user}</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {user.actionCount} actions
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm">No activity data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Entity Type</label>
                  <select
                    value={transactionFilters.entityType || ''}
                    onChange={(e) =>
                      setTransactionFilters({
                        ...transactionFilters,
                        entityType: e.target.value || null,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">All Types</option>
                    <option value="Batch">Batch</option>
                    <option value="Debtor">Debtor</option>
                    <option value="Claim">Claim</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Status</label>
                  <Input
                    placeholder="Filter by status..."
                    value={transactionFilters.status || ''}
                    onChange={(e) =>
                      setTransactionFilters({
                        ...transactionFilters,
                        status: e.target.value || null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">User Email</label>
                  <Input
                    placeholder="Filter by email..."
                    value={transactionFilters.userEmail || ''}
                    onChange={(e) =>
                      setTransactionFilters({
                        ...transactionFilters,
                        userEmail: e.target.value || null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() =>
                      loadTransactions({
                        ...transactionFilters,
                        page: 1,
                      })
                    }
                    className="w-full"
                  >
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Showing all entity changes across the system</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable
                transactions={transactions}
                loading={loading}
                pagination={transactionPagination}
                onPageChange={handleTransactionPageChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Action</label>
                  <Input
                    placeholder="Filter by action..."
                    value={auditFilters.action || ''}
                    onChange={(e) =>
                      setAuditFilters({
                        ...auditFilters,
                        action: e.target.value || null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Module</label>
                  <Input
                    placeholder="Filter by module..."
                    value={auditFilters.module || ''}
                    onChange={(e) =>
                      setAuditFilters({
                        ...auditFilters,
                        module: e.target.value || null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-2">User Email</label>
                  <Input
                    placeholder="Filter by email..."
                    value={auditFilters.userEmail || ''}
                    onChange={(e) =>
                      setAuditFilters({
                        ...auditFilters,
                        userEmail: e.target.value || null,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() =>
                      loadAuditLog({
                        ...auditFilters,
                        page: 1,
                      })
                    }
                    className="w-full"
                  >
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Complete activity history across all modules</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogViewer
                logs={auditLog}
                loading={loading}
                pagination={auditPagination}
                onPageChange={handleAuditPageChange}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
