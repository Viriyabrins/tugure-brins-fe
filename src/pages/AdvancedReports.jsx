import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileText, RefreshCw, Download, Filter, Clock, CreditCard, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import FilterTab from '@/components/common/FilterTab';
import DataTable from '@/components/common/DataTable';
import GradientStatCard from '@/components/dashboard/GradientStatCard';

export default function AdvancedReports() {
  const [activeTab, setActiveTab] = useState('loss-ratio');
  const [loading, setLoading] = useState(true);
  const [debtors, setDebtors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [filters, setFilters] = useState({
    batch: 'all',
    period: '2024',
    branch: 'all',
    plafonRange: 'all',
    batchStatus: 'all',
    claimStatus: 'all',
    creditType: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, batchData, claimData, subrogationData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Batch.list(),
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list()
      ]);
      setDebtors(debtorData || []);
      setBatches(batchData || []);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  // Filter data based on selected filters
  const filteredDebtors = debtors.filter(d => {
    if (filters.batch !== 'all' && d.batch_id !== filters.batch) return false;
    if (filters.period !== 'all' && d.batch_year?.toString() !== filters.period) return false;
    if (filters.branch !== 'all' && d.branch_code !== filters.branch) return false;
    if (filters.batchStatus !== 'all' && d.batch_status !== filters.batchStatus) return false;
    if (filters.claimStatus !== 'all' && d.claim_status !== filters.claimStatus) return false;
    if (filters.creditType !== 'all' && d.credit_type !== filters.creditType) return false;
    if (filters.plafonRange !== 'all') {
      const plafon = d.credit_plafond || 0;
      if (filters.plafonRange === '<100M' && plafon >= 100000000) return false;
      if (filters.plafonRange === '100-500M' && (plafon < 100000000 || plafon >= 500000000)) return false;
      if (filters.plafonRange === '500M-1B' && (plafon < 500000000 || plafon >= 1000000000)) return false;
      if (filters.plafonRange === '>1B' && plafon < 1000000000) return false;
    }
    return true;
  });

  const filteredBatches = batches.filter(b => {
    if (filters.batch !== 'all' && b.batch_id !== filters.batch) return false;
    if (filters.batchStatus !== 'all' && b.status !== filters.batchStatus) return false;
    return true;
  });

  const filteredClaims = claims.filter(c => {
    if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
    return true;
  });

  const filteredSubrogations = subrogations.filter(s => {
    const matchingClaim = claims.find(c => c.id === s.claim_id);
    if (filters.claimStatus !== 'all' && matchingClaim?.claim_status !== filters.claimStatus) return false;
    return true;
  });

  // Loss Ratio Calculations (STATUS-BASED)
  const lossRatioData = () => {
    // Only include Paid/Closed batches for earned premium
    const earnedBatches = filteredBatches.filter(b => ['Paid', 'Closed'].includes(b.status));
    const earnedBatchIds = earnedBatches.map(b => b.batch_id);
    const earnedDebtors = filteredDebtors.filter(d => earnedBatchIds.includes(d.batch_id));
    
    const premiumEarned = earnedDebtors.reduce((sum, d) => sum + (d.gross_premium || 0), 0);
    
    // Only count Paid claims
    const paidClaims = filteredClaims.filter(c => c.claim_status === 'Paid');
    const claimPaid = paidClaims.reduce((sum, c) => sum + (c.share_tugure_amount || 0), 0);
    
    const lossRatio = premiumEarned > 0 ? (claimPaid / premiumEarned * 100) : 0;

    // Process Health
    const totalBatches = filteredBatches.length;
    const closedBatches = filteredBatches.filter(b => b.status === 'Closed').length;
    const outstandingBatches = totalBatches - closedBatches;
    
    const totalClaimsInvoiced = filteredClaims.filter(c => ['Invoiced', 'Paid'].includes(c.claim_status)).length;
    const totalClaimsPaid = paidClaims.length;
    const claimPaymentRate = totalClaimsInvoiced > 0 ? (totalClaimsPaid / totalClaimsInvoiced * 100) : 0;

    // Trend by status
    const monthlyData = {};
    paidClaims.forEach(c => {
      const date = c.paid_date || c.created_date;
      if (!date) return;
      const key = date.substring(0, 7); // YYYY-MM
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, claimPaid: 0, Draft: 0, Checked: 0, 'Doc Verified': 0, Invoiced: 0, Paid: 0 };
      }
      monthlyData[key].claimPaid += c.share_tugure_amount || 0;
    });

    // Add claim status distribution by month
    filteredClaims.forEach(c => {
      const date = c.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, claimPaid: 0, Draft: 0, Checked: 0, 'Doc Verified': 0, Invoiced: 0, Paid: 0 };
      }
      monthlyData[key][c.claim_status] = (monthlyData[key][c.claim_status] || 0) + 1;
    });

    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Distribution by credit type
    const byCreditType = {};
    earnedDebtors.forEach(d => {
      const type = d.credit_type || 'Unknown';
      if (!byCreditType[type]) byCreditType[type] = { premium: 0, claim: 0 };
      byCreditType[type].premium += d.gross_premium || 0;
    });
    paidClaims.forEach(c => {
      const debtor = debtors.find(d => d.id === c.debtor_id);
      const type = debtor?.credit_type || 'Unknown';
      if (!byCreditType[type]) byCreditType[type] = { premium: 0, claim: 0 };
      byCreditType[type].claim += c.share_tugure_amount || 0;
    });
    const creditTypeData = Object.entries(byCreditType).map(([type, data]) => ({
      type,
      lossRatio: data.premium > 0 ? ((data.claim / data.premium) * 100).toFixed(2) : 0,
      premium: data.premium,
      claim: data.claim
    }));

    // Distribution by branch
    const byBranch = {};
    earnedDebtors.forEach(d => {
      const branch = d.branch_desc || 'Unknown';
      if (!byBranch[branch]) byBranch[branch] = { premium: 0, claim: 0 };
      byBranch[branch].premium += d.gross_premium || 0;
    });
    paidClaims.forEach(c => {
      const debtor = debtors.find(d => d.id === c.debtor_id);
      const branch = debtor?.branch_desc || 'Unknown';
      if (!byBranch[branch]) byBranch[branch] = { premium: 0, claim: 0 };
      byBranch[branch].claim += c.share_tugure_amount || 0;
    });
    const branchData = Object.entries(byBranch).map(([branch, data]) => ({
      branch,
      lossRatio: data.premium > 0 ? ((data.claim / data.premium) * 100).toFixed(2) : 0
    })).sort((a, b) => parseFloat(b.lossRatio) - parseFloat(a.lossRatio)).slice(0, 10);

    return { 
      premiumEarned, 
      claimPaid, 
      lossRatio, 
      closedBatches,
      outstandingBatches,
      claimPaymentRate,
      trend,
      creditTypeData,
      branchData
    };
  };

  // Premium by Status (PROCESS PERFORMANCE)
  const premiumByStatus = () => {
    const totalGrossPremium = filteredBatches.reduce((sum, b) => sum + (b.total_premium || 0), 0);
    const netPremium = filteredDebtors.reduce((sum, d) => sum + (d.net_premium || 0), 0);
    
    // Paid Premium = batch_status in (Paid, Closed)
    const paidBatches = filteredBatches.filter(b => ['Paid', 'Closed'].includes(b.status));
    const paidPremium = paidBatches.reduce((sum, b) => sum + (b.total_premium || 0), 0);
    const paidPercentage = totalGrossPremium > 0 ? (paidPremium / totalGrossPremium * 100) : 0;
    
    // Outstanding Premium
    const outstandingPremium = totalGrossPremium - paidPremium;
    const outstandingPercentage = totalGrossPremium > 0 ? (outstandingPremium / totalGrossPremium * 100) : 0;

    // Premium by batch status
    const statusData = {};
    filteredBatches.forEach(b => {
      const status = b.status || 'UNKNOWN';
      statusData[status] = (statusData[status] || 0) + (b.total_premium || 0);
    });
    const byStatus = Object.entries(statusData).map(([status, amount]) => ({
      status,
      amount
    })).sort((a, b) => b.amount - a.amount);

    // Trend over time by status
    const monthlyData = {};
    filteredBatches.forEach(b => {
      const date = b.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, Uploaded: 0, Validated: 0, Matched: 0, Approved: 0, 'Nota Issued': 0, 'Branch Confirmed': 0, Paid: 0, Closed: 0 };
      }
      const status = b.status || 'UNKNOWN';
      monthlyData[key][status] = (monthlyData[key][status] || 0) + (b.total_premium || 0);
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Distribution by branch
    const byBranch = {};
    filteredDebtors.forEach(d => {
      const branch = d.branch_desc || 'Unknown';
      const status = d.batch_status || 'UNKNOWN';
      if (!byBranch[branch]) byBranch[branch] = { paid: 0, outstanding: 0 };
      if (['Paid', 'Closed'].includes(status)) {
        byBranch[branch].paid += d.gross_premium || 0;
      } else {
        byBranch[branch].outstanding += d.gross_premium || 0;
      }
    });
    const branchData = Object.entries(byBranch).map(([branch, data]) => ({
      branch,
      paid: data.paid,
      outstanding: data.outstanding
    })).sort((a, b) => (b.paid + b.outstanding) - (a.paid + a.outstanding)).slice(0, 10);

    // Identify bottleneck
    const bottleneck = byStatus.find(s => !['Paid', 'Closed'].includes(s.status)) || {};

    return { 
      totalGrossPremium,
      netPremium,
      paidPremium,
      paidPercentage,
      outstandingPremium,
      outstandingPercentage,
      byStatus,
      trend,
      branchData,
      bottleneck
    };
  };

  // Claim Paid Report (LIFECYCLE VIEW)
  const claimPaidData = () => {
    const paidClaims = filteredClaims.filter(c => c.claim_status === 'Paid');
    const totalPaid = paidClaims.reduce((sum, c) => sum + (c.share_tugure_amount || 0), 0);
    
    // Claims in progress
    const inProgress = filteredClaims.filter(c => ['Draft', 'Checked', 'Doc Verified'].includes(c.claim_status)).length;
    
    // Claims invoiced but not paid
    const invoicedNotPaid = filteredClaims.filter(c => c.claim_status === 'Invoiced').length;
    
    // Average settlement time (simplified - using dates if available)
    let totalDays = 0;
    let settledCount = 0;
    paidClaims.forEach(c => {
      if (c.created_date && c.paid_date) {
        const created = new Date(c.created_date);
        const paid = new Date(c.paid_date);
        const days = Math.floor((paid - created) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          totalDays += days;
          settledCount++;
        }
      }
    });
    const avgSettlementDays = settledCount > 0 ? Math.round(totalDays / settledCount) : 0;

    // Trend by status over time
    const monthlyData = {};
    filteredClaims.forEach(c => {
      const date = c.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, Draft: 0, Checked: 0, 'Doc Verified': 0, Invoiced: 0, Paid: 0 };
      }
      monthlyData[key][c.claim_status] = (monthlyData[key][c.claim_status] || 0) + 1;
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Distribution by status
    const byStatus = {};
    filteredClaims.forEach(c => {
      const status = c.claim_status || 'UNKNOWN';
      if (!byStatus[status]) byStatus[status] = 0;
      byStatus[status] += c.share_tugure_amount || 0;
    });
    const statusData = Object.entries(byStatus).map(([status, amount]) => ({ status, amount }));

    // Distribution by product
    const byProduct = {};
    paidClaims.forEach(c => {
      const debtor = debtors.find(d => d.id === c.debtor_id);
      const product = debtor?.credit_type || 'Unknown';
      byProduct[product] = (byProduct[product] || 0) + (c.share_tugure_amount || 0);
    });
    const productData = Object.entries(byProduct).map(([product, amount]) => ({ product, amount }));

    return { 
      totalPaid,
      count: paidClaims.length,
      inProgress,
      invoicedNotPaid,
      avgSettlementDays,
      trend,
      statusData,
      productData
    };
  };

  // Outstanding Recovery (OUTSTANDING RISK VIEW)
  const outstandingRecovery = () => {
    const paidClaims = filteredClaims.filter(c => c.claim_status === 'Paid');
    const totalClaimPaid = paidClaims.reduce((sum, c) => sum + (c.share_tugure_amount || 0), 0);
    
    const paidSubrogations = filteredSubrogations.filter(s => s.status === 'Paid / Closed');
    const totalRecovered = paidSubrogations.reduce((sum, s) => sum + (s.recovery_amount || 0), 0);
    
    const outstanding = totalClaimPaid - totalRecovered;

    // Trend over time
    const monthlyData = {};
    paidClaims.forEach(c => {
      const date = c.paid_date || c.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, recovered: 0, outstanding: 0 };
      monthlyData[key].claimPaid += c.share_tugure_amount || 0;
    });
    paidSubrogations.forEach(s => {
      const date = s.closed_date || s.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, recovered: 0, outstanding: 0 };
      monthlyData[key].recovered += s.recovery_amount || 0;
    });
    Object.values(monthlyData).forEach(m => {
      m.outstanding = m.claimPaid - m.recovered;
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Distribution by credit type
    const byType = {};
    paidClaims.forEach(c => {
      const debtor = debtors.find(d => d.id === c.debtor_id);
      const type = debtor?.credit_type || 'Unknown';
      if (!byType[type]) byType[type] = { claimPaid: 0, recovered: 0 };
      byType[type].claimPaid += c.share_tugure_amount || 0;
    });
    paidSubrogations.forEach(s => {
      const claim = claims.find(c => c.id === s.claim_id);
      const debtor = debtors.find(d => d.id === claim?.debtor_id);
      const type = debtor?.credit_type || 'Unknown';
      if (!byType[type]) byType[type] = { claimPaid: 0, recovered: 0 };
      byType[type].recovered += s.recovery_amount || 0;
    });
    const typeData = Object.entries(byType).map(([type, data]) => ({
      type,
      outstanding: data.claimPaid - data.recovered
    }));

    return { 
      totalClaimPaid, 
      totalRecovered, 
      outstanding,
      trend,
      typeData
    };
  };

  // Subrogation Tracking (SETTLEMENT EFFICIENCY)
  const subrogationData = () => {
    const totalAmount = filteredSubrogations.reduce((sum, s) => sum + (s.recovery_amount || 0), 0);
    
    const recovered = filteredSubrogations.filter(s => s.status === 'Paid / Closed');
    const recoveredAmount = recovered.reduce((sum, s) => sum + (s.recovery_amount || 0), 0);
    
    const pending = filteredSubrogations.filter(s => s.status !== 'Paid / Closed');
    const pendingAmount = pending.reduce((sum, s) => sum + (s.recovery_amount || 0), 0);
    
    const recoveryRate = totalAmount > 0 ? (recoveredAmount / totalAmount * 100) : 0;

    // Trend by status over time
    const monthlyData = {};
    filteredSubrogations.forEach(s => {
      const date = s.created_date;
      if (!date) return;
      const key = date.substring(0, 7);
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, Draft: 0, Invoiced: 0, 'Paid / Closed': 0 };
      }
      monthlyData[key][s.status] = (monthlyData[key][s.status] || 0) + (s.recovery_amount || 0);
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    // Distribution by status
    const byStatus = {};
    filteredSubrogations.forEach(s => {
      const status = s.status || 'UNKNOWN';
      byStatus[status] = (byStatus[status] || 0) + (s.recovery_amount || 0);
    });
    const statusData = Object.entries(byStatus).map(([status, amount]) => ({ status, amount }));

    // Distribution by branch
    const byBranch = {};
    recovered.forEach(s => {
      const claim = claims.find(c => c.id === s.claim_id);
      const debtor = debtors.find(d => d.id === claim?.debtor_id);
      const branch = debtor?.branch_desc || 'Unknown';
      byBranch[branch] = (byBranch[branch] || 0) + (s.recovery_amount || 0);
    });
    const branchData = Object.entries(byBranch)
      .map(([branch, amount]) => ({ branch, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      totalAmount,
      recoveredAmount,
      pendingAmount,
      recoveryRate,
      trend,
      statusData,
      branchData
    };
  };

  const exportToPDF = async (tabName) => {
    const element = document.getElementById('report-content');
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${tabName}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = (data, filename) => {
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const lossRatio = lossRatioData();
  const premiumStatus = premiumByStatus();
  const claimPaid = claimPaidData();
  const recovery = outstandingRecovery();
  const subrogation = subrogationData();

  const batchIds = [...new Set(batches.map(b => b.batch_id))].filter(Boolean);
  const branches = [...new Set(debtors.map(d => d.branch_code))].filter(Boolean);
  const years = [...new Set(debtors.map(d => d.batch_year?.toString()))].filter(Boolean);
  const batchStatuses = ['Uploaded', 'Validated', 'Matched', 'Approved', 'Nota Issued', 'Branch Confirmed', 'Paid', 'Closed'];
  const claimStatuses = ['Draft', 'Checked', 'Doc Verified', 'Invoiced', 'Paid'];
  const creditTypes = ['Individual', 'Corporate'];

  const getHeaderActions = () => {
    let excelAction = null;

    switch (activeTab) {
      case 'loss-ratio':
        excelAction = () => exportToExcel(lossRatio.trend, 'loss-ratio');
        break;
      case 'premium-status':
        excelAction = () => exportToExcel(premiumStatus.byStatus, 'premium-status');
        break;
      case 'claim-paid':
        excelAction = () => exportToExcel(claimPaid.statusData, 'claim-paid');
        break;
      case 'subrogation':
        excelAction = () => exportToExcel(subrogation.statusData, 'subrogation');
        break;
      default:
        break;
    }

    return (
      <div className="flex gap-2">
        {excelAction && (
          <Button variant="outline" onClick={excelAction}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
        )}
        <Button variant="outline" onClick={() => exportToPDF(activeTab)}>
          <Download className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" /> 
          Refresh Data
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advanced Reports"
        subtitle="Executive summary and analytics dashboard"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Advanced Reports' }
        ]}
        actions={getHeaderActions()}
      />

      {/* Filter Panel */}
      <Card className="mb-6 border-2 shadow-xl bg-gradient-to-r from-white via-blue-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Batch</label>
              <Select value={filters.batch} onValueChange={(v) => setFilters({...filters, batch: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batchIds.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Period</label>
              <Select value={filters.period} onValueChange={(v) => setFilters({...filters, period: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Batch Status</label>
              <Select value={filters.batchStatus} onValueChange={(v) => setFilters({...filters, batchStatus: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {batchStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Claim Status</label>
              <Select value={filters.claimStatus} onValueChange={(v) => setFilters({...filters, claimStatus: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {claimStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Credit Type</label>
              <Select value={filters.creditType} onValueChange={(v) => setFilters({...filters, creditType: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {creditTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Branch</label>
              <Select value={filters.branch} onValueChange={(v) => setFilters({...filters, branch: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Plafon Range</label>
              <Select value={filters.plafonRange} onValueChange={(v) => setFilters({...filters, plafonRange: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ranges</SelectItem>
                  <SelectItem value="<100M">&lt; 100 Juta</SelectItem>
                  <SelectItem value="100-500M">100 - 500 Juta</SelectItem>
                  <SelectItem value="500M-1B">500 Juta - 1 Milyar</SelectItem>
                  <SelectItem value=">1B">&gt; 1 Milyar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setFilters({ batch: 'all', period: 'all', branch: 'all', plafonRange: 'all', batchStatus: 'all', claimStatus: 'all', creditType: 'all' })} className="bg-white hover:bg-gray-50 text-gray-900 font-semibold">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New Page */}
      <div id="report-content">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="loss-ratio">Loss Ratio</TabsTrigger>
            <TabsTrigger value="premium-status">Premium by  Status</TabsTrigger>
            <TabsTrigger value="claim-paid">Claim Paid</TabsTrigger>
            <TabsTrigger value="outstanding-recovery">OS Recovery</TabsTrigger>
            <TabsTrigger value="subrogation">Subrogation</TabsTrigger>
        </TabsList>

        {/* Loss Ratio */}
        <TabsContent value={"loss-ratio"} className="space-y-6">
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <GradientStatCard
              title="Premium Earned"
              value={`Rp ${(lossRatio.premiumEarned / 1000000).toFixed(1)}M`}
              subtitle="Batch Paid/Closed only"
              icon={DollarSign}
              gradient="from-blue-500 to-indigo-600"
            />
            <GradientStatCard
                title="Claim Paid"
                value={`Rp ${(lossRatio.claimPaid / 1000000).toFixed(1)}M`}
                subtitle="Paid claims only"
                icon={FileText}
                gradient="from-red-500 to-red-600"
            />
            <GradientStatCard
              title="Loss Ratio"
                value={`${lossRatio.lossRatio.toFixed(2)}%`}
                subtitle={lossRatio.lossRatio < 70 ? 'Healthy' : lossRatio.lossRatio < 85 ? 'Warning' : 'Critical'}
                icon={lossRatio.lossRatio < 70 ? TrendingDown : TrendingUp}
                gradient={lossRatio.lossRatio < 70 ? 'from-green-500 to-emerald-600' : lossRatio.lossRatio < 85 ? 'from-yellow-500 to-orange-600' : 'from-red-500 to-red-700'}
            />
            <GradientStatCard
              title="Claim Payment Rate"
                value={`${lossRatio.claimPaymentRate.toFixed(1)}%`}
                subtitle="Claims paid vs invoiced"
                icon={TrendingUp}
                gradient="from-purple-500 to-purple-600"
            />
          </div>
          
          {/* Process Health Summary */}
          <Card className="shadow-lg border-2 bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white border-b-2">
                <CardTitle className="text-white font-bold">📋 Process Health Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border-2 border-green-200">
                    <p className="text-sm text-gray-600">Closed Batches</p>
                    <p className="text-2xl font-bold text-green-700">{lossRatio.closedBatches}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border-2 border-orange-200">
                    <p className="text-sm text-gray-600">Outstanding Batches</p>
                    <p className="text-2xl font-bold text-orange-700">{lossRatio.outstandingBatches}</p>
                  </div>
                </div>
              </CardContent>
          </Card>

          {/* Claim Status Trend */}
          <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-blue-50">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-b-4 border-indigo-700">
                <CardTitle className="text-white font-bold text-xl">📊 Claim Movement by Status Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 bg-gradient-to-br from-slate-50 to-blue-50">
                {loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={lossRatio.trend}>
                      <CartesianGrid strokeDasharray="5 5" stroke="#94A3B8" strokeWidth={2} opacity={0.3} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#000000', fontWeight: 700 }} stroke="#1E293B" strokeWidth={2} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fill: '#000000', fontWeight: 700 }} stroke="#1E293B" strokeWidth={2} />
                      <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '3px solid #3B82F6', borderRadius: '12px', fontWeight: 700 }} />
                      <Legend wrapperStyle={{ fontWeight: 700 }} />
                      <Area type="monotone" dataKey="Draft" stackId="1" stroke="#94a3b8" fill="#94a3b8" name="Draft" />
                      <Area type="monotone" dataKey="Checked" stackId="1" stroke="#60a5fa" fill="#60a5fa" name="Checked" />
                      <Area type="monotone" dataKey="Doc Verified" stackId="1" stroke="#a78bfa" fill="#a78bfa" name="Doc Verified" />
                      <Area type="monotone" dataKey="Invoiced" stackId="1" stroke="#fbbf24" fill="#fbbf24" name="Invoiced" />
                      <Area type="monotone" dataKey="Paid" stackId="1" stroke="#10b981" fill="#10b981" name="Paid" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
          </Card>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-green-50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-b-4 border-emerald-700">
                  <CardTitle className="text-white font-bold text-xl">📈 Loss Ratio by Credit Type</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={lossRatio.creditTypeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                        <XAxis dataKey="type" tick={{ fontSize: 12, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Bar dataKey="lossRatio" fill="#10b981" name="Loss Ratio %" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-orange-50">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-b-4 border-red-700">
                  <CardTitle className="text-white font-bold text-xl">🏢 Top 10 Loss Ratio by Branch</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={lossRatio.branchData} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
                        <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Bar dataKey="lossRatio" fill="#f59e0b" name="Loss Ratio %" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
          </div>
        </TabsContent>

        {/* Premium by Status */}
        <TabsContent value={"premium-status"} className="space-y-6">
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <GradientStatCard
              title="Total Gross Premium"
              value={`Rp ${(premiumStatus.totalGrossPremium / 1000000).toFixed(1)}M`}
              subtitle="All batches"
              icon={DollarSign}
              gradient="from-blue-500 to-indigo-600"
            />
            <GradientStatCard
                title="Net Premium"
                value={`Rp ${(premiumStatus.netPremium / 1000000).toFixed(1)}M`}
                subtitle="After deductions"
                icon={CreditCard}
                gradient="from-green-500 to-emerald-600"
            />
            <GradientStatCard
              title="Paid Premium"
                value={`Rp ${(premiumStatus.paidPremium / 1000000).toFixed(1)}M`}
                subtitle={`${premiumStatus.paidPercentage.toFixed(1)}% of Gross`}
                icon={CheckCircle}
                gradient="from-purple-500 to-purple-600"
            />
            <GradientStatCard
              title="Outstanding Premium"
                value={`Rp ${(premiumStatus.outstandingPremium / 1000000).toFixed(1)}M`}
                subtitle={`${premiumStatus.outstandingPercentage.toFixed(1)}% of Gross`}
                icon={Clock}
                gradient="from-orange-500 to-red-600"
            />
          </div>

                 {/* Process Health Summary */}
            <Card className="shadow-lg border-2 bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white border-b-2">
                <CardTitle className="text-white font-bold">⚠️ Bottleneck Analysis</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                  <p className="text-sm text-gray-600 mb-2">Largest Outstanding Status:</p>
                  <p className="text-2xl font-bold text-orange-700">{premiumStatus.bottleneck.status || 'N/A'}</p>
                  <p className="text-lg font-semibold text-orange-600">Rp {((premiumStatus.bottleneck.amount || 0) / 1000000).toFixed(1)}M</p>
                </div>
              </CardContent>
            </Card>

            {/* Trend Analysis */}
            <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-purple-50">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-b-4 border-pink-700">
                <CardTitle className="text-white font-bold text-xl">📈 Premium by Batch Status Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? <Skeleton className="h-80 w-full" /> : (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={premiumStatus.trend}>
                      <CartesianGrid strokeDasharray="5 5" stroke="#94A3B8" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                      <Legend wrapperStyle={{ fontWeight: 700 }} />
                      <Area type="monotone" dataKey="Uploaded" stackId="1" stroke="#94a3b8" fill="#94a3b8" name="Uploaded" />
                      <Area type="monotone" dataKey="Validated" stackId="1" stroke="#60a5fa" fill="#60a5fa" name="Validated" />
                      <Area type="monotone" dataKey="Matched" stackId="1" stroke="#818cf8" fill="#818cf8" name="Matched" />
                      <Area type="monotone" dataKey="Approved" stackId="1" stroke="#a78bfa" fill="#a78bfa" name="Approved" />
                      <Area type="monotone" dataKey="Nota Issued" stackId="1" stroke="#fbbf24" fill="#fbbf24" name="Nota Issued" />
                      <Area type="monotone" dataKey="Branch Confirmed" stackId="1" stroke="#34d399" fill="#34d399" name="Branch Confirmed" />
                      <Area type="monotone" dataKey="Paid" stackId="1" stroke="#10b981" fill="#10b981" name="Paid" />
                      <Area type="monotone" dataKey="Closed" stackId="1" stroke="#059669" fill="#059669" name="Closed" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-indigo-50">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white border-b-4 border-blue-700">
                  <CardTitle className="text-white font-bold text-xl">📊 Premium by Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-80 w-full" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={premiumStatus.byStatus} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} width={120} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="amount" fill="#6366f1" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-green-50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-b-4 border-emerald-700">
                  <CardTitle className="text-white font-bold text-xl">🏢 Top 10 Premium by Branch</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-80 w-full" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={premiumStatus.branchData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="paid" fill="#10b981" name="Paid" stackId="a" />
                        <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
        </TabsContent>

        {/* Claim Paid */}
        <TabsContent value={"claim-paid"} className="space-y-6">
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <GradientStatCard
              title="Total Claim Paid"
              value={`Rp ${(claimPaid.totalPaid / 1000000).toFixed(1)}M`}
              subtitle="All paid claims"
              icon={FileText}
              gradient="from-red-500 to-red-600"
            />
            <GradientStatCard
                title="Number of Claims Paid"
                value={claimPaid.count}
                subtitle="Total paid claims"
                icon={CheckCircle}
                gradient="from-green-500 to-emerald-600"
            />
            <GradientStatCard
              title="Claims In Progress"
                value={claimPaid.inProgress}
                subtitle="Draft/Checked/Doc Verified"
                icon={Clock}
                gradient="from-orange-500 to-orange-600"
            />
            <GradientStatCard
              title="Avg. Settlement Time"
                value={`${claimPaid.avgSettlementDays} Days`}
                subtitle="For paid claims"
                icon={TrendingUp}
                gradient="from-indigo-500 to-indigo-600"
            />
          </div>

          <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-green-50">
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-b-4 border-emerald-700">
                <CardTitle className="text-white font-bold text-xl">🔄 Claim Lifecycle Movement by Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? <Skeleton className="h-80 w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={claimPaid.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontWeight: 700 }} />
                      <Line type="monotone" dataKey="Draft" stroke="#94a3b8" strokeWidth={3} name="Draft" />
                      <Line type="monotone" dataKey="Checked" stroke="#60a5fa" strokeWidth={3} name="Checked" />
                      <Line type="monotone" dataKey="Doc Verified" stroke="#a78bfa" strokeWidth={3} name="Doc Verified" />
                      <Line type="monotone" dataKey="Invoiced" stroke="#fbbf24" strokeWidth={3} name="Invoiced" />
                      <Line type="monotone" dataKey="Paid" stroke="#10b981" strokeWidth={3} name="Paid" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-blue-50">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-b-4 border-indigo-700">
                  <CardTitle className="text-white font-bold text-xl">📊 Claim Amount by Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={claimPaid.statusData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-green-50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-b-4 border-emerald-700">
                  <CardTitle className="text-white font-bold text-xl">💰 Claim Paid by Product</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={claimPaid.productData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="product" tick={{ fontSize: 12, fontWeight: 700 }} />
                        <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="amount" fill="#10b981" name="Claim Amount" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
        </TabsContent> 

        {/* Outstanding Recovery */}
        <TabsContent value={"outstanding-recovery"} className="space-y-6">
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <GradientStatCard
              title="Total Claim Paid"
              value={`Rp ${(recovery.totalClaimPaid / 1000000).toFixed(1)}M`}
              subtitle="All paid claims"
              icon={FileText}
              gradient="from-red-500 to-red-600"
            />
            <GradientStatCard
                title="Total Recovered"
                value={`Rp ${(recovery.totalRecovered / 1000000).toFixed(1)}M`}
                subtitle="Via subrogation"
                icon={DollarSign}
                gradient="from-green-500 to-emerald-600"
            />
            <GradientStatCard
              title="Outstanding Recovery"
                value={`Rp ${(recovery.outstanding / 1000000).toFixed(1)}M`}
                subtitle="Yet to be recovered"
                icon={Clock}
                gradient="from-orange-500 to-red-600"
            />
            <GradientStatCard
              title="Recovery Rate"
                value={`${((recovery.totalRecovered / recovery.totalClaimPaid) * 100).toFixed(1)}%`}
                subtitle="of claim paid"
                icon={TrendingUp}
                gradient="from-indigo-500 to-indigo-600"
            />
          </div>

          {/* Trend */}
            <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-orange-50">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-b-4 border-red-700">
                <CardTitle className="text-white font-bold text-xl">📈 Outstanding Recovery Trend Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? <Skeleton className="h-80 w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={recovery.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                      <Legend wrapperStyle={{ fontWeight: 700 }} />
                      <Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={4} name="Outstanding" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-red-50">
              <CardHeader className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-b-4 border-pink-700">
                <CardTitle className="text-white font-bold text-xl">🔄 Outstanding Recovery by Credit Type</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? <Skeleton className="h-64 w-full" /> : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={recovery.typeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 12, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                      <Bar dataKey="outstanding" fill="#ef4444" name="Outstanding Recovery" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
        </TabsContent>

        {/* Subrogation */}
        <TabsContent value={"subrogation"} className="space-y-6">
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <GradientStatCard
              title="Total Subrogation Amount"
              value={`Rp ${(subrogation.totalAmount / 1000000).toFixed(1)}M`}
              subtitle="All subrogations"
              icon={FileText}
              gradient="from-blue-500 to-indigo-600"
            />
            <GradientStatCard
                title="Total Recovered Amount"
                value={`Rp ${(subrogation.recoveredAmount / 1000000).toFixed(1)}M`}
                subtitle="Paid / Closed"
                icon={DollarSign}
                gradient="from-green-500 to-emerald-600"
            />
            <GradientStatCard
              title="Pending Amount"
                value={`Rp ${(subrogation.pendingAmount / 1000000).toFixed(1)}M`}
                subtitle="Yet to be recovered"
                icon={Clock}
                gradient="from-orange-500 to-red-600"
            />
            <GradientStatCard
              title="Recovery Rate"
                value={`${subrogation.recoveryRate.toFixed(1)}%`}
                subtitle="of subrogation amount"
                icon={TrendingUp}
                gradient="from-purple-500 to-purple-600"
            />
          </div>
          
          {/* Trend */}
            <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-purple-50">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-b-4 border-indigo-700">
                <CardTitle className="text-white font-bold text-xl">📈 Subrogation Amount by Status Over Time</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? <Skeleton className="h-80 w-full" /> : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={subrogation.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 700 }} />
                      <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                      <Legend wrapperStyle={{ fontWeight: 700 }} />
                      <Area type="monotone" dataKey="Draft" stackId="1" stroke="#fbbf24" fill="#fbbf24" name="Draft" />
                      <Area type="monotone" dataKey="Invoiced" stackId="1" stroke="#60a5fa" fill="#60a5fa" name="Invoiced" />
                      <Area type="monotone" dataKey="Paid / Closed" stackId="1" stroke="#10b981" fill="#10b981" name="Paid / Closed" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-indigo-50">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-b-4 border-purple-700">
                  <CardTitle className="text-white font-bold text-xl">⚖️ Subrogation by Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={subrogation.statusData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-2xl border-3 bg-gradient-to-br from-white to-green-50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-b-4 border-emerald-700">
                  <CardTitle className="text-white font-bold text-xl">🏢 Top 10 Subrogation by Branch</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? <Skeleton className="h-64 w-full" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={subrogation.branchData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} />
                        <Tooltip formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`} />
                        <Bar dataKey="amount" fill="#10b981" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}