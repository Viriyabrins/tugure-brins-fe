import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Send, CheckCircle2, RefreshCw, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { formatRupiahAdaptive } from "@/utils/currency";
import { DEFAULT_PAYMENT_INTENT_FILTER, PAYMENT_TYPES, PAYMENT_INTENT_STATUSES } from "../utils/paymentIntentConstants";
import { paymentIntentService } from "../services/paymentIntentService";
import { usePaymentIntentData } from "../hooks/usePaymentIntentData";

export default function PaymentIntent() {
    const { notas, paymentIntents, contracts, loading, filters, setFilters, filteredIntents, selectedIntents, setSelectedIntents, toggleIntentSelection, toggleAllSelection, userEmail, userRole, canShowActionButtons, reload } = usePaymentIntentData();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedNota, setSelectedNota] = useState("");
    const [paymentType, setPaymentType] = useState("FULL");
    const [plannedAmount, setPlannedAmount] = useState("");
    const [plannedDate, setPlannedDate] = useState("");
    const [remarks, setRemarks] = useState("");
    const [processing, setProcessing] = useState(false);

    const resetForm = () => { setSelectedNota(""); setPaymentType("FULL"); setPlannedAmount(""); setPlannedDate(""); setRemarks(""); };

    const handleCreateIntent = async () => {
        if (!selectedNota || !plannedAmount || !plannedDate) { toast.error("Please fill all required fields"); return; }
        setProcessing(true);
        const nota = notas.find((n) => n.id === selectedNota || n.nota_number === selectedNota);
        if (!nota) { toast.error("Nota not found"); setProcessing(false); return; }
        const result = await paymentIntentService.createIntent({ nota, paymentType, plannedAmount, plannedDate, remarks, userEmail, userRole });
        if (result.blocked) {
            alert(`❌ BLOCKED: Payment Intent can only be created for ISSUED or CONFIRMED notas.\n\nCurrent nota status: ${result.status}\n\nPlease wait for Nota to reach Issued status first.`);
        } else {
            toast.success("Payment Intent created (planning only - record actual payment in Reconciliation)");
            setShowCreateDialog(false); resetForm(); reload();
        }
        setProcessing(false);
    };

    const handleAction = async (action, intent) => {
        setProcessing(true);
        try { await paymentIntentService[action](intent); toast.success(`Payment intent ${action}d`); reload(); } catch { toast.error(`Failed to ${action} payment intent`); }
        setProcessing(false);
    };

    const columns = [
        {
            header: <Checkbox checked={selectedIntents.length === filteredIntents.length && filteredIntents.length > 0} onCheckedChange={toggleAllSelection} />,
            cell: (row) => <Checkbox checked={selectedIntents.includes(row.intent_id || row.id)} onCheckedChange={() => toggleIntentSelection(row.intent_id || row.id)} />,
            width: "40px",
        },
        { header: "Intent ID", cell: (row) => row.intent_id || row.id },
        { header: "Nota Reference", cell: (row) => { const nota = notas.find((n) => n.id === row.invoice_id || n.nota_number === row.invoice_id); return nota?.nota_number || "-"; } },
        { header: "Type", cell: (row) => <StatusBadge status={row.payment_type} /> },
        { header: "Planned Amount", cell: (row) => formatRupiahAdaptive(row.planned_amount) },
        { header: "Planned Date", cell: (row) => row.planned_date },
        { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    {canShowActionButtons && row.status === "Issued" && <Button size="sm" className="bg-blue-600" onClick={() => handleAction("submitIntent", row)}>Submit</Button>}
                    {canShowActionButtons && row.status === "SUBMITTED" && (<>
                        <Button size="sm" className="bg-green-600" onClick={() => handleAction("approveIntent", row)}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction("rejectIntent", row)}>Reject</Button>
                    </>)}
                    {row.status === "APPROVED" && <span className="text-xs text-green-600">Approved - Ready for Matching</span>}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Payment Intent - Planning Stage"
                subtitle="⚠️ Payment Intent is PLANNING ONLY - does not mark payment as done. Record actual payments in Reconciliation."
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Payment Intent" }]}
                actions={canShowActionButtons && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={reload}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                        <Button variant="outline" onClick={() => setShowCreateDialog(true)}><DollarSign className="w-4 h-4 mr-2" />Create Intent</Button>
                    </div>
                )}
            />

            {notas.length === 0 && !loading && (
                <Alert className="bg-blue-50 border-blue-200"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">No Issued notas available. Please ensure Nota Management has Issued notas first.</AlertDescription></Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard title="Available Notas" value={notas.length} subtitle="Issued/Confirmed" icon={DollarSign} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Issued Intents" value={paymentIntents.filter((p) => p.status === "Issued").length} subtitle="Pending submission" icon={Clock} gradient="from-orange-500 to-orange-600" />
                <GradientStatCard title="Approved Intents" value={paymentIntents.filter((p) => p.status === "APPROVED").length} subtitle="Ready for matching" icon={CheckCircle2} gradient="from-green-500 to-green-600" />
                <GradientStatCard title="Total Planned" value={formatRupiahAdaptive(filteredIntents.reduce((sum, p) => sum + (Number(p.planned_amount) || 0), 0))} subtitle="Planned Payment Amount" icon={DollarSign} gradient="from-purple-500 to-purple-600" />
            </div>

            <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_PAYMENT_INTENT_FILTER}
                filterConfig={[
                    { key: "contract", label: "Contract", options: [{ value: "all", label: "All Contracts" }, ...contracts.map((c) => ({ value: c.id, label: c.contract_number }))] },
                    { key: "notaType", label: "Nota Type", options: [{ value: "all", label: "All Types" }, { value: "Batch", label: "Batch" }, { value: "Claim", label: "Claim" }, { value: "Subrogation", label: "Subrogation" }] },
                    { key: "status", label: "Intent Status", options: [{ value: "all", label: "All Status" }, ...PAYMENT_INTENT_STATUSES.map((s) => ({ value: s, label: s }))] },
                ]}
            />

            <DataTable columns={columns} data={filteredIntents} isLoading={loading} emptyMessage="No payment intents" />

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create Payment Intent</DialogTitle><DialogDescription>Plan payment for Issued nota</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Select Nota *</Label>
                            <Select value={selectedNota} onValueChange={(val) => { setSelectedNota(val); const nota = notas.find((n) => n.id === val); if (nota) setPlannedAmount(nota.amount?.toString() || ""); }}>
                                <SelectTrigger><SelectValue placeholder="Select nota" /></SelectTrigger>
                                <SelectContent>{notas.map((n) => <SelectItem key={n.id || n.nota_number} value={n.id || n.nota_number}>{n.nota_number} - {n.nota_type} - Rp {(n.amount || 0).toLocaleString("id-ID")} ({n.status})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Payment Type</Label>
                            <Select value={paymentType} onValueChange={setPaymentType}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "FULL" ? "Full Payment" : t === "PARTIAL" ? "Partial Payment" : "Instalment"}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><Label>Planned Amount (Rp) *</Label><Input type="number" value={plannedAmount} onChange={(e) => setPlannedAmount(e.target.value)} /></div>
                        <div><Label>Planned Date *</Label><Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} min={new Date().toISOString()} /></div>
                        <div><Label>Remarks</Label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></div>
                    </div>
                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Cancel</Button>
                            <Button onClick={handleCreateIntent} disabled={processing || !selectedNota || !plannedAmount || !plannedDate} className="bg-blue-600">
                                {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Create Intent
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
