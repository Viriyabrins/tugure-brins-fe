import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, ArrowRight, Loader2, Eye, RefreshCw, 
  Download, CheckCircle2, AlertCircle, Check, X, Clock, DollarSign
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function BatchProcessing() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    status: 'all',
    startDate: '',
    endDate: ''
  });

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
      const [batchData, contractData, debtorData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Contract.list(),
        base44.entities.Debtor.list()
      ]);
      setBatches(batchData || []);
      setContracts(contractData || []);
      setDebtors(debtorData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getNextStatus = (current) => {
    const workflow = {
      'Uploaded': 'Validated',
      'Validated': 'Matched',
      'Matched': 'Approved',
      'Approved': 'Nota Issued',
      'Nota Issued': 'Branch Confirmed',
      'Branch Confirmed': 'Paid',
      'Paid': 'Closed'
    };
    return workflow[current];
  };

  const getActionLabel = (status) => {
    const labels = {
      'Uploaded': 'Validate',
      'Validated': 'Match',
      'Matched': 'Approve',
      'Approved': 'Generate Nota',
      'Nota Issued': 'Confirm',
      'Branch Confirmed': 'Mark Paid',
      'Paid': 'Close'
    };
    return labels[status] || 'Process';
  };

  const getStatusField = (status) => {
    const fields = {
      'Validated': { by: 'validated_by', date: 'validated_date' },
      'Matched': { by: 'matched_by', date: 'matched_date' },
      'Approved': { by: 'approved_by', date: 'approved_date' },
      'Nota Issued': { by: 'nota_issued_by', date: 'nota_issued_date' },
      'Branch Confirmed': { by: 'branch_confirmed_by', date: 'branch_confirmed_date' },
      'Paid': { by: 'paid_by', date: 'paid_date' },
      'Closed': { by: 'closed_by', date: 'closed_date' }
    };
    return fields[status] || { by: 'processed_by', date: 'processed_date' };
  };

  const handleBatchAction = async () => {
    if (!selectedBatch) return;

    setProcessing(true);
    try {
      // Handle Close action separately
      if (actionType === 'close') {
        // Check all debtors and claims reviewed
        const batchDebtors = debtors.filter(d => d.batch_id === selectedBatch.batch_id);
        const batchClaims = await base44.entities.Claim.filter({ debtor_id: { $in: batchDebtors.map(d => d.id) } });
        
        const unreviewed = batchDebtors.filter(d => 
          d.status !== 'APPROVED' && d.status !== 'REJECTED'
        );
        
        const pendingClaims = batchClaims?.filter(c => 
          c.status !== 'Paid' && c.status !== 'Draft'
        ) || [];

        if (unreviewed.length > 0 || pendingClaims.length > 0) {
          alert(`❌ Cannot close batch.\n\n${unreviewed.length > 0 ? `${unreviewed.length} debtors not reviewed\n` : ''}${pendingClaims.length > 0 ? `${pendingClaims.length} claims pending` : ''}`);
          setProcessing(false);
          return;
        }

        await base44.entities.Batch.update(selectedBatch.id, {
          status: 'Closed',
          operational_locked: true,
          closed_by: user?.email,
          closed_date: new Date().toISOString().split('T')[0]
        });

        // Mark debtors as locked
        for (const debtor of batchDebtors) {
          await base44.entities.Debtor.update(debtor.id, {
            is_locked: true
          });
        }

        setSuccessMessage('Batch closed successfully');
        setShowActionDialog(false);
        setSelectedBatch(null);
        loadData();
        setProcessing(false);
        return;
      }

      const nextStatus = getNextStatus(selectedBatch.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      // STAGE 1-4: DATA INGESTION ONLY (Uploaded → Validated → Matched)
      // No financial implications, just data quality checks
      
      // CRITICAL: APPROVED status is set by Debtor Review, not here
      if (nextStatus === 'Approved') {
        alert('❌ BLOCKED: Batch approval is handled automatically.\n\nApproval happens AFTER Debtor Review is completed.\n\nPlease use Debtor Review menu to review and approve/reject debtors.');
        
        await createAuditLog(
          'BLOCKED_MANUAL_BATCH_APPROVAL',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          JSON.stringify({ status: selectedBatch.status }),
          JSON.stringify({ blocked_action: 'Manual Approve', reason: 'Approval must come from Debtor Review completion' }),
          user?.email,
          user?.role,
          'Attempted manual batch approval - use Debtor Review instead'
        );
        
        setProcessing(false);
        setShowActionDialog(false);
        return;
      }
      
      // CRITICAL FIX: Check if Debtor Review completed for Approved batches before Nota generation
      if (nextStatus === 'Nota Issued') {
        if (!selectedBatch.debtor_review_completed || !selectedBatch.batch_ready_for_nota) {
          await createAuditLog(
            'BLOCKED_NOTA_GENERATION',
            'DEBTOR',
            'Batch',
            selectedBatch.id,
            JSON.stringify({ status: selectedBatch.status }),
            JSON.stringify({ blocked_action: 'Generate Nota', reason: 'Debtor Review not completed' }),
            user?.email,
            user?.role,
            'Attempted to generate Nota before Debtor Review completion'
          );
          
          alert('❌ BLOCKED: Debtor Review must be completed first.\n\nPlease go to Debtor Review menu to approve/reject debtors before generating Nota.');
          setProcessing(false);
          setShowActionDialog(false);
          return;
        }
      }

      const statusField = getStatusField(nextStatus);
      const updateData = {
        status: nextStatus,
        [statusField.by]: user?.email,
        [statusField.date]: new Date().toISOString().split('T')[0]
      };

      await base44.entities.Batch.update(selectedBatch.id, updateData);



      // Generate Nota when moving to Nota Issued (ONLY IF batch_ready_for_nota = TRUE)
      if (nextStatus === 'Nota Issued') {
        // Use FINAL amounts from Debtor Review
        const notaNumber = `NOTA-${selectedBatch.batch_id}-${Date.now()}`;
        await base44.entities.Nota.create({
          nota_number: notaNumber,
          nota_type: 'Batch',
          reference_id: selectedBatch.batch_id,
          contract_id: selectedBatch.contract_id,
          amount: selectedBatch.final_premium_amount || 0,
          currency: 'IDR',
          status: 'Draft',
          is_immutable: false,
          total_actual_paid: 0,
          reconciliation_status: 'PENDING'
        });

        // Create Invoice
        const invoiceNumber = `INV-${selectedBatch.batch_id}-${Date.now()}`;
        await base44.entities.Invoice.create({
          invoice_number: invoiceNumber,
          contract_id: selectedBatch.contract_id,
          period: `${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`,
          total_amount: selectedBatch.final_premium_amount || 0,
          outstanding_amount: selectedBatch.final_premium_amount || 0,
          currency: 'IDR',
          status: 'ISSUED'
        });

        // Update APPROVED debtors only with invoice reference
        const approvedDebtors = debtors.filter(d => 
          d.batch_id === selectedBatch.batch_id && 
          d.status === 'APPROVED'
        );
        
        await createAuditLog(
          'NOTA_GENERATED_FROM_FINAL',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          JSON.stringify({}),
          JSON.stringify({ nota_number: notaNumber, amount: selectedBatch.final_premium_amount, source: 'Debtor Review Final Amounts' }),
          user?.email,
          user?.role,
          `Nota generated with final premium: Rp ${(selectedBatch.final_premium_amount || 0).toLocaleString()}`
        );
      }

      const targetRole = nextStatus === 'Nota Issued' ? 'BRINS' :
                        nextStatus === 'Branch Confirmed' ? 'TUGURE' : 'ALL';

      // Use FINAL amounts for email if after Debtor Review
      const exposureAmount = selectedBatch.final_exposure_amount || selectedBatch.total_exposure || 0;
      const premiumAmount = selectedBatch.final_premium_amount || selectedBatch.total_premium || 0;

      await sendTemplatedEmail(
        'Batch',
        selectedBatch.status,
        nextStatus,
        targetRole,
        'notify_batch_status',
        {
          batch_id: selectedBatch.batch_id,
          total_records: selectedBatch.total_records,
          total_exposure: `Rp ${exposureAmount.toLocaleString('id-ID')}`,
          total_premium: `Rp ${premiumAmount.toLocaleString('id-ID')}`,
          user_name: user?.email,
          date: new Date().toLocaleDateString('id-ID')
        }
      );

      await createNotification(
        `Batch ${nextStatus}`,
        `Batch ${selectedBatch.batch_id} moved to ${nextStatus}`,
        'INFO',
        'DEBTOR',
        selectedBatch.id,
        targetRole
      );

      await createAuditLog(
        `BATCH_${nextStatus.toUpperCase().replace(' ', '_')}`,
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        JSON.stringify({ status: selectedBatch.status }),
        JSON.stringify({ status: nextStatus }),
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Batch processed to ${nextStatus} successfully`);
      setShowActionDialog(false);
      setSelectedBatch(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const handleBulkAction = async () => {
    if (selectedBatches.length === 0) return;

    setProcessing(true);
    try {
      const batchesToProcess = batches.filter(b => selectedBatches.includes(b.id));
      
      for (const batch of batchesToProcess) {
        const nextStatus = getNextStatus(batch.status);
        if (!nextStatus) continue;

        const statusField = getStatusField(nextStatus);
        await base44.entities.Batch.update(batch.id, {
          status: nextStatus,
          [statusField.by]: user?.email,
          [statusField.date]: new Date().toISOString().split('T')[0]
        });

        await createAuditLog(
          `BATCH_BULK_${nextStatus.toUpperCase().replace(' ', '_')}`,
          'DEBTOR',
          'Batch',
          batch.id,
          JSON.stringify({ status: batch.status }),
          JSON.stringify({ status: nextStatus }),
          user?.email,
          user?.role,
          'Bulk operation'
        );
      }

      setSuccessMessage(`${batchesToProcess.length} batches processed successfully`);
      setShowBulkDialog(false);
      setSelectedBatches([]);
      loadData();
    } catch (error) {
      console.error('Bulk action error:', error);
    }
    setProcessing(false);
  };

  const handleRejectBatch = async () => {
    if (!selectedBatch || !remarks) return;

    setProcessing(true);
    try {
      await base44.entities.Batch.update(selectedBatch.id, {
        status: 'Rejected',
        rejection_reason: remarks
      });

      await createNotification(
        'Batch Rejected',
        `Batch ${selectedBatch.batch_id} rejected: ${remarks}`,
        'WARNING',
        'DEBTOR',
        selectedBatch.id,
        'BRINS'
      );

      await createAuditLog(
        'BATCH_REJECTED',
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        JSON.stringify({ status: selectedBatch.status }),
        JSON.stringify({ status: 'Rejected', reason: remarks }),
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage('Batch rejected - BRINS can revise and resubmit');
      setShowRejectDialog(false);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Reject error:', error);
    }
    setProcessing(false);
  };

  const toggleBatchSelection = (batchId) => {
    if (selectedBatches.includes(batchId)) {
      setSelectedBatches(selectedBatches.filter(id => id !== batchId));
    } else {
      setSelectedBatches([...selectedBatches, batchId]);
    }
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    if (filters.startDate && b.created_date < filters.startDate) return false;
    if (filters.endDate && b.created_date > filters.endDate) return false;
    return true;
  });

  const columns = [
    {
      header: (
        <Checkbox
          checked={selectedBatches.length === filteredBatches.length && filteredBatches.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedBatches(filteredBatches.map(b => b.id));
            } else {
              setSelectedBatches([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedBatches.includes(row.id)}
          onCheckedChange={() => toggleBatchSelection(row.id)}
        />
      ),
      width: '40px'
    },
    {
      header: 'Batch ID',
      cell: (row) => (
        <div>
          <p className="font-medium font-mono">{row.batch_id}</p>
          <p className="text-xs text-gray-500">{row.batch_month}/{row.batch_year} • v{row.version || 1}</p>
        </div>
      )
    },
    { header: 'Records', accessorKey: 'total_records' },
    { 
      header: 'Raw / Final Exposure', 
      cell: (row) => (
        <div>
          <div className="text-sm">Rp {((row.total_exposure || 0) / 1000000).toFixed(1)}M</div>
          {row.final_exposure_amount > 0 && (
            <div className="text-xs text-green-600 font-bold">Final: Rp {((row.final_exposure_amount || 0) / 1000000).toFixed(1)}M</div>
          )}
        </div>
      )
    },
    { 
      header: 'Raw / Final Premium', 
      cell: (row) => (
        <div>
          <div className="text-sm">Rp {((row.total_premium || 0) / 1000000).toFixed(1)}M</div>
          {row.final_premium_amount > 0 && (
            <div className="text-xs text-green-600 font-bold">Final: Rp {((row.final_premium_amount || 0) / 1000000).toFixed(1)}M</div>
          )}
        </div>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge status={row.status} />
          {row.batch_ready_for_nota && (
            <div className="text-xs text-green-600 font-semibold">✓ Ready for Nota</div>
          )}
        </div>
      )
    },
    {
      header: 'Processed By',
      cell: (row) => {
        const field = getStatusField(row.status);
        return row[field.by] ? (
          <div className="text-xs">
            <p>{row[field.by]}</p>
            <p className="text-gray-500">{row[field.date]}</p>
          </div>
        ) : '-';
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedBatch(row);
              setShowViewDialog(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'Closed' && row.status !== 'Rejected' && getNextStatus(row.status) && (
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedBatch(row);
                setActionType(getActionLabel(row.status));
                setShowActionDialog(true);
              }}
              disabled={row.status === 'Approved' && (!row.debtor_review_completed || !row.batch_ready_for_nota)}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              {getActionLabel(row.status)}
            </Button>
          )}
          {row.status === 'Matched' && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => {
                setSelectedBatch(row);
                setShowRejectDialog(true);
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
          )}
          {row.status === 'Paid' && (
            <Button 
              size="sm" 
              className="bg-gray-600"
              onClick={() => {
                setSelectedBatch(row);
                setActionType('close');
                setShowActionDialog(true);
              }}
            >
              Close Batch
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Processing"
        subtitle="Process batch submissions through workflow"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Batch Processing' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedBatches.length > 0 && (
              <Button 
                className="bg-blue-600"
                onClick={() => setShowBulkDialog(true)}
              >
                <Check className="w-4 h-4 mr-2" />
                Process ({selectedBatches.length})
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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <ModernKPI title="Total Batches" value={batches.length} subtitle="All submissions" icon={FileText} color="blue" />
        <ModernKPI title="Validated" value={batches.filter(b => b.status === 'Validated').length} subtitle="In processing" icon={CheckCircle2} color="teal" />
        <ModernKPI title="Approved" value={batches.filter(b => b.status === 'Approved').length} subtitle="Ready for nota" icon={CheckCircle2} color="green" />
        <ModernKPI title="Paid" value={batches.filter(b => b.status === 'Paid').length} subtitle="Payment completed" icon={DollarSign} color="purple" />
        <ModernKPI title="Rejected" value={batches.filter(b => b.status === 'Rejected').length} subtitle="Requires revision" icon={AlertCircle} color="red" />
      </div>



      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-600">Filter Batches</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Contract</label>
              <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
                <SelectTrigger><SelectValue placeholder="All Contracts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Batch ID</label>
              <Input placeholder="Search batch..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
              <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Uploaded">Uploaded</SelectItem>
                  <SelectItem value="Validated">Validated</SelectItem>
                  <SelectItem value="Matched">Matched</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
              <Input type="date" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
              <Input type="date" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFilters({contract: 'all', batch: '', status: 'all', startDate: '', endDate: ''})}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={filteredBatches} isLoading={loading} />

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} Batch</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button onClick={handleBatchAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Batch</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Rejecting batch allows BRINS to revise and resubmit. All debtors will be marked inactive.
              </AlertDescription>
            </Alert>
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter reason..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRemarks(''); }}>Cancel</Button>
            <Button onClick={handleRejectBatch} disabled={processing || !remarks} variant="destructive">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Reject Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process {selectedBatches.length} Batches</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                All selected batches will be moved to their next workflow status
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Records:</span><span className="ml-2 font-medium">{selectedBatch?.total_records}</span></div>
              <div><span className="text-gray-500">Exposure:</span><span className="ml-2 font-medium">Rp {(selectedBatch?.total_exposure || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Premium:</span><span className="ml-2 font-medium">Rp {(selectedBatch?.total_premium || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedBatch?.status} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}