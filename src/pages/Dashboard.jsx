import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, FileText, DollarSign, AlertTriangle, TrendingUp, 
  Clock, CheckCircle2, XCircle, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, Download, Filter, Folder
} from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Area, AreaChart } from 'recharts';
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";
import StatusBadge from "@/components/ui/StatusBadge";
import ExportButton from "@/components/common/ExportButton";
import { base44 } from '@/api/base44Client';
import { backend } from '@/api/backendClient';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [period, setPeriod] = useState('2025-03');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    batch: 'all',
    submitStatus: 'all',
    reconStatus: 'all',
    claimStatus: 'all',
    subrogationStatus: 'all'
  });
  const [stats, setStats] = useState({
    totalDebtors: 0,
    approvedDebtors: 0,
    pendingDebtors: 0,
    rejectedDebtors: 0,
    totalExposure: 0,
    totalPremium: 0,
    totalClaims: 0,
    claimsPaid: 0,
    osRecovery: 0,
    lossRatio: 0
  });

  const [debtors, setDebtors] = useState([]);
  const [claims, setClaims] = useState([]);
  const [borderos, setBorderos] = useState([]);

  const { bypassAuth } = useAuth();
  const useBackendApi = import.meta.env.VITE_USE_BACKEND_API === 'true';

  useEffect(() => {
    if (bypassAuth && !useBackendApi) {
      setLoading(false);
      return;
    }
    if (!bypassAuth) {
      checkAuth();
    }
    loadDashboardData();
  }, [period, bypassAuth]);

  const checkAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      let debtorData = [];
      let claimData = [];
      let borderoData = [];

      if (useBackendApi) {
        [debtorData, claimData, borderoData] = await Promise.all([
          backend.list('Debtor'),
          backend.list('Claim'),
          backend.list('Bordero')
        ]);
      } else {
        [debtorData, claimData, borderoData] = await Promise.all([
          base44.entities.Debtor.list(),
          base44.entities.Claim.list(),
          base44.entities.Bordero.list()
        ]);
      }

      setDebtors(debtorData || []);
      setClaims(claimData || []);
      setBorderos(borderoData || []);

      // Calculate stats
      const approved = (debtorData || []).filter(d => d.status === 'APPROVED').length;
      const pending = (debtorData || []).filter(d => d.status === 'SUBMITTED').length;
      const rejected = (debtorData || []).filter(d => d.status === 'REJECTED').length;
      
      const totalExposure = debtorData.reduce((sum, d) => sum + (d.plafon || 0), 0);
      const totalPremium = debtorData.reduce((sum, d) => sum + (d.net_premi || 0), 0);
      const totalClaimValue = claimData.reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
      const claimsPaid = claimData.filter(c => c.status === 'Paid').reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
      
      const lossRatio = totalPremium > 0 ? ((claimsPaid / totalPremium) * 100).toFixed(1) : 0;

      setStats({
        totalDebtors: debtorData.length,
        approvedDebtors: approved,
        pendingDebtors: pending,
        rejectedDebtors: rejected,
        totalExposure,
        totalPremium,
        totalClaims: claimData.length,
        claimsPaid,
        osRecovery: totalClaimValue - claimsPaid,
        lossRatio
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
    setLoading(false);
  };

  // Chart data
  const debtorStatusData = [
    { name: 'Submitted', value: debtors.filter(d => d.status === 'SUBMITTED').length, color: '#3b82f6' },
    { name: 'Approved', value: debtors.filter(d => d.status === 'APPROVED').length, color: '#10b981' },
    { name: 'Rejected', value: debtors.filter(d => d.status === 'REJECTED').length, color: '#ef4444' },
    { name: 'Conditional', value: debtors.filter(d => d.status === 'CONDITIONAL').length, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const monthlyTrendData = [
    { month: 'Jan', premium: 2500000000, claims: 500000000, lossRatio: 20, recovery: 50000000 },
    { month: 'Feb', premium: 2800000000, claims: 600000000, lossRatio: 21.4, recovery: 60000000 },
    { month: 'Mar', premium: 3200000000, claims: 450000000, lossRatio: 14.1, recovery: 45000000 },
    { month: 'Apr', premium: 2900000000, claims: 700000000, lossRatio: 24.1, recovery: 70000000 },
    { month: 'May', premium: 3500000000, claims: 550000000, lossRatio: 15.7, recovery: 55000000 },
    { month: 'Jun', premium: 3800000000, claims: 800000000, lossRatio: 21.1, recovery: 80000000 }
  ];

  const premiumByStatusData = [
    { name: 'Approved', value: stats.totalPremium * 0.7, color: '#10B981' },
    { name: 'Pending', value: stats.totalPremium * 0.2, color: '#F59E0B' },
    { name: 'Rejected', value: stats.totalPremium * 0.1, color: '#EF4444' }
  ];

  const subrogationData = [
    { status: 'Pending', amount: 200000000, count: 15 },
    { status: 'In Progress', amount: 350000000, count: 22 },
    { status: 'Recovered', amount: 280000000, count: 18 },
    { status: 'Closed', amount: 170000000, count: 12 }
  ];

  const claimStatusData = [
    { name: 'Draft', value: claims.filter(c => c.status === 'Draft').length },
    { name: 'Checked', value: claims.filter(c => c.status === 'Checked').length },
    { name: 'Doc Verified', value: claims.filter(c => c.status === 'Doc Verified').length },
    { name: 'Invoiced', value: claims.filter(c => c.status === 'Invoiced').length },
    { name: 'Paid', value: claims.filter(c => c.status === 'Paid').length }
  ].filter(d => d.value > 0);

  const formatCurrency = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  const getFilteredData = () => {
    return debtors.filter(d => {
      if (filters.batch !== 'all' && d.batch_id !== filters.batch) return false;
      if (filters.submitStatus !== 'all' && d.status !== filters.submitStatus) return false;
      return true;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
          <p className="text-gray-500">Credit Reinsurance Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-03">March 2025</SelectItem>
              <SelectItem value="2025-02">February 2025</SelectItem>
              <SelectItem value="2025-01">January 2025</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.batch} onValueChange={(v) => setFilters({...filters, batch: v})}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {[...new Set(debtors.map(d => d.batch_id))].filter(Boolean).map(batch => (
                <SelectItem key={batch} value={batch}>{batch.slice(0, 20)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              const data = getFilteredData();
              const csv = [
                ['Debtor', 'Batch', 'Plafond', 'Status'].join(','),
                ...data.map(d => [d.nama_peserta, d.batch_id, d.plafon, d.status].join(','))
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'dashboard-export.csv';
              a.click();
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModernKPI
          title="Total Exposure"
          value={`Rp ${formatCurrency(stats.totalExposure)}`}
          subtitle={`${stats.approvedDebtors} approved debtors`}
          icon={TrendingUp}
          color="blue"
        />
        <ModernKPI
          title="Total Premium"
          value={`Rp ${formatCurrency(stats.totalPremium)}`}
          subtitle="Net premium collected"
          icon={DollarSign}
          color="green"
        />
        <ModernKPI
          title="Claims Paid"
          value={`Rp ${formatCurrency(stats.claimsPaid)}`}
          subtitle={`${claims.filter(c => c.status === 'Paid').length} claims settled`}
          icon={FileText}
          color="orange"
        />
        <ModernKPI
          title="Loss Ratio"
          value={`${stats.lossRatio}%`}
          subtitle="Claims vs Premium"
          icon={BarChart3}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ModernKPI title="Total Debtors" value={stats.totalDebtors} icon={Users} color="blue" />
        <ModernKPI title="Pending Approval" value={stats.pendingDebtors} subtitle="Awaiting review" icon={Clock} color="orange" />
        <ModernKPI title="OS Recovery" value={`Rp ${formatCurrency(stats.osRecovery)}`} icon={AlertTriangle} color="red" />
        <ModernKPI title="Total Claims" value={stats.totalClaims} icon={FileText} color="purple" />
      </div>

      {/* Charts Row 1 - Debtor & Premium Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debtor Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gray-500" />
              Debtor Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={debtorStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {debtorStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {debtorStatusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-gray-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Premium by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-500" />
              Premium by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={premiumByStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ value }) => `IDR ${formatCurrency(value)}`}
                  >
                    {premiumByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `IDR ${formatCurrency(value)}`} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {premiumByStatusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-gray-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Loss Ratio & Claims Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loss Ratio Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              Loss Ratio Trend (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" domain={[0, 30]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="lossRatio" stroke="#8B5CF6" strokeWidth={3} name="Loss Ratio %" dot={{ fill: '#8B5CF6', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-purple-700">Current Loss Ratio: {stats.lossRatio}%</span>
                <span className="text-gray-500 ml-2">(Industry average: ~20-25%)</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Premium vs Claims Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              Premium vs Claims Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => `IDR ${formatCurrency(value)}`} />
                  <Legend />
                  <Bar dataKey="premium" fill="#3B82F6" name="Premium" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="claims" fill="#EF4444" name="Claims Paid" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 - Recovery & Subrogation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Recovery Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              Outstanding Recovery Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => `IDR ${formatCurrency(value)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="recovery" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} name="Recovery Amount" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-3 bg-orange-50 rounded-lg">
              <p className="text-sm">
                <span className="font-semibold text-orange-700">Total OS Recovery: IDR {formatCurrency(stats.osRecovery)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subrogation Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500" />
              Subrogation by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subrogationData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="category" dataKey="status" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => `IDR ${formatCurrency(value)}`} />
                  <Bar dataKey="amount" fill="#10B981" name="Recovery Amount" radius={[4, 4, 0, 0]}>
                    {subrogationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {subrogationData.map((item, idx) => (
                <div key={idx} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{item.status}</p>
                  <p className="text-sm font-semibold">{item.count} cases</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims Status Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Claims Summary by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {claimStatusData.map((status, idx) => (
              <div key={idx} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-2xl font-bold">{status.value}</span>
                </div>
                <p className="text-sm text-gray-600">{status.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {((status.value / claims.length) * 100).toFixed(1)}% of total
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimStatusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#6B7280" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                    {claimStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}