import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, Send, CheckCircle2, Download, 
  RefreshCw, Loader2, Eye, AlertCircle, Clock
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";

export default function PaymentIntent() {
  const [user, setUser] = useState(null);
  const [notas, setNotas] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedNota, setSelectedNota] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentType, setPaymentType] = useState('FULL');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    notaType: 'all',
    status: 'all'
  });

  const isBrins = user?.role === 'BRINS' || user?.role === 'admin';
  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';

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
      const [notaData, intentData, contractData] = await Promise.all([
        base44.entities.Nota.list(),
        base44.entities.PaymentIntent.list(),
        base44.entities.Contract.list()
      ]);
      
      // Only show Issued/Confirmed notas
      const issuedNotas = (notaData || []).filter(n => 
        n.status === 'Issued' || n.status === 'Confirmed'
      );
      
      setNotas(issuedNotas);
      setPaymentIntents(intentData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleCreateIntent = async () => {
    if (!selectedNota || !plannedAmount || !plannedDate) {
      setErrorMessage('Please fill all required fields');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    
    try {
      const nota = notas.find(n => n.id === selectedNota);
      if (!nota) {
        setErrorMessage('Nota not found');
        setProcessing(false);
        return;
      }

      // BLOCK: Cannot create Payment Intent before Nota is Issued
      if (nota.status !== 'Issued' && nota.status !== 'Confirmed') {
        alert(`❌ BLOCKED: Payment Intent can only be created for ISSUED or CONFIRMED notas.\n\nCurrent nota status: ${nota.status}\n\nPlease wait for Nota to be issued first.`);
        
        await base44.entities.AuditLog.create({
          action: 'BLOCKED_PAYMENT_INTENT',
          module: 'PAYMENT',
          entity_type: 'PaymentIntent',
          entity_id: nota.nota_number,
          old_value: '{}',
          new_value: JSON.stringify({ blocked_reason: `Current status: ${nota.status}` }),
          user_email: user?.email,
          user_role: user?.role,
          reason: `Attempted to create Payment Intent before Nota Issued (current status: ${nota.status})`
        });
        
        setErrorMessage('Payment Intent blocked - Nota must be Issued first');
        setProcessing(false);
        return;
      }

      const intentId = `PI-${nota.nota_number}-${Date.now()}`;
      
      await base44.entities.PaymentIntent.create({
        intent_id: intentId,
        invoice_id: nota.id,
        contract_id: nota.contract_id,
        payment_type: paymentType,
        planned_amount: parseFloat(plannedAmount),
        planned_date: plannedDate,
        remarks: remarks,
        status: 'DRAFT'
      });

      await base44.entities.Notification.create({
        title: 'Payment Intent Created (Planning Only)',
        message: `Payment Intent ${intentId} created for Nota ${nota.nota_number}. This is PLANNING ONLY - actual payment must be recorded in Reconciliation.`,
        type: 'INFO',
        module: 'PAYMENT',
        reference_id: intentId,
        target_role: 'BRINS'
      });

      await base44.entities.AuditLog.create({
        action: 'PAYMENT_INTENT_CREATED',
        module: 'PAYMENT',
        entity_type: 'PaymentIntent',
        entity_id: intentId,
        old_value: '{}',
        new_value: JSON.stringify({ planned_amount: parseFloat(plannedAmount), planned_date: plannedDate, note: 'PLANNING ONLY' }),
        user_email: user?.email,
        user_role: user?.role
      });

      setSuccessMessage('Payment Intent created (planning only - record actual payment in Reconciliation)');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create error:', error);
      setErrorMessage('Failed to create payment intent');
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setSelectedNota('');
    setPaymentType('FULL');
    setPlannedAmount('');
    setPlannedDate('');
    setRemarks('');
  };

  const handleSubmitIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'SUBMITTED'
      });

      await base44.entities.Notification.create({
        title: 'Payment Intent Submitted',
        message: `Payment Intent ${intent.intent_id} submitted for approval`,
        type: 'ACTION_REQUIRED',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'TUGURE'
      });

      setSuccessMessage('Payment intent submitted for approval');
      loadData();
    } catch (error) {
      console.error('Submit error:', error);
    }
    setProcessing(false);
  };

  const handleApproveIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'APPROVED'
      });

      await base44.entities.Notification.create({
        title: 'Payment Intent Approved',
        message: `Payment Intent ${intent.intent_id} approved`,
        type: 'INFO',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'BRINS'
      });

      setSuccessMessage('Payment intent approved');
      loadData();
    } catch (error) {
      console.error('Approve error:', error);
    }
    setProcessing(false);
  };

  const handleRejectIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'REJECTED'
      });

      await base44.entities.Notification.create({
        title: 'Payment Intent Rejected',
        message: `Payment Intent ${intent.intent_id} rejected`,
        type: 'WARNING',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'BRINS'
      });

      setSuccessMessage('Payment intent rejected');
      loadData();
    } catch (error) {
      console.error('Reject error:', error);
    }
    setProcessing(false);
  };

  const intentColumns = [
    { header: 'Intent ID', accessorKey: 'intent_id' },
    { 
      header: 'Nota Reference', 
      cell: (row) => {
        const nota = notas.find(n => n.id === row.invoice_id);
        return nota?.nota_number || '-';
      }
    },
    { header: 'Type', cell: (row) => <StatusBadge status={row.payment_type} /> },
    { header: 'Planned Amount', cell: (row) => `Rp ${(row.planned_amount || 0).toLocaleString('id-ID')}` },
    { header: 'Planned Date', accessorKey: 'planned_date' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          {row.status === 'DRAFT' && isBrins && (
            <Button size="sm" className="bg-blue-600" onClick={() => handleSubmitIntent(row)}>
              Submit
            </Button>
          )}
          {row.status === 'SUBMITTED' && isTugure && (
            <>
              <Button size="sm" className="bg-green-600" onClick={() => handleApproveIntent(row)}>
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleRejectIntent(row)}>
                Reject
              </Button>
            </>
          )}
          {row.status === 'APPROVED' && (
            <span className="text-xs text-green-600">Approved - Ready for Matching</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Intent - Planning Stage"
        subtitle="⚠️ Payment Intent is PLANNING ONLY - does not mark payment as done. Record actual payments in Reconciliation."
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Payment Intent' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {isBrins && (
              <Button className="bg-blue-600" onClick={() => setShowCreateDialog(true)}>
                <DollarSign className="w-4 h-4 mr-2" />
                Create Intent
              </Button>
            )}
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

      {notas.length === 0 && !loading && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            No issued notas available. Please ensure Nota Management has issued notas first.
          </AlertDescription>
        </Alert>
      )}



      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ModernKPI title="Available Notas" value={notas.length} subtitle="Issued/Confirmed" icon={DollarSign} color="blue" />
        <ModernKPI title="Draft Intents" value={paymentIntents.filter(p => p.status === 'DRAFT').length} subtitle="Pending submission" icon={Clock} color="orange" />
        <ModernKPI title="Approved Intents" value={paymentIntents.filter(p => p.status === 'APPROVED').length} subtitle="Ready for matching" icon={CheckCircle2} color="green" />
        <ModernKPI title="Total Planned" value={`Rp ${(paymentIntents.reduce((s, p) => s + (p.planned_amount || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} color="purple" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.notaType} onValueChange={(val) => setFilters({...filters, notaType: val})}>
              <SelectTrigger><SelectValue placeholder="Nota Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Batch">Batch</SelectItem>
                <SelectItem value="Claim">Claim</SelectItem>
                <SelectItem value="Subrogation">Subrogation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger><SelectValue placeholder="Intent Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({contract: 'all', notaType: 'all', status: 'all'})}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Intents</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={intentColumns} data={paymentIntents.filter(p => {
            if (filters.contract !== 'all' && p.contract_id !== filters.contract) return false;
            if (filters.status !== 'all' && p.status !== filters.status) return false;
            const nota = notas.find(n => n.id === p.invoice_id);
            if (filters.notaType !== 'all' && nota?.nota_type !== filters.notaType) return false;
            return true;
          })} isLoading={loading} emptyMessage="No payment intents" />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payment Intent</DialogTitle>
            <DialogDescription>Plan payment for issued nota</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Nota *</Label>
              <Select value={selectedNota} onValueChange={(val) => {
                setSelectedNota(val);
                const nota = notas.find(n => n.id === val);
                if (nota) {
                  setPlannedAmount(nota.amount?.toString() || '');
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select nota" />
                </SelectTrigger>
                <SelectContent>
                  {notas.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nota_number} - {n.nota_type} - Rp {(n.amount || 0).toLocaleString('id-ID')} ({n.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Payment</SelectItem>
                  <SelectItem value="PARTIAL">Partial Payment</SelectItem>
                  <SelectItem value="INSTALMENT">Instalment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Planned Amount (Rp) *</Label>
              <Input type="number" value={plannedAmount} onChange={(e) => setPlannedAmount(e.target.value)} />
            </div>
            <div>
              <Label>Planned Date *</Label>
              <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreateIntent} disabled={processing || !selectedNota || !plannedAmount || !plannedDate} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Create Intent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}