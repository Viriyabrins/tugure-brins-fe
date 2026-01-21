import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, RefreshCw, ArrowRight, Loader2, Eye, FileText, Clock, DollarSign,
  AlertTriangle, Scale, Plus, X, AlertCircle, Lock
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function NotaManagement() {
  const [user, setUser] = useState(null);
  const [notas, setNotas] = useState([]);
  const [batches, setBatches] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [dnCnRecords, setDnCnRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNota, setSelectedNota] = useState(null);
  const [selectedDnCn, setSelectedDnCn] = useState(null);
  const [selectedRecon, setSelectedRecon] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showDnCnDialog, setShowDnCnDialog] = useState(false);
  const [showDnCnActionDialog, setShowDnCnActionDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showGenerateNotaDialog, setShowGenerateNotaDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('notas');
  const [paymentFormData, setPaymentFormData] = useState({
    actual_paid_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    bank_reference: ''
  });
  const [dnCnFormData, setDnCnFormData] = useState({
    note_type: 'Debit Note',
    adjustment_amount: 0,
    reason_code: 'Payment Difference',
    reason_description: ''
  });
  const [filters, setFilters] = useState({
    contract: 'all',
    notaType: 'all',
    status: 'all'
  });
  const [reconFilters, setReconFilters] = useState({
    contract: 'all',
    status: 'all',
    hasException: 'all'
  });
  const [dnCnFilters, setDnCnFilters] = useState({
    contract: 'all',
    noteType: 'all',
    status: 'all'
  });

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';
  const isBrins = user?.role === 'BRINS' || user?.role === 'admin';

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        const demoUser = JSON.parse(demoUserStr);
        setUser(demoUser);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [notaData, batchData, contractData, paymentData, paymentIntentData, dnCnData] = await Promise.all([
        base44.entities.Nota.list('-created_date'),
        base44.entities.Batch.list(),
        base44.entities.Contract.list(),
        base44.entities.Payment.list(),
        base44.entities.PaymentIntent.list(),
        base44.entities.DebitCreditNote.list('-created_date')
      ]);
      setNotas(notaData || []);
      setBatches(batchData || []);
      setContracts(contractData || []);
      setPayments(paymentData || []);
      setPaymentIntents(paymentIntentData || []);
      setDnCnRecords(dnCnData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getNextStatus = (currentStatus) => {
    const workflow = ['Draft', 'Issued', 'Confirmed', 'Paid'];
    const currentIndex = workflow.indexOf(currentStatus);
    return currentIndex >= 0 && currentIndex < workflow.length - 1 ? workflow[currentIndex + 1] : null;
  };

  const getActionLabel = (status) => {
    const labels = {
      'Draft': 'Issue Nota',
      'Issued': 'Confirm Receipt',
      'Confirmed': 'Mark Paid'
    };
    return labels[status] || 'Process';
  };

  const handleGenerateNota = async () => {
    if (!selectedBatch) return;

    setProcessing(true);
    try {
      // CRITICAL CHECKS
      if (!selectedBatch.debtor_review_completed) {
        alert('❌ BLOCKED: Debtor Review not completed.\n\nAll debtors in this batch must be reviewed (approved/rejected) before generating Nota.');
        
        await createAuditLog(
          'BLOCKED_NOTA_GENERATION',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          '{}',
          JSON.stringify({ blocked_reason: 'debtor_review_completed = FALSE' }),
          user?.email,
          user?.role,
          'Attempted to generate Nota before Debtor Review completion'
        );
        
        setProcessing(false);
        setShowGenerateNotaDialog(false);
        return;
      }

      if (!selectedBatch.batch_ready_for_nota) {
        alert('❌ BLOCKED: Batch not ready for Nota.\n\nAt least one debtor must be approved in Debtor Review.');
        
        await createAuditLog(
          'BLOCKED_NOTA_GENERATION',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          '{}',
          JSON.stringify({ blocked_reason: 'batch_ready_for_nota = FALSE - no approved debtors' }),
          user?.email,
          user?.role,
          'Attempted to generate Nota with no approved debtors'
        );
        
        setProcessing(false);
        setShowGenerateNotaDialog(false);
        return;
      }

      if ((selectedBatch.final_premium_amount || 0) === 0) {
        alert('❌ BLOCKED: Final Premium Amount is zero.\n\nCannot generate Nota without any approved premium.');

        await createAuditLog(
          'BLOCKED_NOTA_GENERATION',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          '{}',
          JSON.stringify({ blocked_reason: 'final_premium_amount is zero' }),
          user?.email,
          user?.role,
          'Attempted to generate Nota with zero final premium amount'
        );

        setProcessing(false);
        setShowGenerateNotaDialog(false);
        return;
      }

      const notaNumber = `NOTA-${selectedBatch.batch_id}-${Date.now()}`;
      
      await base44.entities.Nota.create({
        nota_number: notaNumber,
        nota_type: 'Batch',
        reference_id: selectedBatch.batch_id,
        contract_id: selectedBatch.contract_id,
        amount: selectedBatch.final_premium_amount,
        currency: 'IDR',
        status: 'Draft',
        is_immutable: false,
        total_actual_paid: 0,
        reconciliation_status: 'PENDING'
      });

      await createNotification(
        'Nota Generated from Final Amounts',
        `Nota ${notaNumber} created for Batch ${selectedBatch.batch_id} with final premium: Rp ${(selectedBatch.final_premium_amount || 0).toLocaleString()}`,
        'INFO',
        'DEBTOR',
        selectedBatch.id,
        'ALL'
      );

      await createAuditLog(
        'NOTA_GENERATED',
        'DEBTOR',
        'Nota',
        notaNumber,
        '{}',
        JSON.stringify({ batch_id: selectedBatch.batch_id, amount: selectedBatch.final_premium_amount }),
        user?.email,
        user?.role,
        `Generated from debtor_review_completed = TRUE, batch_ready_for_nota = TRUE`
      );

      setSuccessMessage(`Nota ${notaNumber} generated successfully with final premium amount`);
      setShowGenerateNotaDialog(false);
      setSelectedBatch(null);
      loadData();
    } catch (error) {
      console.error('Generate nota error:', error);
    }
    setProcessing(false);
  };

  const handleNotaAction = async () => {
    if (!selectedNota || !actionType) return;

    // BLOCK: Cannot edit Nota after Issued
    if (selectedNota.is_immutable && getActionLabel(selectedNota.status) === 'Issue Nota') {
      alert('❌ BLOCKED: Nota is IMMUTABLE after being issued.\n\nNota amount cannot be changed. Use DN/CN for adjustments.');
      
      await createAuditLog(
        'BLOCKED_NOTA_EDIT',
        'DEBTOR',
        'Nota',
        selectedNota.id,
        '{}',
        JSON.stringify({ blocked_reason: 'is_immutable = TRUE' }),
        user?.email,
        user?.role,
        'Attempted to edit immutable Nota'
      );
      
      setShowActionDialog(false);
      return;
    }

    setProcessing(true);
    try {
      const nextStatus = getNextStatus(selectedNota.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      const updateData = { status: nextStatus };
      
      if (nextStatus === 'Issued') {
        updateData.issued_by = user?.email;
        updateData.issued_date = new Date().toISOString().split('T')[0];
        updateData.is_immutable = true; // LOCK Nota amount
      } else if (nextStatus === 'Confirmed') {
        updateData.confirmed_by = user?.email;
        updateData.confirmed_date = new Date().toISOString().split('T')[0];
      }

      await base44.entities.Nota.update(selectedNota.id, updateData);

      const targetRole = nextStatus === 'Issued' ? 'BRINS' :
                        nextStatus === 'Confirmed' ? 'TUGURE' : 'ALL';

      await sendTemplatedEmail(
        'Nota',
        selectedNota.status,
        nextStatus,
        targetRole,
        'notify_nota_status',
        {
          nota_number: selectedNota.nota_number,
          nota_type: selectedNota.nota_type,
          reference_id: selectedNota.reference_id,
          amount: `Rp ${(selectedNota.amount || 0).toLocaleString('id-ID')}`,
          date: new Date().toLocaleDateString('id-ID'),
          user_name: user?.email || 'System',
          payment_reference: remarks || ''
        }
      );

      await createNotification(
        `Nota ${nextStatus}`,
        `Nota ${selectedNota.nota_number} (${selectedNota.nota_type}) moved to ${nextStatus}${nextStatus === 'Issued' ? ' - Amount now IMMUTABLE' : ''}`,
        nextStatus === 'Issued' ? 'ACTION_REQUIRED' : 'INFO',
        'DEBTOR',
        selectedNota.id,
        targetRole
      );

      await createAuditLog(
        `NOTA_${nextStatus.toUpperCase()}`,
        'DEBTOR',
        'Nota',
        selectedNota.id,
        JSON.stringify({ status: selectedNota.status }),
        JSON.stringify({ status: nextStatus, is_immutable: nextStatus === 'Issued' }),
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Nota moved to ${nextStatus} successfully${nextStatus === 'Issued' ? ' - Nota is now IMMUTABLE' : ''}`);
      setShowActionDialog(false);
      setSelectedNota(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const handleRecordPayment = async () => {
    if (!selectedRecon || !paymentFormData.actual_paid_amount) return;

    setProcessing(true);
    try {
      const paidAmount = parseFloat(paymentFormData.actual_paid_amount);
      const notaAmount = selectedRecon.amount || 0;
      const previousPaid = selectedRecon.total_actual_paid || 0;
      const newTotalPaid = previousPaid + paidAmount;
      const difference = notaAmount - newTotalPaid;
      
      let matchStatus = 'RECEIVED';
      let exceptionType = 'NONE';
      let reconStatus = 'PARTIAL';
      
      if (Math.abs(difference) <= 1000) {
        matchStatus = 'MATCHED';
        exceptionType = 'NONE';
        reconStatus = 'MATCHED';
      } else if (difference > 0) {
        matchStatus = 'PARTIALLY_MATCHED';
        exceptionType = 'UNDER';
        reconStatus = 'PARTIAL';
      } else {
        matchStatus = 'PARTIALLY_MATCHED';
        exceptionType = 'OVER';
        reconStatus = 'OVERPAID';
      }

      // Create actual Payment record
      const paymentRef = paymentFormData.bank_reference || `PAY-${selectedRecon.nota_number}-${Date.now()}`;
      await base44.entities.Payment.create({
        payment_ref: paymentRef,
        invoice_id: selectedRecon.id,
        contract_id: selectedRecon.contract_id,
        amount: paidAmount,
        payment_date: paymentFormData.payment_date,
        bank_reference: paymentFormData.bank_reference,
        currency: 'IDR',
        match_status: matchStatus,
        exception_type: exceptionType,
        matched_by: user?.email,
        matched_date: new Date().toISOString().split('T')[0],
        is_actual_payment: true
      });

      // Update Nota with accumulated payment
      await base44.entities.Nota.update(selectedRecon.id, {
        total_actual_paid: newTotalPaid,
        reconciliation_status: reconStatus
      });

      // If MATCHED, auto mark Nota as Paid
      if (reconStatus === 'MATCHED') {
        await base44.entities.Nota.update(selectedRecon.id, {
          status: 'Paid',
          paid_date: paymentFormData.payment_date,
          payment_reference: paymentRef
        });

        await createNotification(
          'Payment MATCHED - Nota Paid',
          `Nota ${selectedRecon.nota_number} fully paid. Amount: Rp ${newTotalPaid.toLocaleString()}. Nota closed.`,
          'INFO',
          'DEBTOR',
          selectedRecon.id,
          'ALL'
        );
      } else {
        await createNotification(
          `Payment ${reconStatus} - ${exceptionType !== 'NONE' ? 'Exception Detected' : 'Partial'}`,
          `Nota ${selectedRecon.nota_number}: Rp ${paidAmount.toLocaleString()} received. Total paid: Rp ${newTotalPaid.toLocaleString()}. ${exceptionType === 'UNDER' ? 'UNDERPAYMENT' : exceptionType === 'OVER' ? 'OVERPAYMENT' : 'PARTIAL'} (Difference: Rp ${Math.abs(difference).toLocaleString()})`,
          exceptionType !== 'NONE' ? 'WARNING' : 'INFO',
          'DEBTOR',
          selectedRecon.id,
          'TUGURE'
        );
      }

      await createAuditLog(
        'PAYMENT_RECORDED',
        'PAYMENT',
        'Payment',
        paymentRef,
        '{}',
        JSON.stringify({ nota_id: selectedRecon.id, amount: paidAmount, match_status: matchStatus, exception_type: exceptionType }),
        user?.email,
        user?.role,
        paymentFormData.bank_reference || ''
      );

      setSuccessMessage(`Payment recorded: ${reconStatus}. ${exceptionType !== 'NONE' ? `DN/CN may be required for ${exceptionType === 'UNDER' ? 'underpayment' : 'overpayment'}.` : ''}`);
      setShowPaymentDialog(false);
      setSelectedRecon(null);
      setPaymentFormData({
        actual_paid_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        bank_reference: ''
      });
      loadData();
    } catch (error) {
      console.error('Payment error:', error);
    }
    setProcessing(false);
  };

  const handleMarkReconFinal = async (nota) => {
    if (nota.reconciliation_status === 'PARTIAL') {
      const diff = (nota.amount || 0) - (nota.total_actual_paid || 0);
      if (Math.abs(diff) > 1000) {
        alert(`❌ Cannot mark as FINAL while payment is PARTIAL.\n\nDifference: Rp ${Math.abs(diff).toLocaleString()}\n\nPlease record additional payments or create DN/CN to resolve the difference.`);
        
        await createAuditLog(
          'BLOCKED_RECON_FINAL',
          'RECONCILIATION',
          'Nota',
          nota.id,
          '{}',
          JSON.stringify({ blocked_reason: 'PARTIAL payment - difference exists' }),
          user?.email,
          user?.role,
          'Attempted to finalize reconciliation with outstanding difference'
        );
        return;
      }
    }

    setProcessing(true);
    try {
      await base44.entities.Nota.update(nota.id, {
        reconciliation_status: 'FINAL'
      });

      await createNotification(
        'Reconciliation Marked FINAL',
        `Nota ${nota.nota_number} reconciliation finalized. ${Math.abs((nota.amount || 0) - (nota.total_actual_paid || 0)) > 1000 ? 'DN/CN creation now enabled.' : 'Payment matched.'}`,
        'INFO',
        'RECONCILIATION',
        nota.id,
        'ALL'
      );

      setSuccessMessage('Reconciliation marked as FINAL');
      loadData();
    } catch (error) {
      console.error('Mark final error:', error);
    }
    setProcessing(false);
  };

  const handleCreateDnCn = async () => {
    if (!selectedNota) return;

    // BLOCK: DN/CN only after FINAL reconciliation
    if (selectedNota.reconciliation_status !== 'FINAL') {
      alert('❌ BLOCKED: DN/CN can only be created after reconciliation is marked FINAL.\n\nPlease finalize reconciliation first.');
      
      await createAuditLog(
        'BLOCKED_DNCN_CREATION',
        'RECONCILIATION',
        'Nota',
        selectedNota.id,
        '{}',
        JSON.stringify({ blocked_reason: 'reconciliation_status not FINAL' }),
        user?.email,
        user?.role,
        'Attempted DN/CN creation before reconciliation finalized'
      );
      
      setProcessing(false);
      setShowDnCnDialog(false);
      return;
    }

    // BLOCK: DN/CN only if actual paid != nota amount
    const diff = (selectedNota.amount || 0) - (selectedNota.total_actual_paid || 0);
    if (Math.abs(diff) <= 1000) {
      alert('❌ BLOCKED: DN/CN not needed.\n\nPayment is MATCHED (difference within tolerance).');
      setShowDnCnDialog(false);
      return;
    }

    setProcessing(true);
    try {
      const noteNumber = `${dnCnFormData.note_type === 'Debit Note' ? 'DN' : 'CN'}-${selectedNota.nota_number}-${Date.now()}`;
      
      await base44.entities.DebitCreditNote.create({
        note_number: noteNumber,
        note_type: dnCnFormData.note_type,
        original_nota_id: selectedNota.nota_number,
        batch_id: selectedNota.reference_id,
        contract_id: selectedNota.contract_id,
        adjustment_amount: dnCnFormData.note_type === 'Debit Note' ? 
          Math.abs(dnCnFormData.adjustment_amount) : 
          -Math.abs(dnCnFormData.adjustment_amount),
        reason_code: dnCnFormData.reason_code,
        reason_description: dnCnFormData.reason_description,
        status: 'Draft',
        drafted_by: user?.email,
        drafted_date: new Date().toISOString(),
        currency: 'IDR'
      });

      await createAuditLog(
        'DNCN_CREATED',
        'RECONCILIATION',
        'DebitCreditNote',
        noteNumber,
        '{}',
        JSON.stringify({ original_nota: selectedNota.nota_number, adjustment: dnCnFormData.adjustment_amount }),
        user?.email,
        user?.role,
        dnCnFormData.reason_description
      );

      setSuccessMessage(`${dnCnFormData.note_type} created successfully`);
      setShowDnCnDialog(false);
      setSelectedNota(null);
      setDnCnFormData({
        note_type: 'Debit Note',
        adjustment_amount: 0,
        reason_code: 'Payment Difference',
        reason_description: ''
      });
      loadData();
    } catch (error) {
      console.error('DN/CN creation error:', error);
    }
    setProcessing(false);
  };

  const handleDnCnAction = async (dnCn, action) => {
    setProcessing(true);
    try {
      const statusMap = {
        'review': 'Under Review',
        'approve': 'Approved',
        'reject': 'Rejected',
        'acknowledge': 'Acknowledged'
      };

      const updates = { status: statusMap[action] };

      if (action === 'review') {
        updates.reviewed_by = user?.email;
        updates.reviewed_date = new Date().toISOString();
      } else if (action === 'approve') {
        updates.approved_by = user?.email;
        updates.approved_date = new Date().toISOString();
        
        // When DN/CN approved, allow Nota close
        const originalNota = notas.find(n => n.nota_number === dnCn.original_nota_id);
        if (originalNota) {
          await base44.entities.Nota.update(originalNota.id, {
            reconciliation_status: 'FINAL'
          });
        }
      } else if (action === 'acknowledge') {
        updates.acknowledged_by = user?.email;
        updates.acknowledged_date = new Date().toISOString();
      } else if (action === 'reject') {
        updates.rejection_reason = remarks;
      }

      await base44.entities.DebitCreditNote.update(dnCn.id, updates);

      await sendTemplatedEmail(
        'DebitCreditNote',
        dnCn.status,
        statusMap[action],
        action === 'approve' ? 'BRINS' : 'TUGURE',
        'notify_debit_credit_note',
        {
          note_number: dnCn.note_number,
          note_type: dnCn.note_type,
          adjustment_amount: `Rp ${Math.abs(dnCn.adjustment_amount || 0).toLocaleString('id-ID')}`,
          reason_code: dnCn.reason_code,
          user_name: user?.email,
          date: new Date().toLocaleDateString('id-ID')
        }
      );

      await createNotification(
        `DN/CN ${statusMap[action]}`,
        `${dnCn.note_type} ${dnCn.note_number} is now ${statusMap[action]}`,
        'ACTION_REQUIRED',
        'RECONCILIATION',
        dnCn.id,
        action === 'approve' ? 'BRINS' : 'TUGURE'
      );

      await createAuditLog(
        `DNCN_${action.toUpperCase()}`,
        'RECONCILIATION',
        'DebitCreditNote',
        dnCn.id,
        JSON.stringify({ status: dnCn.status }),
        JSON.stringify({ status: statusMap[action] }),
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`DN/CN ${action}ed successfully`);
      setShowDnCnActionDialog(false);
      setSelectedDnCn(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('DN/CN action error:', error);
    }
    setProcessing(false);
  };

  const handleCloseNota = async (nota) => {
    const hasApprovedDnCn = dnCnRecords.some(d => 
      d.original_nota_id === nota.nota_number && 
      d.status === 'Approved'
    );
    
    if (nota.reconciliation_status !== 'MATCHED' && !hasApprovedDnCn) {
      alert(`❌ BLOCKED: Cannot close Nota.\n\nNota can only be closed if:\n• Actual Paid = Nota Amount (MATCHED)\nOR\n• DN/CN Approved\n\nCurrent status: ${nota.reconciliation_status}\nDifference: Rp ${Math.abs((nota.amount || 0) - (nota.total_actual_paid || 0)).toLocaleString()}`);
      
      await createAuditLog(
        'BLOCKED_NOTA_CLOSE',
        'RECONCILIATION',
        'Nota',
        nota.id,
        '{}',
        JSON.stringify({ blocked_reason: 'Payment not matched and no approved DN/CN' }),
        user?.email,
        user?.role,
        'Attempted to close Nota without payment match or DN/CN approval'
      );
      return;
    }

    setProcessing(true);
    try {
      await base44.entities.Nota.update(nota.id, {
        status: 'Paid',
        paid_date: new Date().toISOString().split('T')[0],
        payment_reference: 'Closed via DN/CN or MATCHED payment'
      });

      setSuccessMessage('Nota closed successfully');
      loadData();
    } catch (error) {
      console.error('Close nota error:', error);
    }
    setProcessing(false);
  };

  const filteredNotas = notas.filter(n => {
    if (filters.contract !== 'all' && n.contract_id !== filters.contract) return false;
    if (filters.notaType !== 'all' && n.nota_type !== filters.notaType) return false;
    if (filters.status !== 'all' && n.status !== filters.status) return false;
    return true;
  });

  // Reconciliation items with payment details (ALL NOTA TYPES)
  const reconciliationItems = notas.map(nota => {
    const relatedPayments = payments.filter(p => p.invoice_id === nota.id && p.is_actual_payment);
    const paymentReceived = relatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const difference = (nota.amount || 0) - paymentReceived;
    
    const relatedIntents = paymentIntents.filter(pi => pi.invoice_id === nota.id);
    const totalPlanned = relatedIntents.reduce((sum, pi) => sum + (pi.planned_amount || 0), 0);

    return {
      ...nota,
      payment_received: paymentReceived,
      total_planned: totalPlanned,
      difference: difference,
      recon_status: nota.reconciliation_status,
      has_exception: Math.abs(difference) > 1000 && nota.status !== 'Paid',
      payment_count: relatedPayments.length,
      intent_count: relatedIntents.length
    };
  });

  const filteredRecon = reconciliationItems.filter(r => {
    if (reconFilters.contract !== 'all' && r.contract_id !== reconFilters.contract) return false;
    if (reconFilters.status !== 'all' && r.status !== reconFilters.status) return false;
    if (reconFilters.hasException === 'yes' && !r.has_exception) return false;
    if (reconFilters.hasException === 'no' && r.has_exception) return false;
    return true;
  });

  const filteredDnCn = dnCnRecords.filter(d => {
    if (dnCnFilters.contract !== 'all' && d.contract_id !== dnCnFilters.contract) return false;
    if (dnCnFilters.noteType !== 'all' && d.note_type !== dnCnFilters.noteType) return false;
    if (dnCnFilters.status !== 'all' && d.status !== dnCnFilters.status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nota Management"
        subtitle="Manage notas, reconciliation, and DN/CN adjustments"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Nota Management' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {isTugure && (
              <Button className="bg-blue-600" onClick={() => setShowGenerateNotaDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Generate Nota
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="dncn">DN / CN</TabsTrigger>
        </TabsList>

        {/* NOTAS TAB */}
        <TabsContent value="notas" className="space-y-6">


          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI title="Total Notas" value={notas.length} subtitle={`${notas.filter(n => n.nota_type === 'Batch').length} batch / ${notas.filter(n => n.nota_type === 'Claim').length} claim`} icon={FileText} color="blue" />
            <ModernKPI title="Pending Confirmation" value={notas.filter(n => n.status === 'Issued').length} subtitle="Awaiting branch" icon={Clock} color="orange" />
            <ModernKPI title="Total Amount" value={`Rp ${(notas.reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`} subtitle="All notas" icon={DollarSign} color="green" />
            <ModernKPI title="Paid Notas" value={notas.filter(n => n.status === 'Paid').length} subtitle={`Rp ${(notas.filter(n => n.status === 'Paid').reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`} icon={CheckCircle2} color="purple" />
          </div>

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
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Issued">Issued</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setFilters({ contract: 'all', notaType: 'all', status: 'all' })}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={[
              {
                header: 'Nota Number',
                cell: (row) => (
                  <div>
                    <p className="font-medium font-mono">{row.nota_number}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{row.nota_type}</Badge>
                      {row.is_immutable && <Lock className="w-3 h-3 text-red-500" title="IMMUTABLE - cannot edit" />}
                    </div>
                  </div>
                )
              },
              { header: 'Reference', cell: (row) => <span className="text-sm">{row.reference_id}</span> },
              { header: 'Amount', cell: (row) => <span className="font-bold">Rp {(row.amount || 0).toLocaleString('id-ID')}</span> },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              { 
                header: 'Recon Status', 
                cell: (row) => row.reconciliation_status ? <StatusBadge status={row.reconciliation_status} /> : '-'
              },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setSelectedNota(row);
                      setShowViewDialog(true);
                    }}>
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {row.status !== 'Paid' && getNextStatus(row.status) && (
                      <Button 
                        size="sm" 
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setSelectedNota(row);
                          setActionType(getActionLabel(row.status));
                          setShowActionDialog(true);
                        }}
                        disabled={row.is_immutable && getActionLabel(row.status) === 'Issue Nota'}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        {getActionLabel(row.status)}
                      </Button>
                    )}
                    {row.is_immutable && row.status !== 'Paid' && (
                      <span className="text-xs text-gray-500 italic">Proceed to Reconciliation</span>
                    )}
                  </div>
                )
              }
            ]}
            data={filteredNotas}
            isLoading={loading}
            emptyMessage="No notas found"
          />
        </TabsContent>

        {/* RECONCILIATION TAB */}
        <TabsContent value="reconciliation" className="space-y-6">


          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <ModernKPI title="All Notas" value={reconciliationItems.length} subtitle={`${reconciliationItems.filter(r => r.nota_type === 'Batch').length} batch / ${reconciliationItems.filter(r => r.nota_type === 'Claim').length} claim`} icon={FileText} color="purple" />
            <ModernKPI title="Total Invoiced" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + (r.amount || 0), 0) / 1000000).toFixed(1)}M`} subtitle="Nota amounts" icon={FileText} color="blue" />
            <ModernKPI title="Total Paid" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + (r.total_actual_paid || 0), 0) / 1000000).toFixed(1)}M`} subtitle="Actual payments" icon={CheckCircle2} color="green" />
            <ModernKPI title="Difference" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + ((r.amount || 0) - (r.total_actual_paid || 0)), 0) / 1000000).toFixed(1)}M`} subtitle="To reconcile" icon={AlertTriangle} color="orange" />
            <ModernKPI title="Exceptions" value={reconciliationItems.filter(r => r.has_exception && r.reconciliation_status === 'FINAL').length} subtitle="Requires DN/CN" icon={AlertTriangle} color="red" />
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={reconFilters.contract} onValueChange={(val) => setReconFilters({...reconFilters, contract: val})}>
                  <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={reconFilters.status} onValueChange={(val) => setReconFilters({...reconFilters, status: val})}>
                  <SelectTrigger><SelectValue placeholder="Nota Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Issued">Issued</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={reconFilters.hasException} onValueChange={(val) => setReconFilters({...reconFilters, hasException: val})}>
                  <SelectTrigger><SelectValue placeholder="Exception" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Has Exception</SelectItem>
                    <SelectItem value="no">No Exception</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setReconFilters({contract: 'all', status: 'all', hasException: 'all'})}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={[
              { 
                header: 'Nota', 
                cell: (row) => (
                  <div>
                    <div className="font-medium font-mono">{row.nota_number}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{row.nota_type}</Badge>
                      <span className="text-xs text-gray-500">{row.reference_id}</span>
                    </div>
                  </div>
                )
              },
              { 
                header: 'Nota Amount', 
                cell: (row) => (
                  <div>
                    <div className="font-bold text-blue-600">Rp {((row.amount || 0) / 1000000).toFixed(2)}M</div>
                    {row.is_immutable && <Lock className="w-3 h-3 text-red-500 inline ml-1" />}
                  </div>
                )
              },
              { 
                header: 'Total Planned', 
                cell: (row) => (
                  <div>
                    <div className="text-gray-600">Rp {((row.total_planned || 0) / 1000000).toFixed(2)}M</div>
                    <div className="text-xs text-gray-400">{row.intent_count} intent(s)</div>
                  </div>
                )
              },
              { 
                header: 'Total Actual Paid', 
                cell: (row) => (
                  <div>
                    <div className="text-green-600 font-bold">Rp {((row.total_actual_paid || 0) / 1000000).toFixed(2)}M</div>
                    <div className="text-xs text-gray-400">{row.payment_count} payment(s)</div>
                  </div>
                )
              },
              { 
                header: 'Difference', 
                cell: (row) => {
                  const diff = (row.amount || 0) - (row.total_actual_paid || 0);
                  return (
                    <div className="flex items-center gap-2">
                      <span className={Math.abs(diff) > 1000 ? 'text-red-600 font-bold' : 'text-green-600'}>
                        Rp {(diff / 1000000).toFixed(2)}M
                      </span>
                      {Math.abs(diff) > 1000 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    </div>
                  );
                }
              },
              { header: 'Recon Status', cell: (row) => <StatusBadge status={row.reconciliation_status} /> },
              { header: 'Nota Status', cell: (row) => <StatusBadge status={row.status} /> },
              { 
                header: 'Actions', 
                cell: (row) => (
                  <div className="flex gap-1 flex-wrap">
                    {isTugure && row.status !== 'Paid' && (
                      <Button size="sm" className="bg-blue-600" onClick={() => { 
                        setSelectedRecon(row); 
                        setPaymentFormData({
                          actual_paid_amount: '',
                          payment_date: new Date().toISOString().split('T')[0],
                          bank_reference: ''
                        });
                        setShowPaymentDialog(true); 
                      }}>
                        Record Payment
                      </Button>
                    )}
                    {isTugure && row.reconciliation_status !== 'FINAL' && row.total_actual_paid > 0 && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkReconFinal(row)}>
                        Mark FINAL
                      </Button>
                    )}
                    {isTugure && row.has_exception && row.reconciliation_status === 'FINAL' && (
                      <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => { 
                        setSelectedNota(row);
                        const diff = (row.amount || 0) - (row.total_actual_paid || 0);
                        setDnCnFormData({
                          note_type: diff > 0 ? 'Debit Note' : 'Credit Note',
                          adjustment_amount: Math.abs(diff),
                          reason_code: 'Payment Difference',
                          reason_description: `${diff > 0 ? 'Underpayment' : 'Overpayment'} of Rp ${Math.abs(diff).toLocaleString()}`
                        });
                        setShowDnCnDialog(true); 
                      }}>
                        <Plus className="w-4 h-4 mr-1" />
                        DN/CN
                      </Button>
                    )}
                    {(row.reconciliation_status === 'MATCHED' || dnCnRecords.some(d => d.original_nota_id === row.nota_number && d.status === 'Approved')) && row.status !== 'Paid' && (
                      <Button size="sm" className="bg-green-600" onClick={() => handleCloseNota(row)}>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Close Nota
                      </Button>
                    )}
                  </div>
                )
              }
            ]}
            data={filteredRecon}
            isLoading={loading}
            emptyMessage="No reconciliation items"
          />
        </TabsContent>

        {/* DN/CN TAB */}
        <TabsContent value="dncn" className="space-y-6">


          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI title="Total DN/CN" value={dnCnRecords.length} subtitle={`${dnCnRecords.filter(d => d.note_type === 'Debit Note').length} DN / ${dnCnRecords.filter(d => d.note_type === 'Credit Note').length} CN`} icon={FileText} color="blue" />
            <ModernKPI title="Pending Review" value={dnCnRecords.filter(d => d.status === 'Draft' || d.status === 'Under Review').length} subtitle="Awaiting action" icon={Clock} color="orange" />
            <ModernKPI title="Approved" value={dnCnRecords.filter(d => d.status === 'Approved').length} subtitle="Ready for acknowledgment" icon={CheckCircle2} color="green" />
            <ModernKPI title="Total Adjustment" value={`Rp ${(dnCnRecords.reduce((sum, d) => sum + Math.abs(d.adjustment_amount || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} color="purple" />
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={dnCnFilters.contract} onValueChange={(val) => setDnCnFilters({...dnCnFilters, contract: val})}>
                  <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={dnCnFilters.noteType} onValueChange={(val) => setDnCnFilters({...dnCnFilters, noteType: val})}>
                  <SelectTrigger><SelectValue placeholder="Note Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Debit Note">Debit Note</SelectItem>
                    <SelectItem value="Credit Note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dnCnFilters.status} onValueChange={(val) => setDnCnFilters({...dnCnFilters, status: val})}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setDnCnFilters({contract: 'all', noteType: 'all', status: 'all'})}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={[
              { 
                header: 'Note Number', 
                cell: (row) => (
                  <div>
                    <div className="font-medium font-mono">{row.note_number}</div>
                    <Badge className={row.note_type === 'Debit Note' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                      {row.note_type}
                    </Badge>
                  </div>
                )
              },
              { header: 'Original Nota', accessorKey: 'original_nota_id' },
              { header: 'Batch ID', accessorKey: 'batch_id' },
              { 
                header: 'Adjustment', 
                cell: (row) => (
                  <div className={row.note_type === 'Debit Note' ? 'text-red-600 font-bold' : 'text-blue-600 font-bold'}>
                    Rp {(Math.abs(row.adjustment_amount || 0)).toLocaleString('id-ID')}
                  </div>
                )
              },
              { header: 'Reason', accessorKey: 'reason_code' },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              { 
                header: 'Actions', 
                cell: (row) => (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedDnCn(row); setShowViewDialog(true); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {isTugure && row.status === 'Draft' && (
                      <Button size="sm" onClick={() => { setSelectedDnCn(row); setActionType('review'); setShowDnCnActionDialog(true); }}>
                        Review
                      </Button>
                    )}
                    {isTugure && row.status === 'Under Review' && (
                      <div className="flex gap-1">
                        <Button size="sm" className="bg-green-600" onClick={() => { setSelectedDnCn(row); setActionType('approve'); setShowDnCnActionDialog(true); }}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelectedDnCn(row); setActionType('reject'); setShowDnCnActionDialog(true); }}>
                          Reject
                        </Button>
                      </div>
                    )}
                    {isBrins && row.status === 'Approved' && (
                      <Button size="sm" className="bg-blue-600" onClick={() => { setSelectedDnCn(row); setActionType('acknowledge'); setShowDnCnActionDialog(true); }}>
                        Acknowledge
                      </Button>
                    )}
                  </div>
                )
              }
            ]}
            data={filteredDnCn}
            isLoading={loading}
            emptyMessage="No DN/CN records"
          />
        </TabsContent>
      </Tabs>

      {/* Generate Nota Dialog */}
      <Dialog open={showGenerateNotaDialog} onOpenChange={setShowGenerateNotaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Nota from Batch</DialogTitle>
            <DialogDescription>Select batch where Debtor Review is completed</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Requirements:</strong>
                <br/>✓ debtor_review_completed = TRUE (all debtors reviewed)
                <br/>✓ batch_ready_for_nota = TRUE (at least 1 approved)
                <br/>✓ final_premium_amount &gt; 0
                <br/><br/>
                Nota amount will be derived from <strong>final_premium_amount</strong>.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Select Batch *</Label>
              <Select value={selectedBatch?.id || ''} onValueChange={(val) => {
                const batch = batches.find(b => b.id === val);
                setSelectedBatch(batch);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                    {batches.filter(b => b.debtor_review_completed && b.batch_ready_for_nota && b.status === 'Approved' && (b.final_premium_amount || 0) > 0).map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_id} - Rp {((b.final_premium_amount || 0) / 1000000).toFixed(1)}M ✓
                      </SelectItem>
                    ))}
                    {batches.filter(b => !b.debtor_review_completed || !b.batch_ready_for_nota || b.status !== 'Approved' || (b.final_premium_amount || 0) === 0).map(b => (
                      <SelectItem key={b.id} value={b.id} disabled>
                        {b.batch_id} - {!b.debtor_review_completed ? '❌ Review Incomplete' : (!b.batch_ready_for_nota ? '❌ No Approved' : (b.status !== 'Approved' ? `❌ ${b.status}` : '❌ Zero Premium'))}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBatch && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Final Exposure:</span><span className="ml-2 font-bold">Rp {((selectedBatch.final_exposure_amount || 0) / 1000000).toFixed(1)}M</span></div>
                  <div><span className="text-gray-500">Final Premium:</span><span className="ml-2 font-bold text-green-600">Rp {((selectedBatch.final_premium_amount || 0) / 1000000).toFixed(1)}M</span></div>
                  <div><span className="text-gray-500">Review Complete:</span><span className="ml-2 font-bold text-blue-600">{selectedBatch.debtor_review_completed ? '✓ YES' : '❌ NO'}</span></div>
                  <div><span className="text-gray-500">Ready for Nota:</span><span className="ml-2 font-bold text-blue-600">{selectedBatch.batch_ready_for_nota ? '✓ YES' : '❌ NO'}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowGenerateNotaDialog(false); setSelectedBatch(null); }}>Cancel</Button>
            <Button onClick={handleGenerateNota} disabled={processing || !selectedBatch?.debtor_review_completed || !selectedBatch?.batch_ready_for_nota || selectedBatch?.status !== 'Approved' || (selectedBatch?.final_premium_amount || 0) === 0} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Generate Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Actual Payment</DialogTitle>
            <DialogDescription>Nota: {selectedRecon?.nota_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Nota Amount:</span>
                  <div className="font-bold text-blue-600 text-lg">Rp {((selectedRecon?.amount || 0) / 1000000).toFixed(2)}M</div>
                </div>
                <div>
                  <span className="text-gray-600">Total Planned:</span>
                  <div className="font-medium text-gray-600 text-lg">Rp {((selectedRecon?.total_planned || 0) / 1000000).toFixed(2)}M</div>
                  <div className="text-xs text-gray-500">{selectedRecon?.intent_count} intent(s)</div>
                </div>
                <div>
                  <span className="text-gray-600">Already Paid:</span>
                  <div className="font-bold text-green-600 text-lg">Rp {((selectedRecon?.total_actual_paid || 0) / 1000000).toFixed(2)}M</div>
                  <div className="text-xs text-gray-500">{selectedRecon?.payment_count} payment(s)</div>
                </div>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Payment Status Rules:</strong>
                <br/>• PARTIAL: Actual Paid &lt; Nota Amount (normal, can add more payments)
                <br/>• MATCHED: Actual Paid = Nota Amount (auto-close Nota)
                <br/>• OVERPAID: Actual Paid &gt; Nota Amount (DN/CN required)
                <br/><br/>
                <strong>Note:</strong> Planned vs Actual mismatch is NORMAL. Multiple payments accumulate.
              </AlertDescription>
            </Alert>

            <div>
              <Label>Actual Paid Amount (Rp) *</Label>
              <Input
                type="number"
                value={paymentFormData.actual_paid_amount}
                onChange={(e) => {
                  setPaymentFormData({...paymentFormData, actual_paid_amount: e.target.value});
                }}
                placeholder="Enter amount received from bank"
              />
              {paymentFormData.actual_paid_amount && (
                <div className="mt-2 p-3 rounded-lg border-2" style={{
                  backgroundColor: Math.abs((selectedRecon?.amount || 0) - ((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount))) <= 1000 ? '#d1fae5' : '#fed7aa',
                  borderColor: Math.abs((selectedRecon?.amount || 0) - ((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount))) <= 1000 ? '#10b981' : '#f59e0b'
                }}>
                  <div className="text-sm font-semibold">
                    New Total Paid: Rp {(((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount)) / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-xs mt-1">
                    {Math.abs((selectedRecon?.amount || 0) - ((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount))) <= 1000 
                      ? '✓ MATCHED - Nota will auto-close' 
                      : `⚠️ ${(selectedRecon?.amount || 0) - ((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount)) > 0 ? 'PARTIAL' : 'OVERPAID'} - Difference: Rp ${Math.abs((selectedRecon?.amount || 0) - ((selectedRecon?.total_actual_paid || 0) + parseFloat(paymentFormData.actual_paid_amount))).toLocaleString()}`
                    }
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paymentFormData.payment_date}
                onChange={(e) => setPaymentFormData({...paymentFormData, payment_date: e.target.value})}
              />
            </div>

            <div>
              <Label>Bank Reference / Transaction ID *</Label>
              <Input
                value={paymentFormData.bank_reference}
                onChange={(e) => setPaymentFormData({...paymentFormData, bank_reference: e.target.value})}
                placeholder="e.g., TRX-20250124-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { 
              setShowPaymentDialog(false); 
              setPaymentFormData({
                actual_paid_amount: '',
                payment_date: new Date().toISOString().split('T')[0],
                bank_reference: ''
              });
            }}>Cancel</Button>
            <Button 
              onClick={handleRecordPayment} 
              disabled={processing || !paymentFormData.actual_paid_amount || !paymentFormData.bank_reference} 
              className="bg-blue-600"
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DN/CN Creation Dialog */}
      <Dialog open={showDnCnDialog} onOpenChange={setShowDnCnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Debit / Credit Note</DialogTitle>
            <DialogDescription>For Nota: {selectedNota?.nota_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Prerequisites:</strong>
                <br/>✓ Reconciliation must be marked FINAL
                <br/>✓ Payment difference must exist
                <br/><br/>
                <strong>Original Nota remains UNCHANGED.</strong>
              </AlertDescription>
            </Alert>

            {selectedNota && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Nota Amount:</span><span className="ml-2 font-bold">Rp {(selectedNota.amount || 0).toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Actual Paid:</span><span className="ml-2 font-bold text-green-600">Rp {(selectedNota.total_actual_paid || 0).toLocaleString()}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Difference:</span><span className="ml-2 font-bold text-red-600">Rp {Math.abs((selectedNota.amount || 0) - (selectedNota.total_actual_paid || 0)).toLocaleString()}</span></div>
                </div>
              </div>
            )}

            <div>
              <Label>Note Type *</Label>
              <Select value={dnCnFormData.note_type} onValueChange={(val) => setDnCnFormData({...dnCnFormData, note_type: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Debit Note">Debit Note (Underpayment - increase amount)</SelectItem>
                  <SelectItem value="Credit Note">Credit Note (Overpayment - decrease amount)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Adjustment Amount (IDR) *</Label>
              <Input
                type="number"
                value={dnCnFormData.adjustment_amount}
                onChange={(e) => setDnCnFormData({...dnCnFormData, adjustment_amount: parseFloat(e.target.value) || 0})}
              />
            </div>

            <div>
              <Label>Reason Code *</Label>
              <Select value={dnCnFormData.reason_code} onValueChange={(val) => setDnCnFormData({...dnCnFormData, reason_code: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Payment Difference">Payment Difference</SelectItem>
                  <SelectItem value="FX Adjustment">FX Adjustment</SelectItem>
                  <SelectItem value="Premium Correction">Premium Correction</SelectItem>
                  <SelectItem value="Coverage Adjustment">Coverage Adjustment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={dnCnFormData.reason_description}
                onChange={(e) => setDnCnFormData({...dnCnFormData, reason_description: e.target.value})}
                placeholder="Explain the reason for this adjustment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnCnDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateDnCn} disabled={processing || !dnCnFormData.reason_description}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create DN/CN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DN/CN Action Dialog */}
      <Dialog open={showDnCnActionDialog} onOpenChange={setShowDnCnActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} DN/CN</DialogTitle>
            <DialogDescription>{selectedDnCn?.note_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedDnCn && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Type:</span><span className="ml-2 font-medium">{selectedDnCn.note_type}</span></div>
                  <div><span className="text-gray-500">Adjustment:</span><span className="ml-2 font-bold">Rp {Math.abs(selectedDnCn.adjustment_amount || 0).toLocaleString()}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Original Nota:</span><span className="ml-2 font-medium">{selectedDnCn.original_nota_id}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Reason:</span><span className="ml-2 font-medium">{selectedDnCn.reason_description}</span></div>
                </div>
              </div>
            )}
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnCnActionDialog(false)}>Cancel</Button>
            <Button onClick={() => handleDnCnAction(selectedDnCn, actionType)} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nota Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType}</DialogTitle>
            <DialogDescription>
              Move nota {selectedNota?.nota_number} from {selectedNota?.status} to {getNextStatus(selectedNota?.status)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {getNextStatus(selectedNota?.status) === 'Issued' && (
              <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> After issuing, Nota amount becomes IMMUTABLE and cannot be edited.
                  <br/>Any adjustments must be done via DN/CN.
                </AlertDescription>
              </Alert>
            )}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Type:</span><Badge>{selectedNota?.nota_type}</Badge></div>
                <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">Rp {(selectedNota?.amount || 0).toLocaleString('id-ID')}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Reference:</span><span className="ml-2 font-medium">{selectedNota?.reference_id}</span></div>
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button onClick={handleNotaAction} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><ArrowRight className="w-4 h-4 mr-2" />{actionType}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNota ? 'Nota Detail' : 'Debit/Credit Note Detail'}</DialogTitle>
            <DialogDescription>{selectedNota?.nota_number || selectedDnCn?.note_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedNota && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Type:</span><Badge>{selectedNota.nota_type}</Badge></div>
                  <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">Rp {(selectedNota.amount || 0).toLocaleString('id-ID')}</span></div>
                  <div><span className="text-gray-500">Status:</span><span className="ml-2"><StatusBadge status={selectedNota.status} /></span></div>
                  <div><span className="text-gray-500">Immutable:</span><span className="ml-2 font-bold">{selectedNota.is_immutable ? '🔒 YES' : 'NO'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Reference:</span><span className="ml-2 font-medium">{selectedNota.reference_id}</span></div>
                </div>
              </div>
            )}
            {selectedDnCn && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Type:</span><Badge className={selectedDnCn?.note_type === 'Debit Note' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>{selectedDnCn?.note_type}</Badge></div>
                  <div><span className="text-gray-500">Adjustment:</span><span className="ml-2 font-bold">Rp {Math.abs(selectedDnCn.adjustment_amount || 0).toLocaleString()}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Original Nota:</span><span className="ml-2 font-medium">{selectedDnCn.original_nota_id}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Reason:</span><span className="ml-2 font-medium">{selectedDnCn.reason_description}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}