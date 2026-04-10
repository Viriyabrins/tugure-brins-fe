import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
    RefreshCw, FileText, Users, AlertTriangle, Check, ShieldCheck, Eye,
    ChevronLeft, ChevronRight, History,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { backend } from "@/api/backendClient";
import { formatRupiahAdaptive } from "@/utils/currency";
import { DEFAULT_DEBTOR_FILTER, DEBTOR_PAGE_SIZE } from "../utils/debtorConstants";
import { useDebtorData } from "../hooks/useDebtorData";
import { useDebtorUpload } from "../hooks/useDebtorUpload";
import { useDebtorActions } from "../hooks/useDebtorActions";
import { useDebtorSSE } from "@/hooks/useDebtorSSE";

// ─── Template download helpers ───────────────────────────────────────────────

const PREVIEW_ALLOWED_KEYS = [
    "batch_id", "cover_id", "program_id", "nomor_rekening_pinjaman", "nomor_peserta",
    "loan_type", "cif_rekening_pinjaman", "jenis_pengajuan_desc", "jenis_covering_desc",
    "tanggal_mulai_covering", "tanggal_akhir_covering", "plafon", "nominal_premi",
    "premium_amount", "ric_amount", "net_premi", "unit_code", "unit_desc", "branch_desc",
    "region_desc", "nama_peserta", "alamat_usaha", "nomor_perjanjian_kredit",
    "tanggal_terima", "tanggal_validasi", "teller_premium_date", "status_aktif",
    "remark_premi", "flag_restruk", "kolektabilitas",
];

function getPreviewColumnKeys(previewData) {
    if (!previewData.length) return [];
    const first = previewData[0];
    return PREVIEW_ALLOWED_KEYS.filter((k) => k in first);
}

