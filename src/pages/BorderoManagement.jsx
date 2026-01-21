import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Clock, Eye, Download, 
  Filter, RefreshCw, Check, X, AlertCircle, Loader2, ArrowRight, DollarSign
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { Label } from "@/components/ui/label";

export default function BorderoManagement() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('debtors');
  const [debtors, setDebtors] = useState([]);
  const [borderos, setBorderos] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionType, setActionType] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    reconStatus: 'all',
    claimStatus: 'all',
    subrogationStatus: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = () => {
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        setUser(JSON.parse(demoUserStr));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, borderoData, contractData, claimData, subrogationData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Bordero.list(),
        base44.entities.Contract.list(),
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list()
      ]);
      setDebtors(debtorData || []);
      setBorderos(borderoData || []);
      setContracts(contractData || []);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      contract: 'all',
      batch: '',
      submitStatus: 'all',
      reconStatus: 'all',
      claimStatus: 'all',
      subrogationStatus: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const openDetailDialog = (item) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
  };

  const getNextBorderoStatus = (currentStatus) => {
    const workflow = ['GENERATED', 'UNDER_REVIEW', 'FINAL'];
    const idx = workflow.indexOf(currentStatus);
    return idx >= 0 && idx < workflow.length - 1 ? workflow[idx + 1] : null;
  };

  const handleBorderoAction = async () => {
    if (!selectedItem) return;
    
    setProcessing(true);
    try {
      const nextStatus = getNextBorderoStatus(selectedItem.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      const updateData = {
        status: nextStatus,
        [nextStatus === 'UNDER_REVIEW' ? 'reviewed_by' : 'finalized_by']: user?.email,
        [nextStatus === 'UNDER_REVIEW' ? 'reviewed_date' : 'finalized_date']: new Date().toISOString().split('T')[0]
      };

      await base44.entities.Bordero.update(selectedItem.id, updateData);

      // Update all debtors in this bordero
      const borderoDebtors = await base44.entities.Debtor.filter({ 
        contract_id: selectedItem.contract_id,
        batch_id: selectedItem.batch_id
      });
      
      for (const debtor of borderoDebtors) {
        await base44.entities.Debtor.update(debtor.id, {
          bordero_status: nextStatus
        });
      }

      setSuccessMessage(`Bordero ${selectedItem.bordero_id} moved to ${nextStatus}`);
      setShowActionDialog(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Bordero action error:', error);
    }
    setProcessing(false);
  };

  const handleExport = (format) => {
    console.log('Export to:', format);
    // Export functionality
  };

  // Filter per tab based on workflow status
  const getTabDebtors = () => {
    let filtered = debtors.filter(d => {
      if (filters.contract !== 'all' && d.contract_id !== filters.contract) return false;
      if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
      if (filters.submitStatus !== 'all' && d.status !== filters.submitStatus) return false;
      if (filters.startDate && d.created_date < filters.startDate) return false;
      if (filters.endDate && d.created_date > filters.endDate) return false;
      return true;
    });

    // Apply tab-specific filters
    if (activeTab === 'debtors') {
      // All approved debtors
      return filtered.filter(d => d.status === 'APPROVED');
    } else if (activeTab === 'exposure') {
      // Only approved
      return filtered.filter(d => d.status === 'APPROVED');
    } else if (activeTab === 'borderos') {
      // Handled separately
      return filtered;
    }
    return filtered;
  };

  const filteredDebtors = getTabDebtors();

  const filteredClaims = claims.filter(c => {
    if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
    if (filters.startDate && c.created_date < filters.startDate) return false;
    if (filters.endDate && c.created_date > filters.endDate) return false;
    return true;
  });

  const filteredSubrogations = subrogations.filter(s => {
    if (filters.subrogationStatus !== 'all' && s.status !== filters.subrogationStatus) return false;
    if (filters.startDate && s.created_date < filters.startDate) return false;
    if (filters.endDate && s.created_date > filters.endDate) return false;
    return true;
  });

  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const debtorColumns = [
    {
      header: (
        <Checkbox
          checked={selectedItems.length === filteredDebtors.length && filteredDebtors.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedItems(filteredDebtors.map(d => d.id));
            } else {
              setSelectedItems([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedItems.includes(row.id)}
          onCheckedChange={() => toggleItemSelection(row.id)}
        />
      ),
      width: '40px'
    },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.nama_peserta}</p>
          <p className="text-sm text-gray-500">{row.nomor_peserta}</p>
        </div>
      )
    },
    { header: 'Batch', accessorKey: 'batch_id', cell: (row) => <span className="font-mono text-sm">{row.batch_id}</span> },
    { header: 'Plafond', cell: (row) => `Rp ${(row.plafon || 0).toLocaleString('id-ID')}` },
    { header: 'Net Premi', cell: (row) => `Rp ${(row.net_premi || 0).toLocaleString('id-ID')}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openDetailDialog(row)}>
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
      )
    }
  ];

  const borderoColumns = [
    {
      header: (
        <Checkbox
          checked={selectedItems.length === borderos.length && borderos.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedItems(borderos.map(b => b.id));
            } else {
              setSelectedItems([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedItems.includes(row.id)}
          onCheckedChange={() => toggleItemSelection(row.id)}
        />
      ),
      width: '40px'
    },
    { header: 'Bordero ID', accessorKey: 'bordero_id' },
    { header: 'Period', accessorKey: 'period' },
    { header: 'Total Debtors', accessorKey: 'total_debtors' },
    { header: 'Total Exposure', cell: (row) => `Rp ${(row.total_exposure || 0).toLocaleString('id-ID')}` },
    { header: 'Total Premium', cell: (row) => `Rp ${(row.total_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openDetailDialog(row)}>
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          {row.status !== 'FINAL' && getNextBorderoStatus(row.status) && (
            <Button 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedItem(row);
                setActionType(getNextBorderoStatus(row.status));
                setShowActionDialog(true);
              }}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              {getNextBorderoStatus(row.status)}
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bordero Management"
        subtitle="View debtors, exposure, bordero, claims, and process status"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Bordero Management' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              className="bg-green-600 hover:bg-green-700 text-white" 
              onClick={() => {
                let data = [];
                let headers = [];
                let sourceData = [];
                
                if (activeTab === 'debtors') {
                  sourceData = selectedItems.length > 0 
                    ? filteredDebtors.filter(d => selectedItems.includes(d.id))
                    : filteredDebtors;
                  headers = ['Debtor', 'Batch', 'Plafond', 'Net Premi', 'Status'];
                  data = sourceData.map(d => [d.nama_peserta, d.batch_id, d.plafon, d.net_premi, d.status]);
                } else if (activeTab === 'borderos') {
                  sourceData = selectedItems.length > 0 
                    ? borderos.filter(b => selectedItems.includes(b.id))
                    : borderos;
                  headers = ['Bordero ID', 'Period', 'Total Debtors', 'Total Exposure', 'Total Premium', 'Status'];
                  data = sourceData.map(b => [b.bordero_id, b.period, b.total_debtors, b.total_exposure, b.total_premium, b.status]);
                } else if (activeTab === 'claims') {
                  sourceData = filteredClaims;
                  headers = ['Claim No', 'Debtor', 'DOL', 'Claim Amount', 'Status'];
                  data = sourceData.map(c => [c.claim_no, c.nama_tertanggung, c.dol, c.nilai_klaim, c.claim_status]);
                } else if (activeTab === 'subrogation') {
                  sourceData = filteredSubrogations;
                  headers = ['Subrogation ID', 'Claim ID', 'Recovery Amount', 'Recovery Date', 'Status'];
                  data = sourceData.map(s => [s.subrogation_id, s.claim_id, s.recovery_amount, s.recovery_date, s.status]);
                }
                
                const csv = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bordero-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
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

      {/* Bordero Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Bordero to {actionType}</DialogTitle>
            <DialogDescription>
              Update bordero {selectedItem?.bordero_id} status from {selectedItem?.status} to {actionType}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Period:</span>
                <span className="font-medium">{selectedItem?.period}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Debtors:</span>
                <span className="font-medium">{selectedItem?.total_debtors}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Premium:</span>
                <span className="font-medium">Rp {(selectedItem?.total_premium || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleBorderoAction}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Debtors</p>
                <h3 className="text-3xl font-bold">{debtors.filter(d => d.status === 'APPROVED').length}</h3>
                <p className="text-blue-100 text-xs mt-2">Approved only</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-1">Borderos</p>
                <h3 className="text-3xl font-bold">{borderos.length}</h3>
                <p className="text-purple-100 text-xs mt-2">Generated</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Total Premium</p>
                <h3 className="text-2xl font-bold">
                  {((debtors.reduce((sum, d) => sum + (d.net_premi || 0), 0)) / 1000000000).toFixed(2)}B
                </h3>
                <p className="text-green-100 text-xs mt-2">IDR</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-1">Total Claims</p>
                <h3 className="text-3xl font-bold">{claims.length}</h3>
                <p className="text-orange-100 text-xs mt-2">All statuses</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium mb-1">Subrogations</p>
                <h3 className="text-3xl font-bold">{subrogations.length}</h3>
                <p className="text-teal-100 text-xs mt-2">Recovery cases</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-tl-full"></div>
        </Card>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        contracts={contracts}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="debtors">
            <FileText className="w-4 h-4 mr-2" />
            Debtors ({filteredDebtors.length})
          </TabsTrigger>
          <TabsTrigger value="exposure">
            <FileText className="w-4 h-4 mr-2" />
            Exposure Data
          </TabsTrigger>
          <TabsTrigger value="borderos">
            <FileText className="w-4 h-4 mr-2" />
            Borderos ({borderos.length})
          </TabsTrigger>
          <TabsTrigger value="claims">
            <FileText className="w-4 h-4 mr-2" />
            Claims ({filteredClaims.length})
          </TabsTrigger>
          <TabsTrigger value="subrogation">
            <FileText className="w-4 h-4 mr-2" />
            Subrogation ({filteredSubrogations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debtors" className="mt-4">
          <DataTable
            columns={debtorColumns}
            data={filteredDebtors}
            isLoading={loading}
            emptyMessage="No debtors found"
          />
        </TabsContent>

        <TabsContent value="exposure" className="mt-4">
          <DataTable
            columns={[
              { header: 'Debtor', cell: (row) => row.nama_peserta },
              { header: 'Plafond', cell: (row) => `Rp ${(row.plafon || 0).toLocaleString('id-ID')}` },
              { header: 'Net Premi', cell: (row) => `Rp ${(row.net_premi || 0).toLocaleString('id-ID')}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={filteredDebtors.filter(d => d.status === 'APPROVED')}
            isLoading={loading}
            emptyMessage="No exposure data"
          />
        </TabsContent>

        <TabsContent value="borderos" className="mt-4">
          {borderos.length === 0 ? (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                No borderos yet. Borderos are auto-generated when a Batch reaches "Approved" status in Batch Processing.
              </AlertDescription>
            </Alert>
          ) : null}
          <DataTable
            columns={borderoColumns}
            data={borderos}
            isLoading={loading}
            emptyMessage="No borderos generated yet"
          />
        </TabsContent>

        <TabsContent value="claims" className="mt-4">
          <DataTable
            columns={[
              { header: 'Claim No', accessorKey: 'claim_no' },
              { header: 'Debtor', cell: (row) => row.nama_tertanggung },
              { header: 'Policy No', accessorKey: 'policy_no' },
              { header: 'DOL', accessorKey: 'dol' },
              { header: 'Claim Amount', cell: (row) => `IDR ${(row.nilai_klaim || 0).toLocaleString()}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.claim_status} /> },
              { header: 'Actions', cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> }
            ]}
            data={filteredClaims}
            isLoading={loading}
            emptyMessage="No claims found"
          />
        </TabsContent>

        <TabsContent value="subrogation" className="mt-4">
          <DataTable
            columns={[
              { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
              { header: 'Claim ID', accessorKey: 'claim_id' },
              { header: 'Debtor ID', accessorKey: 'debtor_id' },
              { header: 'Recovery Amount', cell: (row) => `IDR ${(row.recovery_amount || 0).toLocaleString()}` },
              { header: 'Recovery Date', accessorKey: 'recovery_date' },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              { header: 'Actions', cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> }
            ]}
            data={filteredSubrogations}
            isLoading={loading}
            emptyMessage="No subrogation records found"
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'debtors' && 'Debtor Detail'}
              {activeTab === 'borderos' && 'Bordero Detail'}
              {activeTab === 'claims' && 'Claim Detail'}
              {activeTab === 'subrogations' && 'Subrogation Detail'}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {activeTab === 'debtors' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-gray-500">Nama Peserta</Label><p className="font-medium">{selectedItem.nama_peserta}</p></div>
                  <div><Label className="text-gray-500">Batch ID</Label><p className="font-medium">{selectedItem.batch_id}</p></div>
                  <div><Label className="text-gray-500">Plafond</Label><p className="font-medium">Rp {(selectedItem.plafon || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Nominal Premi</Label><p className="font-medium">Rp {(selectedItem.nominal_premi || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Net Premi</Label><p className="font-medium">Rp {(selectedItem.net_premi || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Status</Label><StatusBadge status={selectedItem.status} /></div>
                </div>
              )}
              {activeTab === 'borderos' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-gray-500">Bordero ID</Label><p className="font-medium">{selectedItem.bordero_id}</p></div>
                  <div><Label className="text-gray-500">Period</Label><p className="font-medium">{selectedItem.period}</p></div>
                  <div><Label className="text-gray-500">Total Debtors</Label><p className="font-medium">{selectedItem.total_debtors}</p></div>
                  <div><Label className="text-gray-500">Total Exposure</Label><p className="font-medium">IDR {(selectedItem.total_exposure || 0).toLocaleString()}</p></div>
                  <div><Label className="text-gray-500">Total Premium</Label><p className="font-medium">IDR {(selectedItem.total_premium || 0).toLocaleString()}</p></div>
                  <div><Label className="text-gray-500">Status</Label><StatusBadge status={selectedItem.status} /></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}