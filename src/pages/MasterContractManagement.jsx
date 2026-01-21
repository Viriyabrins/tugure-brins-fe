import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Upload, RefreshCw, CheckCircle2, 
  Eye, Clock, Download, History, AlertCircle, XCircle
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";

export default function MasterContractManagement() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [uploadMode, setUploadMode] = useState('new'); // 'new' or 'revise'
  const [selectedContractForRevision, setSelectedContractForRevision] = useState('');
  const [actionType, setActionType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    contractId: '',
    productType: 'all',
    creditType: 'all',
    startDate: '',
    endDate: ''
  });
  const [selectedContract, setSelectedContract] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
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
      const data = await base44.entities.MasterContract.list();
      setContracts(data || []);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
    setLoading(false);
  };

  const handleUploadExcel = async () => {
    if (!uploadFile) return;
    
    if (uploadMode === 'revise' && !selectedContractForRevision) {
      setErrorMessage('Please select a contract to revise');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    let uploaded = 0;
    let errors = [];
    
    try {
      const text = await uploadFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setErrorMessage('File is empty or invalid format');
        setProcessing(false);
        return;
      }
      
      const headers = lines[0].split(',');

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',');
          if (values.length !== headers.length) {
            errors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          const contractId = values[0]?.trim();
          const policyNumber = values[1]?.trim();
          
          if (!contractId || !policyNumber) {
            errors.push(`Row ${i + 1}: Missing contract_id or policy_number`);
            continue;
          }

          let latestVersion = 0;
          let parentId = null;
          
          if (uploadMode === 'revise') {
            // Revise specific contract
            const existingContracts = await base44.entities.MasterContract.filter({ contract_id: selectedContractForRevision });
            if (existingContracts.length > 0) {
              latestVersion = Math.max(...existingContracts.map(c => c.version || 1));
              const latestContract = existingContracts.find(c => c.version === latestVersion);
              parentId = latestContract.id;
              
              // Archive old version
              await base44.entities.MasterContract.update(parentId, {
                effective_status: 'Archived'
              });
            }
          } else {
            // New contract mode - check if contract_id exists
            const existingContracts = await base44.entities.MasterContract.filter({ contract_id: contractId });
            if (existingContracts.length > 0) {
              errors.push(`Row ${i + 1}: Contract ID ${contractId} already exists. Use revise mode to update.`);
              continue;
            }
          }

          await base44.entities.MasterContract.create({
            contract_id: uploadMode === 'revise' ? selectedContractForRevision : contractId,
            policy_no: policyNumber,
            program_id: values[2]?.trim() || '',
            product_type: values[3]?.trim() || 'Treaty',
            credit_type: values[4]?.trim() || 'Individual',
            loan_type: values[5]?.trim() || '',
            loan_type_desc: values[6]?.trim() || '',
            coverage_start_date: values[7]?.trim(),
            coverage_end_date: values[8]?.trim(),
            max_tenor_month: parseInt(values[9]) || 0,
            max_plafond: parseFloat(values[10]) || 0,
            share_tugure_percentage: parseFloat(values[11]) || 0,
            premium_rate: parseFloat(values[12]) || 0,
            ric_rate: parseFloat(values[13]) || 0,
            bf_rate: parseFloat(values[14]) || 0,
            allowed_kolektabilitas: values[15]?.trim() || '',
            allowed_region: values[16]?.trim() || '',
            currency: values[17]?.trim() || 'IDR',
            remark: values[18]?.trim() || '',
            effective_status: 'Draft',
            version: latestVersion + 1,
            parent_contract_id: parentId,
            effective_date: values[7]?.trim()
          });
          
          uploaded++;
        } catch (rowError) {
          errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      if (errors.length > 0) {
        setErrorMessage(`Uploaded ${uploaded} contracts. ${errors.length} errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
      } else {
        setSuccessMessage(`Successfully uploaded ${uploaded} contract${uploaded > 1 ? 's' : ''}`);
      }
      
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadMode('new');
      setSelectedContractForRevision('');
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage(`Upload failed: ${error.message}`);
    }
    setProcessing(false);
  };

  const handleApproval = async () => {
    if (!selectedContract || !approvalAction) return;

    setProcessing(true);
    try {
      const updates = { rejection_reason: approvalRemarks };

      if (approvalAction === 'FIRST_APPROVE') {
        updates.effective_status = 'Pending Second Approval';
        updates.first_approved_by = user?.email;
        updates.first_approved_date = new Date().toISOString();
      } else if (approvalAction === 'SECOND_APPROVE') {
        updates.effective_status = 'Active';
        updates.second_approved_by = user?.email;
        updates.second_approved_date = new Date().toISOString();
      } else if (approvalAction === 'REJECT') {
        updates.effective_status = 'Inactive';
        updates.rejection_reason = approvalRemarks;
      }

      await base44.entities.MasterContract.update(selectedContract.id, updates);

      await base44.entities.AuditLog.create({
        action: `CONTRACT_${approvalAction}`,
        module: 'CONFIG',
        entity_type: 'MasterContract',
        entity_id: selectedContract.id,
        old_value: JSON.stringify({ status: selectedContract.effective_status }),
        new_value: JSON.stringify({ status: updates.effective_status }),
        user_email: user?.email,
        user_role: user?.role,
        reason: approvalRemarks
      });

      await base44.entities.Notification.create({
        title: `Contract ${approvalAction === 'REJECT' ? 'Rejected' : 'Approved'}`,
        message: `Master Contract ${selectedContract.contract_id} - ${approvalAction === 'FIRST_APPROVE' ? 'First approval completed, awaiting admin approval' : approvalAction === 'SECOND_APPROVE' ? 'Activated and ready for use' : 'Rejected: ' + approvalRemarks}`,
        type: approvalAction === 'REJECT' ? 'WARNING' : 'INFO',
        module: 'CONFIG',
        reference_id: selectedContract.id,
        target_role: approvalAction === 'FIRST_APPROVE' ? 'ADMIN' : 'ALL'
      });

      setSuccessMessage(`Contract ${approvalAction.toLowerCase().replace('_', ' ')} successfully`);
      setShowApprovalDialog(false);
      setSelectedContract(null);
      setApprovalAction('');
      setApprovalRemarks('');
      loadData();
    } catch (error) {
      console.error('Approval error:', error);
    }
    setProcessing(false);
  };

  const getVersionHistory = (contractId) => {
    return contracts.filter(c => 
      c.contract_id === contractId || c.parent_contract_id === contractId
    ).sort((a, b) => (b.version || 1) - (a.version || 1));
  };

  const activeContracts = contracts.filter(c => c.effective_status === 'Active');
  const uniqueContractIds = [...new Set(contracts.map(c => c.contract_id))];

  const stats = {
    total: contracts.length,
    active: activeContracts.length,
    pending: contracts.filter(c => c.effective_status?.includes('Pending')).length,
    draft: contracts.filter(c => c.effective_status === 'Draft').length
  };

  const filteredContracts = contracts.filter(c => {
    if (filters.status !== 'all' && c.effective_status !== filters.status) return false;
    if (filters.contractId && !c.contract_id.includes(filters.contractId)) return false;
    if (filters.productType !== 'all' && c.product_type !== filters.productType) return false;
    if (filters.creditType !== 'all' && c.credit_type !== filters.creditType) return false;
    if (filters.startDate && c.coverage_start_date < filters.startDate) return false;
    if (filters.endDate && c.coverage_end_date > filters.endDate) return false;
    return true;
  });

  const columns = [
    { 
      header: 'Contract ID', 
      accessorKey: 'contract_id',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.contract_id}</div>
          <div className="text-xs text-gray-500">v{row.version || 1}</div>
        </div>
      )
    },
    { header: 'Policy Number', accessorKey: 'policy_no' },
    { header: 'Product Type', accessorKey: 'product_type' },
    { header: 'Credit Type', accessorKey: 'credit_type' },
    { 
      header: 'Coverage Period', 
      cell: (row) => (
        <div className="text-sm">
          {row.coverage_start_date} to {row.coverage_end_date}
        </div>
      )
    },
    { 
      header: 'Max Plafond', 
      cell: (row) => `IDR ${((row.max_plafond || 0) / 1000000).toFixed(1)}M`
    },
    { 
      header: 'Share TUGURE %', 
      cell: (row) => `${row.share_tugure_percentage || 0}%`
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.effective_status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedContract(row);
              setShowVersionDialog(true);
            }}
          >
            <History className="w-4 h-4" />
          </Button>
          
          {isTugure && row.effective_status === 'Draft' && (
            <>
              <Button
                size="sm"
                className="bg-blue-600"
                onClick={() => {
                  setSelectedContract(row);
                  setApprovalAction('FIRST_APPROVE');
                  setShowApprovalDialog(true);
                }}
              >
                1st Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedContract(row);
                  setApprovalAction('REJECT');
                  setShowApprovalDialog(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </>
          )}
          
          {isAdmin && row.effective_status === 'Pending Second Approval' && (
            <>
              <Button
                size="sm"
                className="bg-green-600"
                onClick={() => {
                  setSelectedContract(row);
                  setApprovalAction('SECOND_APPROVE');
                  setShowApprovalDialog(true);
                }}
              >
                2nd Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setSelectedContract(row);
                  setApprovalAction('REJECT');
                  setShowApprovalDialog(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </>
          )}

          {row.effective_status === 'Active' && (
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 hover:text-orange-700"
              onClick={() => {
                setSelectedContract(row);
                setActionType('close');
                setShowActionDialog(true);
              }}
            >
              Close
            </Button>
          )}
          
          {row.effective_status === 'Draft' && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setSelectedContract(row);
                setActionType('invalidate');
                setShowActionDialog(true);
              }}
            >
              Invalidate
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Contract Management"
        subtitle="Manage reinsurance master contracts with approval workflow"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Master Contract Management' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => {
              const csv = [
                ['contract_id', 'policy_no', 'program_id', 'product_type', 'credit_type', 'loan_type', 'loan_type_desc', 'coverage_start_date', 'coverage_end_date', 'max_tenor_month', 'max_plafond', 'share_tugure_percentage', 'premium_rate', 'ric_rate', 'bf_rate', 'allowed_kolektabilitas', 'allowed_region', 'currency', 'remark'].join(','),
                ['MC-001', 'POL-2025-001', 'PRG-001', 'Treaty', 'Individual', 'KPR', 'Kredit Pemilikan Rumah', '2025-01-01', '2030-12-31', '240', '1000000000', '75', '1.0', '0.1', '0.05', '1,2,3', 'DKI Jakarta,Jawa Barat', 'IDR', 'Housing credit treaty'].join(','),
                ['MC-002', 'POL-2025-002', 'PRG-002', 'Treaty', 'Corporate', 'KMK', 'Kredit Modal Kerja', '2025-02-01', '2026-02-01', '12', '1500000000', '80', '1.0', '0.15', '0.08', '1,2', 'Jawa Timur,Jawa Tengah', 'IDR', 'Working capital treaty'].join(',')
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'master_contract_template.csv';
              a.click();
            }}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button onClick={() => setShowUploadDialog(true)} className="bg-blue-600">
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
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

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-wrap">{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Contracts</p>
                <h3 className="text-3xl font-bold">{stats.total}</h3>
                <p className="text-blue-100 text-xs mt-2">All versions</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Active Contracts</p>
                <h3 className="text-3xl font-bold">{stats.active}</h3>
                <p className="text-green-100 text-xs mt-2">{stats.active > 0 ? ((stats.active / stats.total) * 100).toFixed(0) : 0}% of total</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-1">Pending Approval</p>
                <h3 className="text-3xl font-bold">{stats.pending}</h3>
                <p className="text-orange-100 text-xs mt-2">Requires action</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full"></div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-500 to-gray-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 text-sm font-medium mb-1">Draft Status</p>
                <h3 className="text-3xl font-bold">{stats.draft}</h3>
                <p className="text-gray-100 text-xs mt-2">Not yet submitted</p>
              </div>
              <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full"></div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Input
              placeholder="Contract ID..."
              value={filters.contractId}
              onChange={(e) => setFilters({...filters, contractId: e.target.value})}
            />
            <Select value={filters.productType} onValueChange={(val) => setFilters({...filters, productType: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Product Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Product Types</SelectItem>
                <SelectItem value="Treaty">Treaty</SelectItem>
                <SelectItem value="Facultative">Facultative</SelectItem>
                <SelectItem value="Retro">Retro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.creditType} onValueChange={(val) => setFilters({...filters, creditType: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Credit Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Credit Types</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
                <SelectItem value="Corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Pending First Approval">Pending First Approval</SelectItem>
                <SelectItem value="Pending Second Approval">Pending Second Approval</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFilters({ status: 'all', contractId: '', productType: 'all', creditType: 'all', startDate: '', endDate: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table with Version Column */}
      <Card>
        <CardHeader>
          <CardTitle>Master Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredContracts}
            isLoading={loading}
            emptyMessage="No master contracts found"
          />
        </CardContent>
      </Card>

      {/* Contract Action Dialog (Close/Invalidate) */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'close' ? 'Close Contract' : 'Invalidate Contract'}
            </DialogTitle>
            <DialogDescription>
              {selectedContract?.contract_id} - {selectedContract?.policy_number}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert variant={actionType === 'close' ? 'default' : 'destructive'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {actionType === 'close' 
                  ? 'This contract will be marked as Inactive. No new batches can reference it.'
                  : 'This contract will be permanently invalidated and cannot be used.'}
              </AlertDescription>
            </Alert>
            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Enter reason for this action..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowActionDialog(false); setApprovalRemarks(''); }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!approvalRemarks) return;
                setProcessing(true);
                try {
                  const newStatus = actionType === 'close' ? 'Inactive' : 'Archived';
                  await base44.entities.MasterContract.update(selectedContract.id, {
                    effective_status: newStatus,
                    remarks: approvalRemarks
                  });

                  await base44.entities.AuditLog.create({
                    action: `CONTRACT_${actionType.toUpperCase()}`,
                    module: 'CONFIG',
                    entity_type: 'MasterContract',
                    entity_id: selectedContract.id,
                    old_value: JSON.stringify({ status: selectedContract.effective_status }),
                    new_value: JSON.stringify({ status: newStatus }),
                    user_email: user?.email,
                    user_role: user?.role,
                    reason: approvalRemarks
                  });

                  setSuccessMessage(`Contract ${actionType}d successfully`);
                  setShowActionDialog(false);
                  setApprovalRemarks('');
                  loadData();
                } catch (error) {
                  console.error('Action error:', error);
                  setErrorMessage('Failed to process action');
                }
                setProcessing(false);
              }}
              disabled={processing || !approvalRemarks}
              variant={actionType === 'close' ? 'default' : 'destructive'}
            >
              {processing ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Master Contracts</DialogTitle>
            <DialogDescription>Upload or revise contracts via Excel/CSV</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Upload Mode</label>
              <Select value={uploadMode} onValueChange={setUploadMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create New Contracts</SelectItem>
                  <SelectItem value="revise">Revise Existing Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadMode === 'revise' && (
              <div>
                <label className="text-sm font-medium">Select Contract to Revise</label>
                <Select value={selectedContractForRevision} onValueChange={setSelectedContractForRevision}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueContractIds.map(cid => {
                      const latest = contracts.filter(c => c.contract_id === cid).sort((a,b) => (b.version || 1) - (a.version || 1))[0];
                      return (
                        <SelectItem key={cid} value={cid}>
                          {cid} - v{latest.version || 1} ({latest.effective_status})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {selectedContractForRevision && (
                  <Alert className="mt-2 bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                      Will create new version and archive previous
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Upload File</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full mt-1 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Excel or CSV format
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setUploadMode('new');
              setSelectedContractForRevision('');
              setUploadFile(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUploadExcel} 
              disabled={processing || !uploadFile || (uploadMode === 'revise' && !selectedContractForRevision)}
            >
              {processing ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'REJECT' ? 'Reject' : 'Approve'} Contract</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              placeholder="Enter approval/rejection remarks..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button onClick={handleApproval} disabled={processing}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contract Version History</DialogTitle>
            <DialogDescription>{selectedContract?.contract_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedContract && (
              <div className="space-y-4">
                {getVersionHistory(selectedContract.contract_id).map((version, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge>Version {version.version || 1}</Badge>
                            <StatusBadge status={version.effective_status} />
                          </div>
                          <div className="text-sm space-y-1">
                            <p><strong>Policy:</strong> {version.policy_no}</p>
                            <p><strong>Coverage:</strong> {version.coverage_start_date} to {version.coverage_end_date}</p>
                            <p><strong>Max Plafond:</strong> IDR {((version.max_plafond || 0) / 1000000).toFixed(1)}M</p>
                            <p><strong>Share TUGURE:</strong> {version.share_tugure_percentage}%</p>
                            {version.remark && <p><strong>Remarks:</strong> {version.remark}</p>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}