function formatHeaderName(key) {
    return key.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatCellValue(key, value) {
    if (value === null || value === undefined || value === "") return "-";
    if (
        key.includes("plafon") || key.includes("nominal") || key.includes("premium") ||
        key.includes("ric_") || key.includes("bf_") || key.includes("net_premi")
    ) {
        if (typeof value === "number") return formatRupiahAdaptive(value);
    }
    if ((key.includes("tanggal") || key.includes("date") || key.includes("_date")) &&
        typeof value === "string" && value.length >= 10) {
        return value.slice(0, 10);
    }
    if ((key.includes("percentage") || key.includes("pct")) && typeof value === "number") {
        return `${value.toFixed(2)}%`;
    }
    return String(value);
}

function handleDownloadTemplate() {
    const headers = [
        "BATCH_ID", "COVER_ID", "PROGRAM_ID", "NOMOR_REKENING_PINJAMAN", "NOMOR_PESERTA", "POLICY_NO",
        "LOAN_TYPE", "CIF_REKENING_PINJAMAN", "JENIS_PENGAJUAN_DESC", "JENIS_COVERING_DESC",
        "TANGGAL_MULAI_COVERING", "TANGGAL_AKHIR_COVERING", "PLAFON", "NOMINAL_PREMI", "PREMIUM",
        "KOMISI", "NET_PREMI", "NOMINAL_KOMISI_BROKER", "UNIT_CODE", "UNIT_DESC", "BRANCH_DESC",
        "REGION_DESC", "NAMA_PESERTA", "ALAMAT_USAHA", "NOMOR_PERJANJIAN_KREDIT",
        "TANGGAL_TERIMA", "TANGGAL_VALIDASI", "TELLER_PREMIUM_DATE",
        "STATUS_AKTIF", "REMARK_PREMI", "FLAG_RESTRUK", "KOLEKTABILITAS",
    ];
    const sampleData = Array.from({ length: 20 }, (_, i) => {
        const n = i + 1;
        const pi = n.toString().padStart(3, "0");
        const id = n.toString().padStart(5, "0");
        return [
            "BATCH-2026-03-999003", `11122${pi}`, "503", `002101007887${pi}`,
            `0000A.00031.2026.01.${id}.1.3`, `1117341013000${pi}`, "DL", `HBD70${pi}`,
            "New", "Conditional Covering", "01/01/2026", "01/03/2026",
            450000000, 12500000, 5312500, 1460937, 3851563, 119000,
            "0032", "KCP SURABAYA", "KC Surabaya", "Surabaya",
            `Dude ${n}`, `Jl. Landak. ${n}`, `PK-${pi}`,
            "2026-01-05", "2026-01-06", "2026-01-06",
            1, `BRISURF_COV_00501_002101000777${pi}_03`, 0, 1,
        ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Debtor Template");
    XLSX.writeFile(wb, "debtor_template.xlsx");
    toast.success("Template downloaded");
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SubmitDebtor() {
    const data = useDebtorData();
    const {
        user, auditActor, contracts, batches, debtors, totalDebtors,
        pageLoading, tableLoading, filters, setFilters, page, setPage,
        sortColumn, sortOrder, handleSort, error, setError,
        loadDebtors, loadInitialData,
        canShowActionButtons, isCheckerBrins, isApproverBrins,
    } = data;

    const [selectedDebtors, setSelectedDebtors] = useState([]);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [noteDialogOpen, setNoteDialogOpen] = useState(false);
    const [actionNote, setActionNote] = useState("");
    const [revisionDiffs, setRevisionDiffs] = useState([]);

    const upload = useDebtorUpload({
        user, auditActor, debtors, loadDebtors, loadInitialData,
    });

    const actions = useDebtorActions({
        user, auditActor, debtors, selectedDebtors, setSelectedDebtors,
        selectedContract: upload.selectedContract, loadDebtors, loadInitialData,
    });

    // SSE hook for real-time debtor updates
    useDebtorSSE(() => {
        loadDebtors(page, filters);
    });

    // Active contracts for upload dialog
    const activeContracts = contracts.filter((c) => c.status_approval === "APPROVED");

    // ─── Revision diffs effect ─────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        const fetchDiffs = async () => {
            if (!showDetailDialog || !selectedDebtor || (selectedDebtor?.version_no || 0) <= 1) {
                if (mounted) setRevisionDiffs([]);
                return;
            }
            try {
                const res = await backend.listPaginated("DebtorRevise", {
                    page: 1, limit: 100,
                    q: JSON.stringify({ nomor_peserta: selectedDebtor.nomor_peserta }),
                });
                if (!Array.isArray(res?.data) || !res.data.length) {
                    if (mounted) setRevisionDiffs([]);
                    return;
                }
                const prev = res.data[0];
                const excluded = new Set(["id", "created_at", "updated_at", "archived_at"]);
                const diffs = Object.keys(selectedDebtor)
                    .filter((k) => !excluded.has(k))
                    .reduce((acc, k) => {
                        const oldStr = prev[k] === null || prev[k] === undefined ? "" : String(prev[k]);
                        const newStr = selectedDebtor[k] === null || selectedDebtor[k] === undefined ? "" : String(selectedDebtor[k]);
                        if (oldStr !== newStr) acc.push({ key: k, old: oldStr || "-", new: newStr || "-" });
                        return acc;
                    }, []);
                if (mounted) setRevisionDiffs(diffs);
            } catch {
                if (mounted) setRevisionDiffs([]);
            }
        };
        fetchDiffs();
        return () => { mounted = false; };
    }, [showDetailDialog, selectedDebtor]);

    // ─── Derived display values ────────────────────────────────────────────
    const total = totalDebtors;
    const totalPages = Math.max(1, Math.ceil(total / DEBTOR_PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * DEBTOR_PAGE_SIZE + 1;
    const to = Math.min(total, page * DEBTOR_PAGE_SIZE);
    const pageData = Array.isArray(debtors) ? debtors : [];

    const kpis = {
        total,
        submitted: pageData.filter((d) => d.status === "SUBMITTED").length,
        checked_brins: pageData.filter((d) => d.status === "CHECKED_BRINS").length,
        approved_brins: pageData.filter((d) => d.status === "APPROVED_BRINS").length,
        approved: pageData.filter((d) => d.status === "APPROVED").length,
        revision: pageData.filter((d) => d.status === "REVISION").length,
    };

    function handleRefresh() {
        setError("");
        loadInitialData();
        loadDebtors(page, filters);
    }

    const previewKeys = getPreviewColumnKeys(upload.uploadPreviewData);

    const previewTotals = upload.uploadPreviewData.reduce(
        (acc, r) => {
            acc.totalNetPremi += parseFloat(r.net_premi) || 0;
            acc.totalKomisi += parseFloat(r.ric_amount) || 0;
            acc.totalPlafon += parseFloat(r.plafon) || 0;
            acc.totalNominalPremi += parseFloat(r.nominal_premi) || 0;
            return acc;
        },
        { totalNetPremi: 0, totalKomisi: 0, totalPlafon: 0, totalNominalPremi: 0 },
    );
    const previewBatchId = upload.uploadPreviewData[0]?.batch_id || "-";

    // Upload error view
    function formatUploadErrorView(message) {
        if (!message) return { title: "", items: [], summary: "" };
        const lines = String(message).split("\n").map((l) => l.trim()).filter(Boolean);
        const summary = lines[0] || "Upload failed.";
        const rowItems = lines.filter((l) => /^Row\s+\d+:/i.test(l));
        const items = (rowItems.length > 0 ? rowItems : lines.slice(1)).slice(0, 6);
        return { title: items.length ? "Please review the following issues:" : "", items, summary };
    }
    const uploadErrorView = formatUploadErrorView(upload.uploadError);

    // ─── Table columns ─────────────────────────────────────────────────────
    const columns = [
        {
            header: (
                <Checkbox
                    checked={selectedDebtors.length === pageData.length && pageData.length > 0}
                    onCheckedChange={(checked) =>
                        setSelectedDebtors(checked ? pageData.map((d) => d.id) : [])
                    }
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedDebtors.includes(row.id)}
                    onCheckedChange={(checked) =>
                        setSelectedDebtors(
                            checked
                                ? [...selectedDebtors, row.id]
                                : selectedDebtors.filter((id) => id !== row.id),
                        )
                    }
                />
            ),
            width: "50px",
        },
        {
            header: "Batch ID", accessorKey: "batch_id",
            cell: (row) => <span className="font-mono text-xs">{row.batch_id}</span>,
        },
        {
            header: "Nomor Peserta", accessorKey: "nomor_peserta",
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.nomor_peserta}</div>
                    <div className="text-xs text-gray-500">{row.nama_peserta}</div>
                </div>
            ),
        },
        {
            header: "Loan Info",
            cell: (row) => (
                <div className="text-sm">
                    <div>{row.loan_type}</div>
                    <div className="text-xs text-gray-500">{row.loan_type_desc}</div>
                </div>
            ),
        },
        {
            header: "Plafon", accessorKey: "plafon",
            cell: (row) => <div className="font-medium">{formatRupiahAdaptive(row.plafon)}</div>,
        },
        {
            header: "Net Premi", accessorKey: "net_premi",
            cell: (row) => <div className="font-medium">{formatRupiahAdaptive(row.net_premi)}</div>,
        },
        {
            header: "Status", accessorKey: "status",
            cell: (row) => <StatusBadge status={row.status} />,
        },
        {
            header: "Action",
            cell: (row) => (
                <Button variant="outline" size="sm"
                    onClick={() => { setSelectedDebtor(row); setShowDetailDialog(true); }}
                    title="View detail"
                >
                    <Eye className="w-4 h-4" />
                </Button>
            ),
            width: "80px",
        },
    ];

    if (pageLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Submit Debtor"
                subtitle="Upload and manage debtor submissions for reinsurance coverage"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Submit Debtor" }]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleRefresh}>
                            <RefreshCw className="w-4 h-4 mr-2" />Refresh
                        </Button>
                        {canShowActionButtons && (
                            <>
                                <Button variant="outline" onClick={handleDownloadTemplate}>
                                    <Download className="w-4 h-4 mr-2" />Download Template
                                </Button>
                                <Button variant="outline" onClick={() => upload.setUploadDialogOpen(true)}>
                                    <Upload className="w-4 h-4 mr-2" />Upload Debtors
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Success/Error messages */}
            {error && (
                <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <GradientStatCard title="Total" value={kpis.total} subtitle="Total Debtors" icon={Users} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Submitted" value={kpis.submitted} subtitle="Awaiting Check" icon={FileText} gradient="from-yellow-500 to-yellow-600" />
                <GradientStatCard title="Checked" value={kpis.checked_brins} subtitle="Checked by BRINS" icon={Check} gradient="from-cyan-500 to-cyan-600" />
                <GradientStatCard title="BRINS OK" value={kpis.approved_brins} subtitle="Approved by BRINS" icon={ShieldCheck} gradient="from-indigo-500 to-indigo-600" />
                <GradientStatCard title="Approved" value={kpis.approved} subtitle="Fully Approved" icon={CheckCircle2} gradient="from-green-500 to-green-600" />
                <GradientStatCard title="Revision" value={kpis.revision} subtitle="Needs Revision" icon={AlertTriangle} gradient="from-orange-500 to-orange-600" />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={DEFAULT_DEBTOR_FILTER}
                filterConfig={[
                    {
                        key: "contract", label: "Contract",
                        options: [
                            { value: "all", label: "All Contracts" },
                            ...contracts.map((c) => ({ value: c.contract_id, label: c.contract_id })),
                        ],
                    },
                    { key: "batch", label: "Batch ID", placeholder: "Search Batch...", type: "input", inputType: "text" },
                    {
                        key: "submitStatus", label: "Underwriting Status",
                        options: [
                            { value: "all", label: "All Statuses" },
                            { value: "SUBMITTED", label: "Submitted" },
                            { value: "CHECKED_BRINS", label: "Checked (BRINS)" },
                            { value: "APPROVED_BRINS", label: "Approved (BRINS)" },
                            { value: "APPROVED", label: "Approved (Final)" },
                            { value: "REVISION", label: "Revision" },
                        ],
                    },
                    { key: "name", placeholder: "Search by name, nomor peserta, or batch", label: "Search", type: "input" },
                ]}
            />

            {/* Bulk action buttons */}
            <div className="flex flex-wrap gap-2">
                {isCheckerBrins && selectedDebtors.length > 0 && (
                    <Button variant="outline"
                        onClick={() => actions.handleActionButtonClick("check")}
                        disabled={actions.uploading || actions.showBatchPickerDialog || actions.showScopeDialog}
                    >
                        {actions.uploading
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <Check className="w-4 h-4 mr-2" />}
                        Check ({selectedDebtors.length})
                    </Button>
                )}
                {isApproverBrins && selectedDebtors.length > 0 && (
                    <Button variant="outline"
                        onClick={() => actions.handleActionButtonClick("approve")}
                        disabled={actions.uploading || actions.showBatchPickerDialog || actions.showScopeDialog}
                    >
                        {actions.uploading
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <ShieldCheck className="w-4 h-4 mr-2" />}
                        Approve ({selectedDebtors.length})
                    </Button>
                )}
            </div>

            {/* Data table */}
            <DataTable
                columns={columns}
                data={pageData}
                isLoading={tableLoading}
                emptyMessage="No debtors found. Upload your first batch to get started."
                pagination={{ from, to, total, page, totalPages }}
                onPageChange={setPage}
                onSort={handleSort}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
            />

            {/* ── Batch picker dialog ────────────────────────────────────────── */}
            <Dialog open={actions.showBatchPickerDialog} onOpenChange={actions.setShowBatchPickerDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Batch</DialogTitle>
                        <DialogDescription>
                            Multiple batches in your selection. Which batch should this action apply to?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {actions.uniqueBatches.map((bId) => {
                            const count = selectedDebtors.filter(
                                (id) => debtors.find((d) => d.id === id)?.batch_id === bId
                            ).length;
                            return (
                                <Button key={bId} variant="outline" className="w-full justify-start"
                                    onClick={() => actions.handleBatchSelect(bId)}
                                >
                                    <span className="font-mono">{bId}</span>
                                    <span className="ml-auto text-xs text-gray-500">{count} selected</span>
                                </Button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Scope dialog ───────────────────────────────────────────────── */}
            <Dialog open={actions.showScopeDialog} onOpenChange={actions.setShowScopeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Action Scope</DialogTitle>
                        <DialogDescription>
                            {actions.selectedBatchForAction && (
                                <>Apply action to which debtors in batch <span className="font-mono font-semibold">{actions.selectedBatchForAction}</span>?</>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="scope" value="selected"
                                checked={actions.actionScope === "selected"}
                                onChange={(e) => actions.setActionScope(e.target.value)}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium">{selectedDebtors.length} selected row(s)</p>
                                <p className="text-xs text-gray-500">Apply action only to debtors selected on current page</p>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border rounded-lg border-blue-200 bg-blue-50 cursor-pointer">
                            <input type="radio" name="scope" value="whole-batch"
                                checked={actions.actionScope === "whole-batch"}
                                onChange={(e) => actions.setActionScope(e.target.value)}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium text-blue-900">{actions.selectedBatchForAction}</p>
                                <p className="text-xs text-blue-700">Apply action to all debtors in this batch with real-time progress tracking</p>
                            </div>
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowScopeDialog(false)}>Cancel</Button>
                        <Button onClick={actions.handleScopeConfirm}>Proceed</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Action Confirm dialog (Preview Total) ──────────────────────── */}
            <Dialog open={actions.showActionConfirmDialog} onOpenChange={actions.setShowActionConfirmDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Konfirmasi {actions.pendingAction === "check" ? "Check" : "Approve"} Debtor
                        </DialogTitle>
                        <DialogDescription>
                            Periksa ringkasan total sebelum melanjutkan proses{" "}
                            {actions.pendingAction === "check" ? "pengecekan" : "persetujuan"}.
                        </DialogDescription>
                    </DialogHeader>
                    {actions.actionConfirmSummary && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 col-span-2">
                                    <p className="text-xs text-gray-500 mb-1">Batch ID</p>
                                    <p className="text-base font-semibold font-mono text-gray-900">
                                        {actions.actionConfirmSummary.batchId}
                                    </p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <p className="text-xs text-gray-500 mb-1">Total Jumlah Debtor</p>
                                    <p className="text-2xl font-bold text-blue-700">
                                        {actions.actionConfirmSummary.count}
                                    </p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                    <p className="text-xs text-gray-500 mb-1">Total Net Premi</p>
                                    <p className="text-lg font-bold text-green-700">
                                        {formatRupiahAdaptive(actions.actionConfirmSummary.totalNetPremi)}
                                    </p>
                                </div>
                                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200 col-span-2">
                                    <p className="text-xs text-gray-500 mb-1">Total Nilai Komisi</p>
                                    <p className="text-lg font-bold text-indigo-700">
                                        {formatRupiahAdaptive(actions.actionConfirmSummary.totalKomisi)}
                                    </p>
                                </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Contract</span>
                                    <span className="font-medium">{actions.actionConfirmSummary.contractId}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total Plafon</span>
                                    <span className="font-medium">{formatRupiahAdaptive(actions.actionConfirmSummary.totalPlafon)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total Nominal Premi</span>
                                    <span className="font-medium">{formatRupiahAdaptive(actions.actionConfirmSummary.totalNominalPremi)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowActionConfirmDialog(false)}>
                            Batal
                        </Button>
                        <Button onClick={actions.handleActionConfirm}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {actions.pendingAction === "check" ? "Confirm Check" : "Confirm Approve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Progress modal ─────────────────────────────────────────────── */}
            <Dialog open={actions.showProgressModal} onOpenChange={actions.setShowProgressModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bulk Action Progress</DialogTitle>
                        <DialogDescription>
                            {actions.pendingAction === "check" ? "Checking" : "Approving"} debtors...
                        </DialogDescription>
                    </DialogHeader>
                    {actions.jobStatus && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-600">Processed</p>
                                    <p className="text-2xl font-bold text-blue-600">{actions.jobStatus.processedCount || 0}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Total</p>
                                    <p className="text-2xl font-bold text-gray-700">{actions.jobStatus.totalCount}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-600">Progress</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {actions.jobStatus.totalCount
                                            ? Math.round((actions.jobStatus.processedCount / actions.jobStatus.totalCount) * 100)
                                            : 0}%
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-green-600 h-full transition-all duration-300"
                                        style={{
                                            width: `${actions.jobStatus.totalCount
                                                ? Math.round((actions.jobStatus.processedCount / actions.jobStatus.totalCount) * 100)
                                                : 0}%`,
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-600 text-center">{actions.jobStatus.message}</p>
                            </div>
                            {actions.jobStatus.errors?.length > 0 && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 mb-2">Errors ({actions.jobStatus.errors.length}):</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {actions.jobStatus.errors.slice(0, 10).map((err, i) => (
                                            <div key={i} className="text-xs text-red-600">
                                                <span className="font-mono">{err.debtorId || err.error}</span>: {err.error || err.nama}
                                            </div>
                                        ))}
                                        {actions.jobStatus.errors.length > 10 && (
                                            <p className="text-xs text-red-500">...and {actions.jobStatus.errors.length - 10} more</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-center">
                                {actions.jobStatus.status === "PROCESSING" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                        <Loader2 className="w-4 h-4 animate-spin" />Processing...
                                    </div>
                                )}
                                {actions.jobStatus.status === "COMPLETED" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4" />Completed
                                    </div>
                                )}
                                {actions.jobStatus.status === "FAILED" && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                        <AlertCircle className="w-4 h-4" />Failed
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Upload dialog (3 tabs) ─────────────────────────────────────── */}
            <Dialog
                open={upload.uploadDialogOpen}
                onOpenChange={(open) => {
                    upload.setUploadDialogOpen(open);
                    if (!open) upload.resetUploadState();
                }}
            >
                <DialogContent className="max-w-4xl w-full" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>
                            {upload.uploadTabActive === 1 ? "Upload Debtors" : upload.uploadTabActive === 2 ? "Debtor Preview" : "Preview Total"}
                        </DialogTitle>
                        <DialogDescription>
                            {upload.uploadTabActive === 1
                                ? "Upload CSV/XLS/XLSX file containing debtor information"
                                : upload.uploadTabActive === 2
                                ? "Periksa data sebelum disimpan ke database"
                                : "Review total summary before confirming upload to database"}
                        </DialogDescription>
                        {/* Stepper */}
                        <div className="flex mt-3 gap-2">
                            {[
                                { step: 1, label: "Upload" },
                                { step: 2, label: "Preview" },
                                { step: 3, label: "Preview Total" },
                            ].map(({ step, label }) => {
                                const isActive = upload.uploadTabActive === step;
                                const isDone = upload.uploadTabActive > step;
                                return (
                                    <div key={step}
                                        className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${isActive ? "border-blue-600 text-blue-600 font-medium" : isDone ? "border-green-600 text-green-600" : "border-gray-200 text-gray-400"}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${isActive ? "bg-blue-600 text-white" : isDone ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                                            {isDone ? "✓" : step}
                                        </div>
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                        {/* Tab 1: Upload form */}
                        {upload.uploadTabActive === 1 && (
                            <>
                                {upload.uploadError && (
                                    <Alert className="border-red-200 bg-red-50">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <AlertDescription className="text-red-800 space-y-2">
                                            <p className="font-medium">{uploadErrorView.summary}</p>
                                            {uploadErrorView.title && <p className="text-sm">{uploadErrorView.title}</p>}
                                            {uploadErrorView.items.length > 0 && (
                                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                                    {uploadErrorView.items.map((item) => <li key={item}>{item}</li>)}
                                                </ul>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <div>
                                    <Label>Select Contract *</Label>
                                    <Select value={upload.selectedContract} onValueChange={(v) => { upload.setSelectedContract(v); upload.setSelectedBatch(""); }}>
                                        <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
                                        <SelectContent>
                                            {activeContracts.map((c) => (
                                                <SelectItem key={c.contract_id} value={c.contract_id}>
                                                    {c.contract_id} - APPROVED
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Batch Mode *</Label>
                                    <Select value={upload.batchMode} onValueChange={upload.setBatchMode}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">New Batch</SelectItem>
                                            <SelectItem value="revise">Revise Existing Batch</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {upload.batchMode === "revise" && (
                                    <div>
                                        <Label>Select Batch to Revise *</Label>
                                        <Select value={upload.selectedBatch} onValueChange={upload.setSelectedBatch}>
                                            <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                                            <SelectContent>
                                                {batches
                                                    .filter((b) =>
                                                        b.contract_id === upload.selectedContract &&
                                                        debtors.some((d) => d.batch_id === b.batch_id && d.contract_id === upload.selectedContract && d.status === "REVISION")
                                                    )
                                                    .map((b) => {
                                                        const revCount = debtors.filter((d) => d.batch_id === b.batch_id && d.contract_id === upload.selectedContract && d.status === "REVISION").length;
                                                        return (
                                                            <SelectItem key={b.batch_id} value={b.batch_id}>
                                                                {b.batch_id} — {revCount} debtor(s) need revision
                                                            </SelectItem>
                                                        );
                                                    })
                                                }
                                            </SelectContent>
                                        </Select>
                                        {upload.selectedContract && batches.filter((b) =>
                                            b.contract_id === upload.selectedContract &&
                                            debtors.some((d) => d.batch_id === b.batch_id && d.contract_id === upload.selectedContract && d.status === "REVISION")
                                        ).length === 0 && (
                                            <p className="text-sm text-red-600 mt-1">No batches with REVISION debtors found for this contract.</p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <Label>Upload File *</Label>
                                    <Input type="file" accept=".csv,.xlsx,.xls"
                                        onChange={(e) => upload.setUploadFile(e.target.files?.[0])}
                                    />
                                    {upload.uploadFile && (
                                        <p className="text-sm text-gray-600 mt-1">Selected: {upload.uploadFile.name}</p>
                                    )}
                                </div>
                                <Alert>
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <AlertDescription>Download the template first to see the required format.</AlertDescription>
                                </Alert>
                                {upload.batchMode === "revise" && (
                                    <Alert className="border-blue-200 bg-blue-50">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertDescription className="text-blue-800">
                                            <strong>Revise Mode:</strong> You can upload the complete batch file. The system will process only debtors marked as <code className="font-mono text-xs bg-blue-100 px-1 rounded">REVISION</code> and archive old REVISION data.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}

                        {/* Tab 2: Preview table */}
                        {upload.uploadTabActive === 2 && (
                            <>
                                <div className="flex gap-3 flex-wrap">
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Total Rows</p>
                                        <p className="text-xl font-medium">{upload.uploadPreviewData.length}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Mode</p>
                                        <p className="text-sm font-medium mt-1">{upload.batchMode === "new" ? "New Batch" : "Revise"}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">Contract</p>
                                        <p className="text-sm font-medium mt-1">{upload.selectedContract || "-"}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2">
                                        <p className="text-xs text-gray-500">File</p>
                                        <p className="text-sm font-medium mt-1">{upload.uploadFile?.name || "-"}</p>
                                    </div>
                                </div>
                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">Review the data below before confirming.</AlertDescription>
                                </Alert>
                                {upload.uploadPreviewLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                                        <span className="text-sm text-gray-600">Generating preview...</span>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "500px", border: "1px solid #e5e7eb", borderRadius: "8px", width: "100%" }}>
                                        <table className="text-xs" style={{ minWidth: "max-content", borderCollapse: "collapse" }}>
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100">#</th>
                                                    {previewKeys.map((k) => (
                                                        <th key={k} className="px-4 py-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100">
                                                            {formatHeaderName(k)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {upload.uploadPreviewData.map((row, ri) => (
                                                    <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                        <td className="px-4 py-2 border-r border-gray-200 text-center font-medium">{ri + 1}</td>
                                                        {previewKeys.map((k) => (
                                                            <td key={`${ri}-${k}`} className="px-4 py-2 border-r border-gray-200 whitespace-nowrap" title={String(row[k] || "-")}>
                                                                {formatCellValue(k, row[k])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Tab 3: Preview Total */}
                        {upload.uploadTabActive === 3 && (
                            <>
                                <Alert className="bg-blue-50 border-blue-200">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-700">
                                        Data preview complete. Review the total summary below before confirming upload.
                                    </AlertDescription>
                                </Alert>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 col-span-2">
                                        <p className="text-xs text-gray-500 mb-1">Batch ID</p>
                                        <p className="text-lg font-semibold font-mono text-gray-900">{previewBatchId}</p>
                                    </div>
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                        <p className="text-xs text-gray-500 mb-1">Total Jumlah Debtor</p>
                                        <p className="text-2xl font-bold text-blue-700">{upload.uploadPreviewData.length}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                        <p className="text-xs text-gray-500 mb-1">Total Net Premi</p>
                                        <p className="text-xl font-bold text-green-700">{formatRupiahAdaptive(previewTotals.totalNetPremi)}</p>
                                    </div>
                                    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 col-span-2">
                                        <p className="text-xs text-gray-500 mb-1">Total Nilai Komisi</p>
                                        <p className="text-xl font-bold text-indigo-700">{formatRupiahAdaptive(previewTotals.totalKomisi)}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Contract</span>
                                        <span className="font-medium">{upload.selectedContract || "-"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Mode</span>
                                        <span className="font-medium">{upload.batchMode === "new" ? "New Batch" : "Revise"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Total Plafon</span>
                                        <span className="font-medium">{formatRupiahAdaptive(previewTotals.totalPlafon)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Total Nominal Premi</span>
                                        <span className="font-medium">{formatRupiahAdaptive(previewTotals.totalNominalPremi)}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {canShowActionButtons && (
                        <DialogFooter className="shrink-0 border-t pt-4">
                            {upload.uploadTabActive === 1 && (
                                <>
                                    <Button variant="outline" onClick={() => upload.setUploadDialogOpen(false)} disabled={upload.uploadPreviewLoading}>Cancel</Button>
                                    <Button onClick={upload.handlePreviewData} disabled={upload.uploadPreviewLoading}>
                                        {upload.uploadPreviewLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><Eye className="w-4 h-4 mr-2" />Preview Data</>}
                                    </Button>
                                </>
                            )}
                            {upload.uploadTabActive === 2 && (
                                <>
                                    <Button variant="outline" onClick={() => { upload.setUploadTabActive(1); upload.setUploadError(""); }} disabled={upload.uploading}>
                                        <ChevronLeft className="w-4 h-4 mr-2" />Back to Upload
                                    </Button>
                                    <Button variant="outline" onClick={() => upload.setUploadDialogOpen(false)} disabled={upload.uploading}>Cancel</Button>
                                    <Button onClick={() => upload.setUploadTabActive(3)} disabled={upload.uploading}>
                                        <ChevronRight className="w-4 h-4 mr-2" />Preview Total
                                    </Button>
                                </>
                            )}
                            {upload.uploadTabActive === 3 && (
                                <>
                                    <Button variant="outline" onClick={() => { upload.setUploadTabActive(2); upload.setUploadError(""); }} disabled={upload.uploading}>
                                        <ChevronLeft className="w-4 h-4 mr-2" />Back to Preview
                                    </Button>
                                    <Button variant="outline" onClick={() => upload.setUploadDialogOpen(false)} disabled={upload.uploading}>Cancel</Button>
                                    <Button onClick={upload.handleConfirmSave} disabled={upload.uploading}>
                                        {upload.uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Confirm Upload</>}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Detail dialog ──────────────────────────────────────────────── */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Debtor Details</DialogTitle>
                        <DialogDescription>{selectedDebtor?.nama_peserta}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Nomor Peserta:</span><p className="font-medium">{selectedDebtor?.nomor_peserta}</p></div>
                            <div><span className="text-gray-500">Batch ID:</span><p className="font-medium">{selectedDebtor?.batch_id}</p></div>
                            <div><span className="text-gray-500">Plafon:</span><p className="font-medium">{formatRupiahAdaptive(selectedDebtor?.plafon)}</p></div>
                            <div><span className="text-gray-500">Net Premi:</span><p className="font-medium">{formatRupiahAdaptive(selectedDebtor?.net_premi)}</p></div>
                            <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedDebtor?.status} /></div>
                            {selectedDebtor?.validation_remarks && (
                                <div className="col-span-2 p-3 bg-orange-50 border border-orange-200 rounded">
                                    <p className="text-sm font-medium text-orange-700">Validation Remarks:</p>
                                    <p className="text-sm text-orange-600">{selectedDebtor.validation_remarks}</p>
                                </div>
                            )}
                            {selectedDebtor?.version_no && (
                                <div><span className="text-gray-500">Version No:</span><p className="font-medium">{selectedDebtor.version_no}</p></div>
                            )}
                        </div>
                        {(selectedDebtor?.version_no || 0) > 1 && revisionDiffs.length > 0 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-blue-900">Revision Changes</h3>
                                </div>
                                <div className="space-y-2">
                                    {revisionDiffs.slice(0, 15).map((diff, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm">
                                            <span className="font-mono text-xs bg-white px-2 py-1 rounded text-gray-700 flex-shrink-0 min-w-32">{diff.key}</span>
                                            <div className="flex-1">
                                                <p className="text-red-600 line-through text-xs">Old: {diff.old}</p>
                                                <p className="text-green-600 text-xs">New: {diff.new}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {revisionDiffs.length > 15 && <p className="text-xs text-gray-500 mt-2">...and {revisionDiffs.length - 15} more changes</p>}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Revision dialog ────────────────────────────────────────────── */}
            <Dialog open={actions.revisionDialogOpen} onOpenChange={actions.setRevisionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Revision</DialogTitle>
                        <DialogDescription>Request revision for {selectedDebtors.length} selected debtor(s)</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Revision Note *</Label>
                            <Textarea
                                placeholder="Explain what needs to be revised..."
                                value={actions.revisionNote}
                                onChange={(e) => actions.setRevisionNote(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    {canShowActionButtons && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => actions.setRevisionDialogOpen(false)}>Cancel</Button>
                            <Button onClick={actions.handleRequestRevision}>
                                <RefreshCw className="w-4 h-4 mr-2" />Request Revision
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Note dialog ────────────────────────────────────────────────── */}
            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Action Note</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                        <Label>Note from TUGURE:</Label>
                        <div className="p-4 bg-gray-50 rounded-lg border">
                            <p className="text-sm text-gray-700">{actionNote}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setNoteDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
