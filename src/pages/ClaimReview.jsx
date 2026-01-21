import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Eye, RefreshCw, Check, X, 
  Loader2, AlertCircle, DollarSign, Plus
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function ClaimReview() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [notas, setNotas] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('review');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    claimStatus: 'all',
    subrogationStatus: 'all'
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
      const [claimData, subrogationData, notaData, contractData] = await Promise.all([
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list(),
        base44.entities.Nota.list(),
        base44.entities.Contract.list()
      ]);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
      setNotas(notaData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleClaimAction = async () => {
    if (!selectedClaim || !actionType) return;

    // CRITICAL: Block claim approval if Nota payment not completed
    if (actionType === 'check' || actionType === 'verify') {
      // Find related debtor via claim
      const relatedDebtor = selectedClaim.debtor_id ? 
        await base44.entities.Debtor.filter({ id: selectedClaim.debtor_id }) : [];
      if (relatedDebtor.length > 0) {
        const batchId = relatedDebtor[0].batch_id;
        const batchNotas = await base44.entities.Nota.filter({ 
          reference_id: batchId,
          nota_type: 'Batch'
        });

        const hasCompletedPayment = batchNotas.some(n => n.status === 'Paid');

        if (!hasCompletedPayment) {
          setErrorMessage(`❌ BLOCKED: Claim review not allowed.\n\nClaim Review may proceed ONLY IF nota_payment_status = PAID.\n\nCurrent Nota status: ${batchNotas[0]?.status || 'No Nota found'}`);
          
          await base44.entities.AuditLog.create({
            action: 'BLOCKED_CLAIM_REVIEW',
            module: 'CLAIM',
            entity_type: 'Claim',
            entity_id: selectedClaim.id,
            old_value: {},
            new_value: { blocked_reason: 'Nota payment not completed' },
            user_email: user?.email,
            user_role: user?.role,
            reason: 'Attempted claim review before Nota payment'
          });

          setProcessing(false);
          return;
        }
      }
    }

    setProcessing(true);
    setErrorMessage('');
    
    try {
      let newStatus = '';
      let updateData = {
        reviewed_by: user?.email,
        review_date: new Date().toISOString().split('T')[0]
      };

      switch (actionType) {
        case 'check':
          newStatus = 'Checked';
          updateData.status = 'Checked';
          updateData.checked_by = user?.email;
          updateData.checked_date = new Date().toISOString().split('T')[0];
          break;
        case 'verify':
          newStatus = 'Doc Verified';
          updateData.status = 'Doc Verified';
          updateData.doc_verified_by = user?.email;
          updateData.doc_verified_date = new Date().toISOString().split('T')[0];
          break;
        case 'invoice':
          newStatus = 'Invoiced';
          updateData.status = 'Invoiced';
          updateData.invoiced_by = user?.email;
          updateData.invoiced_date = new Date().toISOString().split('T')[0];
          
          // Create Claim Nota (IMMUTABLE AFTER ISSUED)
          const notaNumber = `NOTA-CLM-${selectedClaim.claim_no}-${Date.now()}`;
          await base44.entities.Nota.create({
            nota_number: notaNumber,
            nota_type: 'Claim',
            reference_id: selectedClaim.claim_no,
            contract_id: selectedClaim.contract_id,
            amount: selectedClaim.share_tugure_amount || selectedClaim.nilai_klaim || 0,
            currency: 'IDR',
            status: 'Draft',
            is_immutable: false,
            total_actual_paid: 0,
            reconciliation_status: 'PENDING'
          });
          
          await createNotification(
            'Claim Nota Generated',
            `Nota ${notaNumber} created for Claim ${selectedClaim.claim_no}. Amount: Rp ${((selectedClaim.share_tugure_amount || selectedClaim.nilai_klaim || 0)).toLocaleString()}. Process in Nota Management.`,
            'ACTION_REQUIRED',
            'CLAIM',
            selectedClaim.id,
            'TUGURE'
          );
          break;
        case 'reject':
          newStatus = 'Draft';
          updateData.status = 'Draft';
          updateData.rejection_reason = remarks;
          break;
      }

      await base44.entities.Claim.update(selectedClaim.id, updateData);

      await createNotification(
        `Claim ${newStatus}`,
        `Claim ${selectedClaim.claim_no} moved to ${newStatus}`,
        'INFO',
        'CLAIM',
        selectedClaim.id,
        'BRINS'
      );

      await createAuditLog(
        `CLAIM_${actionType.toUpperCase()}`,
        'CLAIM',
        'Claim',
        selectedClaim.id,
        JSON.stringify({ status: selectedClaim.status }),
        JSON.stringify({ status: newStatus }),
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Claim ${actionType}ed successfully${actionType === 'invoice' ? ' - Nota created' : ''}`);
      setShowActionDialog(false);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
      setErrorMessage('Failed to process claim');
    }
    setProcessing(false);
  };

  const pendingClaims = claims.filter(c => c.status === 'Draft' || c.status === 'Checked');

  const toggleClaimSelection = (claimId) => {
    setSelectedClaims(prev => 
      prev.includes(claimId) ? prev.filter(id => id !== claimId) : [...prev, claimId]
    );
  };

  const claimColumns = [
    {
      header: (
        <Checkbox
          checked={selectedClaims.length === claims.length && claims.length > 0}
          onCheckedChange={(checked) => {
            setSelectedClaims(checked ? claims.map(c => c.id) : []);
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedClaims.includes(row.id)}
          onCheckedChange={() => toggleClaimSelection(row.id)}
        />
      ),
      width: '50px'
    },
    { header: 'Claim No', accessorKey: 'claim_no' },
    { header: 'Debtor', accessorKey: 'nama_tertanggung' },
    { header: 'Claim Amount', cell: (row) => `Rp ${(row.nilai_klaim || 0).toLocaleString('id-ID')}` },
    { header: 'Share Tugure', cell: (row) => `Rp ${(row.share_tugure_amount || 0).toLocaleString('id-ID')}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedClaim(row); setShowViewDialog(true); }}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'Draft' && (
            <>
              <Button size="sm" className="bg-blue-600" onClick={() => { setSelectedClaim(row); setActionType('check'); setShowActionDialog(true); }}>
                Check
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setSelectedClaim(row); setActionType('reject'); setShowActionDialog(true); }}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          {row.status === 'Checked' && (
            <Button size="sm" className="bg-green-600" onClick={() => { setSelectedClaim(row); setActionType('verify'); setShowActionDialog(true); }}>
              Verify Docs
            </Button>
          )}
          {row.status === 'Doc Verified' && (
            <Button size="sm" className="bg-purple-600" onClick={() => { setSelectedClaim(row); setActionType('invoice'); setShowActionDialog(true); }}>
              Issue Nota
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Review"
        subtitle="Review and process claims - generates Claim Nota"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Claim Review' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedClaims.length > 0 && (
              <>
                <Button className="bg-green-600" onClick={async () => {
                  setProcessing(true);
                  for (const claimId of selectedClaims) {
                    const claim = claims.find(c => c.id === claimId);
                    if (claim?.status === 'Draft') {
                      await base44.entities.Claim.update(claimId, {
                        status: 'Checked',
                        checked_by: user?.email,
                        checked_date: new Date().toISOString().split('T')[0]
                      });
                    }
                  }
                  setSuccessMessage(`${selectedClaims.length} claims checked`);
                  setSelectedClaims([]);
                  loadData();
                  setProcessing(false);
                }} disabled={processing}>
                  <Check className="w-4 h-4 mr-2" />
                  Check ({selectedClaims.length})
                </Button>
                <Button variant="destructive" onClick={async () => {
                  setProcessing(true);
                  for (const claimId of selectedClaims) {
                    await base44.entities.Claim.update(claimId, {
                      status: 'Draft',
                      rejection_reason: 'Bulk rejection'
                    });
                  }
                  setSuccessMessage(`${selectedClaims.length} claims rejected`);
                  setSelectedClaims([]);
                  loadData();
                  setProcessing(false);
                }} disabled={processing}>
                  <X className="w-4 h-4 mr-2" />
                  Reject ({selectedClaims.length})
                </Button>
              </>
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

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}



      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ModernKPI title="Pending Review" value={pendingClaims.length} subtitle="Awaiting action" icon={FileText} color="orange" />
        <ModernKPI title="Total Claims" value={claims.length} subtitle={`Rp ${(claims.reduce((s, c) => s + (c.nilai_klaim || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} color="blue" />
        <ModernKPI title="Invoiced" value={claims.filter(c => c.claim_status === 'Invoiced').length} subtitle="Nota created" icon={CheckCircle2} color="purple" />
        <ModernKPI title="Paid" value={claims.filter(c => c.claim_status === 'Paid').length} subtitle="Completed" icon={CheckCircle2} color="green" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input placeholder="Batch ID..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            <Select value={filters.claimStatus} onValueChange={(val) => setFilters({...filters, claimStatus: val})}>
              <SelectTrigger><SelectValue placeholder="Claim Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Checked">Checked</SelectItem>
                <SelectItem value="Doc Verified">Doc Verified</SelectItem>
                <SelectItem value="Invoiced">Invoiced</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.subrogationStatus} onValueChange={(val) => setFilters({...filters, subrogationStatus: val})}>
              <SelectTrigger><SelectValue placeholder="Subrogation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Invoiced">Invoiced</SelectItem>
                <SelectItem value="Paid / Closed">Paid / Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({contract: 'all', batch: '', claimStatus: 'all', subrogationStatus: 'all'})}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="review">Pending ({pendingClaims.length})</TabsTrigger>
          <TabsTrigger value="all">All ({claims.length})</TabsTrigger>
          <TabsTrigger value="subrogation">Subrogation ({subrogations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="review"><DataTable columns={claimColumns} data={pendingClaims.filter(c => {
          if (filters.contract !== 'all' && c.contract_id !== filters.contract) return false;
          if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
          return true;
        })} isLoading={loading} emptyMessage="No pending claims" /></TabsContent>
        <TabsContent value="all"><DataTable columns={claimColumns} data={claims.filter(c => {
          if (filters.contract !== 'all' && c.contract_id !== filters.contract) return false;
          if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
          return true;
        })} isLoading={loading} emptyMessage="No claims" /></TabsContent>
        <TabsContent value="subrogation">
          <DataTable
            columns={[
              { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
              { header: 'Claim ID', accessorKey: 'claim_id' },
              { header: 'Recovery', cell: (row) => `Rp ${(row.recovery_amount || 0).toLocaleString()}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={subrogations.filter(s => {
              if (filters.subrogationStatus !== 'all' && s.status !== filters.subrogationStatus) return false;
              return true;
            })}
            isLoading={loading}
            emptyMessage="No subrogations"
          />
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'check' && 'Check Claim'}
              {actionType === 'verify' && 'Verify Documents'}
              {actionType === 'invoice' && 'Issue Claim Nota'}
              {actionType === 'reject' && 'Reject Claim'}
            </DialogTitle>
            <DialogDescription>{selectedClaim?.claim_no} - {selectedClaim?.nama_tertanggung}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionType === 'invoice' && (
              <Alert className="bg-purple-50 border-purple-200">
                <Plus className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-700">
                  <strong>Creating Claim Nota:</strong>
                  <br/>• Nota Type: Claim
                  <br/>• Amount: {selectedClaim ? `Rp ${((selectedClaim.share_tugure_amount || selectedClaim.nilai_klaim || 0)).toLocaleString()}` : '-'}
                  <br/>• Status: Draft (process in Nota Management)
                  <br/><br/>
                  Claim Nota follows same workflow as Batch Nota:
                  <br/>Draft → Issued → Confirmed → Paid
                </AlertDescription>
              </Alert>
            )}
            {selectedClaim && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{selectedClaim.claim_no}</span></div>
                  <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{selectedClaim.nama_tertanggung}</span></div>
                  <div><span className="text-gray-500">Claim Amount:</span><span className="ml-2 font-bold">Rp {(selectedClaim.nilai_klaim || 0).toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Share TUGURE:</span><span className="ml-2 font-bold text-green-600">Rp {(selectedClaim.share_tugure_amount || 0).toLocaleString()}</span></div>
                </div>
              </div>
            )}
            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Enter remarks..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowActionDialog(false); setRemarks(''); }}>Cancel</Button>
            <Button onClick={handleClaimAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>{selectedClaim?.claim_no}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{selectedClaim?.claim_no}</span></div>
              <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{selectedClaim?.nama_tertanggung}</span></div>
              <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">Rp {(selectedClaim?.nilai_klaim || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedClaim?.status} /></div>
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