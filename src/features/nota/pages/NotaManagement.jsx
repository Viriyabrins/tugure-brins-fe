import React, { useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import NotaPDFTemplate from "../components/NotaPDFTemplate";
import NotaDetailPreview from "../components/NotaDetailPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
    CheckCircle2, RefreshCw, ArrowRight, Loader2, Eye, FileText, Clock,
    DollarSign, AlertTriangle, Scale, Plus, AlertCircle, Lock, Check, Download,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { formatRupiahAdaptive } from "@/utils/currency";
import {
    DEFAULT_NOTA_FILTER, DEFAULT_DNCN_FILTER, NOTA_PAGE_SIZE,
    getNotaAmount, getNextStatus, isBrinsRole,
} from "../utils/notaConstants";
import { useNotaData } from "../hooks/useNotaData";
import { useNotaActions } from "../hooks/useNotaActions";
import { notaService } from "../services/notaService";

// ─── Payment calculation display ─────────────────────────────────────────────

function parseNumberSafe(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return isNaN(value) || !isFinite(value) ? 0 : value;
    const cleaned = value.toString().trim().replace(/,/g, "").replace(/[^\d.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) || !isFinite(num) ? 0 : num;
}

function PaymentCalculationDisplay({ paymentAmount, previousPaid, notaAmount }) {
    const paid = parseNumberSafe(paymentAmount);
    const prev = parseNumberSafe(previousPaid) || 0;
    const nota = parseNumberSafe(notaAmount) || 0;
    const newTotal = prev + paid;
    const diff = nota - newTotal;
    const isMatched = Math.abs(diff) <= 1000;
    const diffStatus = diff > 1000 ? "PARTIAL" : diff < -1000 ? "OVERPAID" : "";
    return (
        <div className="mt-2 p-3 rounded-lg border-2" style={{ backgroundColor: isMatched ? "#d1fae5" : "#fed7aa", borderColor: isMatched ? "#10b981" : "#f59e0b" }}>
            <div className="text-sm font-semibold">New Total Paid: Rp {newTotal.toLocaleString("id-ID")}</div>
            <div className="text-xs mt-1">
                {isMatched ? "✓ MATCHED - Nota will auto-close" : `⚠️ ${diffStatus} - Difference: Rp ${Math.abs(diff).toLocaleString("id-ID")}`}
            </div>
            {paid < 0 && <div className="text-xs mt-1 text-red-600">⚠️ Negative payment (adjustment) will reduce total paid</div>}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotaManagement() {
    const data = useNotaData();
    const {
        user, tokenRoles, auditActor,
        notas, totalNotas, notaPage, setNotaPage,
        batches, contracts, payments, paymentIntents, dnCnRecords, debtors, subrogations,
        loading, filters, setFilters,
        canManageNotaActions,
        reconciliationItems, exceptionItems,
        loadData, loadNotas,
    } = data;

    const actions = useNotaActions({
        user, auditActor, notas, dnCnRecords, loadData, loadNotas, notaPage, filters,
    });

    const [activeTab, setActiveTab] = useState("notas");
    const [dnCnFilters, setDnCnFilters] = useState(DEFAULT_DNCN_FILTER);
    const [reconFilters, setReconFilters] = useState({ contract: "all", status: "all", hasException: "all" });
    const [pdfPreview, setPdfPreview] = useState(/** @type {{ nota: any, contract: any } | null} */(null));
    const [pdfDownloading, setPdfDownloading] = useState(false);
    const [bulkPdfDownloading, setBulkPdfDownloading] = useState(false);
    const pdfContainerRef = useRef(/** @type {HTMLDivElement | null} */(null));
    const [selectedNotas, setSelectedNotas] = useState(/** @type {string[]} */([]));
    const [actionContract, setActionContract] = useState(null);

    function toggleNotaSelection(notaNumber) {
        setSelectedNotas((prev) =>
            prev.includes(notaNumber) ? prev.filter((n) => n !== notaNumber) : [...prev, notaNumber]
        );
    }

    function toggleAllNotaSelection(checked, unpaidNotas) {
        setSelectedNotas(checked ? unpaidNotas.map((/** @type {any} */ n) => n.nota_number) : []);
    }

    // Derived nota lists per tab
    const activeCategoryNotas = notas.filter((n) => {
        if (activeTab === "notas") return n.nota_type === "Batch" || n.nota_type === "INVOICE";
        if (activeTab === "claim") return n.nota_type === "Claim";
        if (activeTab === "subrogation") return n.nota_type === "Subrogation";
        return true;
    });
    const filteredNotas = activeCategoryNotas.filter((n) => {
        if (filters.contract !== "all" && n.contract_id !== filters.contract) return false;
        if (filters.status !== "all" && n.status !== filters.status) return false;
        return true;
    });
    const filteredExceptions = exceptionItems.filter((r) => {
        if (dnCnFilters.contract !== "all" && r.contract_id !== dnCnFilters.contract) return false;
        if (dnCnFilters.status !== "all" && r.reconciliation_status !== dnCnFilters.status) return false;
        return true;
    });

    const notaPagination = {
        from: totalNotas === 0 ? 0 : (notaPage - 1) * NOTA_PAGE_SIZE + 1,
        to: Math.min(totalNotas, notaPage * NOTA_PAGE_SIZE),
        total: totalNotas,
        page: notaPage,
        totalPages: Math.max(1, Math.ceil(totalNotas / NOTA_PAGE_SIZE)),
    };

    const typeLabel = activeTab === "claim" ? "claim" : activeTab === "subrogation" ? "subrogation" : "batch";

    // Nota tab columns
    const unpaidFilteredNotas = filteredNotas.filter((n) => n.status === "UNPAID");
    const notaColumns = [
        // Checkbox column — only for BRINS roles
        ...(isBrinsRole(tokenRoles) ? [{
            header: (
                <Checkbox
                    checked={unpaidFilteredNotas.length > 0 && unpaidFilteredNotas.every((n) => selectedNotas.includes(n.nota_number))}
                    onCheckedChange={(checked) => toggleAllNotaSelection(checked, unpaidFilteredNotas)}
                />
            ),
            cell: (row) => row.status === "UNPAID" ? (
                <Checkbox
                    checked={selectedNotas.includes(row.nota_number)}
                    onCheckedChange={() => toggleNotaSelection(row.nota_number)}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <Checkbox disabled checked={false} />
            ),
            width: "40px",
        }] : []),
        {
            header: "Nota Number",
            cell: (row) => (
                <div>
                    <p className="font-medium font-mono">{row.nota_number}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{row.nota_type}</Badge>
                    </div>
                </div>
            ),
        },
        { header: "Reference", cell: (row) => <span className="text-sm">{row.reference_id}</span> },
        {
            header: "Amount",
            cell: (row) => <span className="font-bold">{formatRupiahAdaptive(getNotaAmount(row, debtors))}</span>,
        },
        {
            header: "Payment Status",
            cell: (row) => row.status === "PAID"
                ? <Badge variant="default" className="bg-green-600">PAID</Badge>
                : <Badge variant="outline" className="text-orange-600 border-orange-300">UNPAID</Badge>,
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { actions.setSelectedNota(row); actions.setShowViewDialog(true); }}>
                        <Eye className="w-4 h-4 mr-1" />View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenPDFPreview(row)}>
                        <Download className="w-4 h-4 mr-1" />PDF
                    </Button>
                </div>
            ),
        },
    ];

    async function handleOpenPDFPreview(row) {
        let contract = null;
        try {
            contract = await notaService.getMasterContract(row.contract_id);
        } catch (e) {
            console.warn("[PDF Preview] Could not fetch MasterContract:", e);
        }
        setPdfPreview({ nota: row, contract });
    }

    async function handleDownloadFromPreview() {
        if (!pdfPreview || !pdfContainerRef.current) return;
        setPdfDownloading(true);
        try {
            const container = pdfContainerRef.current;
            const root = createRoot(container);

            // Render template and wait two frames for React to flush
            await new Promise((resolve) => {
                root.render(<NotaPDFTemplate nota={pdfPreview.nota} contract={pdfPreview.contract} />);
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            // Wait for <img> tags to finish loading
            const imgs = [...container.querySelectorAll("img")];
            if (imgs.length > 0) {
                await Promise.all(
                    imgs.map((img) =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise((r) => { img.onload = r; img.onerror = r; })
                    )
                );
            }

            // scale: 1.5 + JPEG 88% quality  →  ~5-10× smaller than PNG at scale 2
            const captureTarget = /** @type {HTMLElement} */ (container.firstChild);
            const canvas = await html2canvas(captureTarget, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
            });

            const pdf = new jsPDF("p", "mm", "a4");
            const imgData = canvas.toDataURL("image/jpeg", 0.88);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${pdfPreview.nota.nota_number}.pdf`);

            root.unmount();
            actions.setSuccessMessage("PDF downloaded successfully");
            setPdfPreview(null);
        } catch (e) {
            console.error("Failed to generate PDF:", e);
            actions.setSuccessMessage("Failed to generate PDF");
        } finally {
            setPdfDownloading(false);
        }
    }

    async function handleBulkPaidDownload() {
        if (!pdfContainerRef.current || selectedNotas.length === 0) return;
        setBulkPdfDownloading(true);
        try {
            const container = pdfContainerRef.current;
            const root = createRoot(container);
            const bulkNotas = notas.filter((n) => selectedNotas.includes(n.nota_number));

            await new Promise((resolve) => {
                root.render(<NotaPDFTemplate notas={bulkNotas} />);
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            const imgs = [...container.querySelectorAll("img")];
            if (imgs.length > 0) {
                await Promise.all(
                    imgs.map((img) =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise((r) => { img.onload = r; img.onerror = r; })
                    )
                );
            }

            const captureTarget = /** @type {HTMLElement} */ (container.firstChild);
            const canvas = await html2canvas(captureTarget, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
            });

            const pdf = new jsPDF("p", "mm", "a4");
            const imgData = canvas.toDataURL("image/jpeg", 0.88);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`treaty-note-bulk-${selectedNotas.length}-notas.pdf`);

            root.unmount();
            actions.setSuccessMessage("PDF downloaded successfully");
        } catch (e) {
            console.error("Failed to generate bulk PDF:", e);
            actions.setSuccessMessage("Failed to generate PDF");
        } finally {
            setBulkPdfDownloading(false);
        }
    }

    function renderNotaTabContent() {
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <GradientStatCard title="Total Notas" value={activeCategoryNotas.length} subtitle={`${activeCategoryNotas.length} ${typeLabel} notas`} icon={FileText} gradient="from-blue-500 to-blue-600" />
                    <GradientStatCard title="Pending" value={activeCategoryNotas.filter((n) => n.status === "UNPAID").length} subtitle="Awaiting payment" icon={Clock} gradient="from-orange-500 to-orange-600" />
                    <GradientStatCard title="Total Amount" value={formatRupiahAdaptive(activeCategoryNotas.reduce((s, n) => s + getNotaAmount(n, debtors), 0))} subtitle={`All ${typeLabel} notas`} icon={DollarSign} gradient="from-green-500 to-green-600" />
                    <GradientStatCard title="Closed" value={activeCategoryNotas.filter((n) => n.status === "Nota Closed").length} subtitle={formatRupiahAdaptive(activeCategoryNotas.filter((n) => n.status === "Nota Closed").reduce((s, n) => s + getNotaAmount(n, debtors), 0))} icon={CheckCircle2} gradient="from-purple-500 to-purple-600" />
                </div>
                <FilterTab
                    filters={filters}
                    onFilterChange={(f) => { setFilters(f); setSelectedNotas([]); }}
                    defaultFilters={{ contract: "all", status: "all" }}
                    filterConfig={[
                        {
                            key: "contract", label: "Contract",
                            options: [{ value: "all", label: "All Contracts" }, ...contracts.map((c) => ({ value: c.id || c.contract_id, label: c.contract_id || c.id || "Unknown Contract" }))],
                        },
                        {
                            key: "status", label: "Status",
                            options: [{ value: "all", label: "All Status" }, { value: "UNPAID", label: "UNPAID" }, { value: "PAID", label: "PAID" }],
                        },
                    ]}
                />
                {isBrinsRole(tokenRoles) && selectedNotas.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={() => actions.setShowBulkPaidDialog(true)}>
                            <Check className="w-4 h-4 mr-2" />Mark as Paid ({selectedNotas.length})
                        </Button>
                        <Button variant="ghost" onClick={() => setSelectedNotas([])}>
                            Clear selection
                        </Button>
                    </div>
                )}
                <DataTable
                    columns={notaColumns}
                    data={filteredNotas}
                    isLoading={loading}
                    emptyMessage={`No ${typeLabel} notas found`}
                    onRowClick={() => {}}
                    pagination={notaPagination}
                    onPageChange={(page) => { setNotaPage(page); setSelectedNotas([]); }}
                />
            </>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Nota Management"
                subtitle="Manage notas, reconciliation, and Exception adjustments"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Nota Management" }]}
                actions={
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw className="w-4 h-4 mr-2" />Refresh
                    </Button>
                }
            />

            {actions.successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">{actions.successMessage}</AlertDescription>
                </Alert>
            )}

            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedNotas([]); }}>
                <TabsList className="grid w-full max-w-4xl grid-cols-3">
                    <TabsTrigger value="notas">Premi</TabsTrigger>
                    <TabsTrigger value="claim">Claim</TabsTrigger>
                    <TabsTrigger value="subrogation">Subrogation</TabsTrigger>
                </TabsList>

                <TabsContent value="notas" className="space-y-6">{renderNotaTabContent()}</TabsContent>
                <TabsContent value="claim" className="space-y-6">{renderNotaTabContent()}</TabsContent>
                <TabsContent value="subrogation" className="space-y-6">{renderNotaTabContent()}</TabsContent>

                {/* Exception tab */}
                <TabsContent value="exception" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <GradientStatCard title="Total Exceptions" value={exceptionItems.length} subtitle={`${filteredExceptions.length} visible`} icon={FileText} gradient="from-blue-500 to-blue-600" />
                        <GradientStatCard title="Final Pending" value={exceptionItems.filter((r) => r.recon_status === "FINAL").length} subtitle="Ready for Exception" icon={Clock} gradient="from-orange-500 to-orange-600" />
                        <GradientStatCard title="Total Difference" value={formatRupiahAdaptive(exceptionItems.reduce((s, r) => s + (r.difference || 0), 0))} subtitle="sum of differences" icon={AlertTriangle} gradient="from-red-500 to-red-600" />
                        <GradientStatCard title="Affected Notas" value={new Set(exceptionItems.map((r) => r.nota_number)).size} subtitle="unique notas" icon={DollarSign} gradient="from-purple-500 to-purple-600" />
                    </div>
                    <FilterTab filters={dnCnFilters} onFilterChange={setDnCnFilters} defaultFilters={DEFAULT_DNCN_FILTER}
                        filterConfig={[
                            { key: "contract", label: "Contract", options: [{ value: "all", label: "All Contracts" }, ...contracts.map((c) => ({ value: c.id || c.contract_id, label: c.contract_id || c.id || "Unknown Contract" }))] },
                            { key: "status", label: "Recon Status", options: [{ value: "all", label: "All Status" }, { value: "UNPAID", label: "UNPAID" }, { value: "PAID", label: "PAID" }] },
                        ]}
                    />
                    <DataTable
                        columns={[
                            {
                                header: "Nota",
                                cell: (row) => (
                                    <div>
                                        <div className="font-medium font-mono">{row.nota_number}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">{row.nota_type}</Badge>
                                            <span className="text-xs text-gray-500">{row.reference_id}</span>
                                        </div>
                                    </div>
                                ),
                            },
                            { header: "Batch ID", accessorKey: "batch_id" },
                            { header: "Nota Amount", cell: (row) => <div>{formatRupiahAdaptive(getNotaAmount(row, debtors))}</div> },
                            { header: "Paid", cell: (row) => <div className="text-green-600 font-bold">{formatRupiahAdaptive(row.payment_received || row.total_actual_paid || 0)}</div> },
                            { header: "Difference", cell: (row) => <div className="text-red-600 font-bold">{formatRupiahAdaptive(row.difference || (row.amount || 0) - (row.payment_received || row.total_actual_paid || 0))}</div> },
                            { header: "Recon Status", cell: (row) => <StatusBadge status={row.reconciliation_status || row.recon_status} /> },
                            {
                                header: "Actions",
                                cell: (row) => (
                                    <div className="flex gap-1 flex-wrap">
                                        <Button variant="outline" size="sm" onClick={() => { actions.setSelectedNota(row); actions.setShowViewDialog(true); }}>
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        {canManageNotaActions && (row.reconciliation_status === "FINAL" || row.recon_status === "FINAL") && (
                                            <Button size="sm" variant="outline" className="text-orange-600 border-orange-300"
                                                onClick={() => {
                                                    actions.setSelectedNota(row);
                                                    const diff = row.difference || (row.amount || 0) - (row.payment_received || row.total_actual_paid || 0);
                                                    actions.setDnCnFormData({ note_type: diff > 0 ? "Debit Note" : "Credit Note", adjustment_amount: Math.abs(diff), reason_code: "Payment Difference", reason_description: `${diff > 0 ? "Underpayment" : "Overpayment"} of Rp ${Math.abs(diff).toLocaleString()}` });
                                                    actions.setShowDnCnDialog(true);
                                                }}
                                            >
                                                <Plus className="w-4 h-4 mr-1" />Exception
                                            </Button>
                                        )}
                                        {canManageNotaActions && (row.reconciliation_status === "MATCHED" || row.recon_status === "MATCHED" || dnCnRecords.some((d) => d.original_nota_id === row.nota_number && d.status === "Approved")) && row.status !== "PAID" && (
                                            <Button size="sm" className="bg-green-600" onClick={() => actions.handleCloseNota(row)}>
                                                <CheckCircle2 className="w-4 h-4 mr-1" />Close Nota
                                            </Button>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredExceptions}
                        isLoading={loading}
                        emptyMessage="No exceptions"
                    />
                </TabsContent>
            </Tabs>

            {/* ── Record Payment Dialog ──────────────────────────────────────── */}
            <Dialog open={actions.showPaymentDialog} onOpenChange={actions.setShowPaymentDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Record Actual Payment</DialogTitle>
                        <DialogDescription>Nota: {actions.selectedRecon?.nota_number}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-600">Nota Amount:</span>
                                    <div className="font-bold text-blue-600 text-lg">Rp {parseNumberSafe(actions.selectedRecon?.amount).toLocaleString("id-ID")}</div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Total Planned:</span>
                                    <div className="font-medium text-gray-600 text-lg">Rp {parseNumberSafe(actions.selectedRecon?.total_planned || 0).toLocaleString("id-ID")}</div>
                                    <div className="text-xs text-gray-500">{actions.selectedRecon?.intent_count} intent(s)</div>
                                </div>
                                <div>
                                    <span className="text-gray-600">Already Paid:</span>
                                    <div className="font-bold text-green-600 text-lg">Rp {parseNumberSafe(actions.selectedRecon?.total_actual_paid || 0).toLocaleString("id-ID")}</div>
                                    <div className="text-xs text-gray-500">{actions.selectedRecon?.payment_count} payment(s)</div>
                                </div>
                            </div>
                        </div>
                        <Alert className="bg-blue-50 border-blue-200">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                <strong>Payment Status Rules:</strong><br />
                                • PARTIAL: Actual Paid &lt; Nota Amount<br />
                                • MATCHED: Actual Paid = Nota Amount (auto-close)<br />
                                • OVERPAID: Actual Paid &gt; Nota Amount (Exception required)
                            </AlertDescription>
                        </Alert>
                        <div>
                            <Label>Actual Paid Amount (Rp) *</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={actions.paymentFormData.actual_paid_amount}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
                                            actions.setPaymentFormData({ ...actions.paymentFormData, actual_paid_amount: v });
                                        }
                                    }}
                                    placeholder="Enter amount (positive or negative)"
                                    className="flex-1"
                                />
                                <div className="flex flex-col gap-1">
                                    <Button type="button" variant="outline" size="sm" className="h-5 w-8 p-0"
                                        onClick={() => {
                                            const c = parseNumberSafe(actions.paymentFormData.actual_paid_amount);
                                            actions.setPaymentFormData({ ...actions.paymentFormData, actual_paid_amount: (c + 1).toString() });
                                        }}>▲</Button>
                                    <Button type="button" variant="outline" size="sm" className="h-5 w-8 p-0"
                                        onClick={() => {
                                            const c = parseNumberSafe(actions.paymentFormData.actual_paid_amount);
                                            actions.setPaymentFormData({ ...actions.paymentFormData, actual_paid_amount: (c - 1).toString() });
                                        }}>▼</Button>
                                </div>
                            </div>
                            {actions.paymentFormData.actual_paid_amount && (
                                <PaymentCalculationDisplay
                                    paymentAmount={actions.paymentFormData.actual_paid_amount}
                                    previousPaid={actions.selectedRecon?.total_actual_paid}
                                    notaAmount={actions.selectedRecon?.amount}
                                />
                            )}
                        </div>
                        <div>
                            <Label>Payment Date *</Label>
                            <Input type="date" value={actions.paymentFormData.payment_date}
                                onChange={(e) => actions.setPaymentFormData({ ...actions.paymentFormData, payment_date: e.target.value })} />
                        </div>
                        <div>
                            <Label>Bank Reference / Transaction ID *</Label>
                            <Input value={actions.paymentFormData.bank_reference}
                                onChange={(e) => actions.setPaymentFormData({ ...actions.paymentFormData, bank_reference: e.target.value })}
                                placeholder="e.g., TRX-20250124-001" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowPaymentDialog(false); actions.setPaymentFormData({ actual_paid_amount: "", payment_date: new Date().toISOString().split("T")[0], bank_reference: "" }); }}>Cancel</Button>
                        <Button onClick={actions.handleRecordPayment} disabled={actions.processing || !actions.paymentFormData.actual_paid_amount || !actions.paymentFormData.bank_reference} className="bg-blue-600">
                            {actions.processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Record Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Exception Creation Dialog ──────────────────────────────────── */}
            <Dialog open={actions.showDnCnDialog} onOpenChange={actions.setShowDnCnDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Debit / Credit Note</DialogTitle>
                        <DialogDescription>For Nota: {actions.selectedNota?.nota_number}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Prerequisites:</strong><br />
                                ✓ Reconciliation must be marked FINAL<br />
                                ✓ Payment difference must exist<br /><br />
                                <strong>Original Nota remains UNCHANGED.</strong>
                            </AlertDescription>
                        </Alert>
                        {actions.selectedNota && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Nota Amount:</span><span className="ml-2 font-bold">Rp {(actions.selectedNota.amount || 0).toLocaleString()}</span></div>
                                    <div><span className="text-gray-500">Actual Paid:</span><span className="ml-2 font-bold text-green-600">Rp {(actions.selectedNota.total_actual_paid || 0).toLocaleString()}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Difference:</span><span className="ml-2 font-bold text-red-600">Rp {Math.abs((actions.selectedNota.amount || 0) - (actions.selectedNota.total_actual_paid || 0)).toLocaleString()}</span></div>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Note Type *</Label>
                            <Select value={actions.dnCnFormData.note_type} onValueChange={(v) => actions.setDnCnFormData({ ...actions.dnCnFormData, note_type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Debit Note">Debit Note (Underpayment - increase amount)</SelectItem>
                                    <SelectItem value="Credit Note">Credit Note (Overpayment - decrease amount)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Adjustment Amount (IDR) *</Label>
                            <Input type="number" value={actions.dnCnFormData.adjustment_amount}
                                onChange={(e) => actions.setDnCnFormData({ ...actions.dnCnFormData, adjustment_amount: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <Label>Reason Code *</Label>
                            <Select value={actions.dnCnFormData.reason_code} onValueChange={(v) => actions.setDnCnFormData({ ...actions.dnCnFormData, reason_code: v })}>
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
                            <Textarea value={actions.dnCnFormData.reason_description}
                                onChange={(e) => actions.setDnCnFormData({ ...actions.dnCnFormData, reason_description: e.target.value })}
                                placeholder="Explain the reason for this adjustment..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowDnCnDialog(false)}>Cancel</Button>
                        <Button onClick={actions.handleCreateDnCn} disabled={actions.processing || !actions.dnCnFormData.reason_description}>
                            {actions.processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                            Create Exception
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Exception Action Dialog ────────────────────────────────────── */}
            <Dialog open={actions.showDnCnActionDialog} onOpenChange={actions.setShowDnCnActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actions.actionType} Exception</DialogTitle>
                        <DialogDescription>{actions.selectedDnCn?.note_number}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {actions.selectedDnCn && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Type:</span><span className="ml-2 font-medium">{actions.selectedDnCn.note_type}</span></div>
                                    <div><span className="text-gray-500">Adjustment:</span><span className="ml-2 font-bold">Rp {Math.abs(actions.selectedDnCn.adjustment_amount || 0).toLocaleString()}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Original Nota:</span><span className="ml-2 font-medium">{actions.selectedDnCn.original_nota_id}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Reason:</span><span className="ml-2 font-medium">{actions.selectedDnCn.reason_description}</span></div>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Remarks</Label>
                            <Textarea value={actions.remarks} onChange={(e) => actions.setRemarks(e.target.value)} placeholder="Enter remarks..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowDnCnActionDialog(false)}>Cancel</Button>
                        <Button onClick={() => actions.handleDnCnAction(actions.selectedDnCn, actions.actionType)} disabled={actions.processing}>
                            {actions.processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirm {actions.actionType}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Nota Action Dialog ─────────────────────────────────────────── */}
            <Dialog open={actions.showActionDialog} onOpenChange={actions.setShowActionDialog}>
                <DialogContent className="max-w-2xl w-full" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <DialogHeader>
                        <DialogTitle>{actions.actionType}</DialogTitle>
                        <DialogDescription>
                            Move nota {actions.selectedNota?.nota_number} from {actions.selectedNota?.status} to {getNextStatus(actions.selectedNota?.status)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {getNextStatus(actions.selectedNota?.status) === "Issued" && (
                            <Alert variant="destructive">
                                <Lock className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Warning:</strong> After issuing, Nota amount becomes IMMUTABLE. Any adjustments must be done via Exception.
                                </AlertDescription>
                            </Alert>
                        )}
                        <NotaDetailPreview nota={actions.selectedNota} contract={actionContract} />
                        <div>
                            <Label>Remarks</Label>
                            <Textarea value={actions.remarks} onChange={(e) => actions.setRemarks(e.target.value)} placeholder="Enter remarks..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowActionDialog(false)}>Cancel</Button>
                        <Button onClick={actions.handleNotaAction} disabled={actions.processing} className="bg-blue-600 hover:bg-blue-700">
                            {actions.processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><ArrowRight className="w-4 h-4 mr-2" />{actions.actionType}</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Dialog ────────────────────────────────────────────────── */}
            <Dialog open={actions.showViewDialog} onOpenChange={actions.setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actions.selectedNota ? "Nota Detail" : "Debit/Credit Note Detail"}</DialogTitle>
                        <DialogDescription>{actions.selectedNota?.nota_number || actions.selectedDnCn?.note_number}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {actions.selectedNota && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Type:</span><Badge className="ml-2">{actions.selectedNota.nota_type}</Badge></div>
                                    <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">{formatRupiahAdaptive(actions.selectedNota.amount)}</span></div>
                                    <div><span className="text-gray-500">Status:</span><span className="ml-2"><StatusBadge status={actions.selectedNota.status} /></span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Reference:</span><span className="ml-2 font-medium">{actions.selectedNota.reference_id}</span></div>
                                </div>
                            </div>
                        )}
                        {actions.selectedDnCn && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Type:</span><Badge className={actions.selectedDnCn?.note_type === "Debit Note" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}>{actions.selectedDnCn?.note_type}</Badge></div>
                                    <div><span className="text-gray-500">Adjustment:</span><span className="ml-2 font-bold">Rp {Math.abs(actions.selectedDnCn.adjustment_amount || 0).toLocaleString()}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Original Nota:</span><span className="ml-2 font-medium">{actions.selectedDnCn.original_nota_id}</span></div>
                                    <div className="col-span-2"><span className="text-gray-500">Reason:</span><span className="ml-2 font-medium">{actions.selectedDnCn.reason_description}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowViewDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Bulk Mark Paid Dialog ──────────────────────────────────────── */}
            <Dialog open={actions.showBulkPaidDialog} onOpenChange={actions.setShowBulkPaidDialog}>
                <DialogContent className="max-w-[720px]" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <DialogHeader>
                        <DialogTitle>Mark Selected Notas as Paid</DialogTitle>
                        <DialogDescription>{selectedNotas.length} nota(s) will be marked as PAID</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Alert className="border-blue-200 bg-blue-50">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                All selected notas will be updated atomically. If any update fails, all changes will be rolled back.
                            </AlertDescription>
                        </Alert>
                        <div style={{ overflowY: "auto", maxHeight: "55vh", background: "#f3f4f6", padding: "8px", borderRadius: "4px" }}>
                            <div style={{ width: `${Math.round(794 * 0.82)}px`, overflow: "hidden", margin: "0 auto" }}>
                                <div style={{ transform: "scale(0.82)", transformOrigin: "top left" }}>
                                    <NotaPDFTemplate notas={notas.filter((n) => selectedNotas.includes(n.nota_number))} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowBulkPaidDialog(false)} disabled={actions.processing}>Cancel</Button>
                        <Button variant="outline" onClick={handleBulkPaidDownload} disabled={bulkPdfDownloading || actions.processing}>
                            {bulkPdfDownloading
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                                : <><Download className="w-4 h-4 mr-2" />Download PDF</>}
                        </Button>
                        <Button onClick={() => actions.handleBulkMarkPaid(selectedNotas, setSelectedNotas)} disabled={actions.processing} className="bg-green-600 hover:bg-green-700">
                            {actions.processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Check className="w-4 h-4 mr-2" />Confirm</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Nota Status Change Dialog ──────────────────────────────────── */}
            <Dialog open={actions.showNotaStatusDialog} onOpenChange={actions.setShowNotaStatusDialog}>
                <DialogContent className="max-w-2xl w-full" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <DialogHeader>
                        <DialogTitle>Confirm Payment</DialogTitle>
                        <DialogDescription>Mark Nota {actions.selectedNotaForStatus?.nota_number} as Paid</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <NotaDetailPreview nota={actions.selectedNotaForStatus} contract={actionContract} />
                        <Alert className="border-blue-200 bg-blue-50">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">Status will be changed from UNPAID to PAID</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowNotaStatusDialog(false); actions.setSelectedNotaForStatus(null); }} disabled={actions.processing}>Cancel</Button>
                        <Button onClick={actions.handleChangeNotaStatus} disabled={actions.processing}>
                            {actions.processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Check className="w-4 h-4 mr-2" />Confirm Payment</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── PDF Preview Dialog ─────────────────────────────────────────── */}
            <Dialog open={!!pdfPreview} onOpenChange={(open) => { if (!open) setPdfPreview(null); }}>
                <DialogContent className="max-w-[720px]">
                    <DialogHeader>
                        <DialogTitle>PDF Preview — {pdfPreview?.nota?.nota_number}</DialogTitle>
                    </DialogHeader>
                    {/* Scaled preview — actual capture uses the hidden off-screen container */}
                    <div style={{ overflowY: "auto", maxHeight: "70vh", background: "#f3f4f6", padding: "8px", borderRadius: "4px" }}>
                        <div style={{
                            width: `${Math.round(794 * 0.82)}px`,
                            height: `${Math.round(1123 * 0.82)}px`,
                            overflow: "hidden",
                            margin: "0 auto",
                        }}>
                            <div style={{ transform: "scale(0.82)", transformOrigin: "top left" }}>
                                {pdfPreview && (
                                    <NotaPDFTemplate nota={pdfPreview.nota} contract={pdfPreview.contract} />
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPdfPreview(null)}>Close</Button>
                        <Button onClick={handleDownloadFromPreview} disabled={pdfDownloading}>
                            {pdfDownloading
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                                : <><Download className="w-4 h-4 mr-2" />Download PDF</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden off-screen container for html2canvas capture */}
            <div
                ref={pdfContainerRef}
                style={{ position: "absolute", left: "-9999px", top: "0", overflow: "hidden", pointerEvents: "none" }}
                aria-hidden="true"
            />
        </div>
    );
}
