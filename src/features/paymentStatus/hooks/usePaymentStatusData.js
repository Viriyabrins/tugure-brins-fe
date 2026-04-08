import { useState, useEffect, useMemo } from "react";
import { loadData } from "../services/paymentStatusService";

export function usePaymentStatusData() {
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [contractFilter, setContractFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await loadData();
            setInvoices(data.invoices);
            setPayments(data.payments);
            setContracts(data.contracts);
        } catch (err) {
            console.error("Failed to load payment status data:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        refresh();
    }, []);

    const getInvoicePayments = (invoiceId) =>
        payments.filter((p) => p.invoice_id === invoiceId);

    const filteredInvoices = useMemo(() => {
        return invoices.filter((i) => {
            if (contractFilter !== "all" && i.contract_id !== contractFilter)
                return false;
            if (statusFilter !== "all" && i.status !== statusFilter)
                return false;
            return true;
        });
    }, [invoices, contractFilter, statusFilter]);

    const totalInvoiced = useMemo(
        () => invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        [invoices],
    );
    const totalPaid = useMemo(
        () => invoices.reduce((sum, i) => sum + (i.paid_amount || 0), 0),
        [invoices],
    );
    const totalOutstanding = useMemo(
        () => invoices.reduce((sum, i) => sum + (i.outstanding_amount || 0), 0),
        [invoices],
    );
    const overdueInvoices = useMemo(
        () => invoices.filter((i) => i.status === "OVERDUE").length,
        [invoices],
    );

    return {
        invoices,
        payments,
        contracts,
        loading,
        selectedInvoice,
        setSelectedInvoice,
        contractFilter,
        setContractFilter,
        statusFilter,
        setStatusFilter,
        filteredInvoices,
        getInvoicePayments,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueInvoices,
        refresh,
    };
}
