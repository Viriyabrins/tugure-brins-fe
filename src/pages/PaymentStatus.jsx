import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CreditCard, DollarSign, CheckCircle2, AlertTriangle, 
  Clock, RefreshCw, Eye, TrendingDown, Download, FileText
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ExportButton from "@/components/common/ExportButton";

export default function PaymentStatus() {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [contractFilter, setContractFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceData, paymentData, contractData] = await Promise.all([
        base44.entities.Invoice.list(),
        base44.entities.Payment.list(),
        base44.entities.Contract.list()
      ]);
      setInvoices(invoiceData || []);
      setPayments(paymentData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getInvoicePayments = (invoiceId) => {
    return payments.filter(p => p.invoice_id === invoiceId);
  };

  // Calculate stats
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + (i.outstanding_amount || 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE').length;

  const filteredInvoices = invoices.filter(i => {
    if (contractFilter !== 'all' && i.contract_id !== contractFilter) return false;
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    return true;
  });

  const formatCurrency = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    return value.toLocaleString();
  };

  const columns = [
    { header: 'Invoice Number', accessorKey: 'invoice_number' },
    { header: 'Period', accessorKey: 'period' },
    { 
      header: 'Invoice Amount', 
      cell: (row) => (
        <span className="font-semibold">IDR {formatCurrency(row.total_amount || 0)}</span>
      )
    },
    { 
      header: 'Paid Amount', 
      cell: (row) => (
        <span className="text-green-600 font-medium">IDR {formatCurrency(row.paid_amount || 0)}</span>
      )
    },
    { 
      header: 'Outstanding', 
      cell: (row) => (
        <span className="text-orange-600 font-medium">IDR {formatCurrency(row.outstanding_amount || 0)}</span>
      )
    },
    { header: 'Due Date', accessorKey: 'due_date' },
    { header: 'Invoice Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Payment Status',
      cell: (row) => {
        const invoicePayments = getInvoicePayments(row.id);
        if (invoicePayments.length === 0) return <StatusBadge status="PENDING" />;
        const matched = invoicePayments.filter(p => p.match_status === 'MATCHED').length;
        if (matched === invoicePayments.length) return <StatusBadge status="MATCHED" />;
        if (matched > 0) return <StatusBadge status="PARTIALLY_MATCHED" />;
        return <StatusBadge status="UNMATCHED" />;
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(row)}>
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Status"
        subtitle="View payment and invoice status (Read-Only)"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Payment Status' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoice Amount"
          value={`IDR ${formatCurrency(totalInvoiced)}`}
          icon={FileText}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Paid"
          value={`IDR ${formatCurrency(totalPaid)}`}
          icon={CheckCircle2}
          gradient
          className="from-green-500 to-green-600"
        />
        <StatCard
          title="Outstanding"
          value={`IDR ${formatCurrency(totalOutstanding)}`}
          icon={TrendingDown}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Overdue Invoices"
          value={overdueInvoices}
          subtitle={overdueInvoices > 0 ? 'Requires attention' : 'All current'}
          icon={AlertTriangle}
          gradient
          className={overdueInvoices > 0 ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Contracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ISSUED">Issued</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const csv = [
                  ['Invoice Number', 'Period', 'Amount', 'Paid', 'Outstanding', 'Status'].join(','),
                  ...filteredInvoices.map(i => [
                    i.invoice_number, i.period, i.total_amount, i.paid_amount, i.outstanding_amount, i.status
                  ].join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'payment-status.csv';
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        isLoading={loading}
        emptyMessage="No invoices found"
      />

      {/* Invoice Detail */}
      {selectedInvoice && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Invoice Detail - {selectedInvoice.invoice_number}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">Period</p>
                <p className="font-semibold mt-1">{selectedInvoice.period}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-semibold mt-1">{selectedInvoice.due_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Currency</p>
                <p className="font-semibold mt-1">{selectedInvoice.currency || 'IDR'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Total Invoice</p>
                <p className="text-xl font-bold text-gray-900">
                  IDR {(selectedInvoice.total_amount || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Total Paid</p>
                <p className="text-xl font-bold text-green-600">
                  IDR {(selectedInvoice.paid_amount || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Outstanding</p>
                <p className="text-xl font-bold text-orange-600">
                  IDR {(selectedInvoice.outstanding_amount || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold mb-3">Payment History</h4>
              {getInvoicePayments(selectedInvoice.id).length === 0 ? (
                <p className="text-center text-gray-500 py-8">No payments recorded</p>
              ) : (
                <div className="space-y-2">
                  {getInvoicePayments(selectedInvoice.id).map((payment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{payment.payment_ref}</p>
                        <p className="text-sm text-gray-500">{payment.payment_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">IDR {(payment.amount || 0).toLocaleString()}</span>
                        <StatusBadge status={payment.match_status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}