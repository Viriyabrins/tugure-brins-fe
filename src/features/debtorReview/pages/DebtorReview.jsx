import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    FileText, CheckCircle2, Eye, RefreshCw, Check, X, Loader2,
    DollarSign, AlertCircle, Pen, ShieldCheck, History,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import SuccessAlert from "@/components/common/SuccessAlert";
import { formatRupiahAdaptive } from "@/utils/currency";
import { DEFAULT_DR_FILTER, DR_PAGE_SIZE } from "../utils/debtorReviewConstants";
import { useDebtorReviewData } from "../hooks/useDebtorReviewData";
import { useDebtorReviewActions } from "../hooks/useDebtorReviewActions";
import { useDebtorSSE } from "@/hooks/useDebtorSSE";

export default function DebtorReview() {
    const data = useDebtorReviewData();
    const {
        debtors, totalDebtors, contracts, loading, filters, setFilters,
        page, setPage, sortColumn, sortOrder, handleSort, loadData,
        user, auditActor, tokenRoles,
        pendingCount, checkedTugureCount, approvedCount, revisionCount, totalPlafond,
        canManageDebtorActions, isCheckerTugure, isApproverTugure,
    } = data;

    const [selectedDebtors, setSelectedDebtors] = useState([]);

    // SSE hook for real-time debtor updates
    useDebtorSSE(() => {
        loadData();
    });

    const actions = useDebtorReviewActions({
        user, auditActor, debtors, selectedDebtors, setSelectedDebtors,
        filters, loadData,
    });

    const pageData = Array.isArray(debtors) ? debtors : [];
    const totalPages = Math.max(1, Math.ceil(totalDebtors / DR_PAGE_SIZE));
    const from = totalDebtors === 0 ? 0 : (page - 1) * DR_PAGE_SIZE + 1;
    const to = Math.min(totalDebtors, page * DR_PAGE_SIZE);

    const columns = [
        {
            header: (
                <Checkbox
                    checked={selectedDebtors.length === pageData.length && pageData.length > 0}
                    onCheckedChange={(checked) => setSelectedDebtors(checked ? pageData.map((d) => d.id) : [])}
                />
            ),
            cell: (row) => (
                <Checkbox
                    checked={selectedDebtors.includes(row.id)}
                    onCheckedChange={(checked) =>
                        setSelectedDebtors(checked ? [...selectedDebtors, row.id] : selectedDebtors.filter((id) => id !== row.id))
                    }
                />
            ),
            width: "40px",
        },
        {
            header: "Debtor", accessorKey: "nomor_peserta",
            cell: (row) => (
                <div>
                    <p className="font-medium">{row.nama_peserta}</p>
                    <p className="text-sm text-gray-500">{row.nomor_peserta}</p>
                </div>
            ),
        },
        { header: "Batch", accessorKey: "batch_id", cell: (row) => <span className="font-mono text-sm">{row.batch_id}</span> },
        { header: "Plafond", accessorKey: "plafon", cell: (row) => formatRupiahAdaptive(row.plafon) },
        { header: "Net Premi", accessorKey: "net_premi", cell: (row) => formatRupiahAdaptive(row.net_premi) },
        { header: "Status", accessorKey: "status", cell: (row) => <StatusBadge status={row.status} /> },
        {
            header: "Action",
            cell: (row) => (
                <Button variant="outline" size="sm" onClick={() => { actions.setSelectedDebtor(row); actions.setShowDetailDialog(true); }}>
                    <Eye className="w-4 h-4" />
                </Button>
            ),
            width: "80px",
        },
    ];

    if (loading && !debtors.length) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Debtor Review - Financial Gate"
                subtitle="⚠️ CRITICAL: Only APPROVED debtors are included in financial calculations"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Debtor Review" }]}
                actions={
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw className="w-4 h-4 mr-2" />Refresh
                    </Button>
                }
            />

            {actions.successMessage && <SuccessAlert message={actions.successMessage} />}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <GradientStatCard title="Pending Check" value={pendingCount} subtitle="BRINS approved, awaiting Tugure check" icon={FileText} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Checked" value={checkedTugureCount} subtitle="Checked by Tugure, awaiting approval" icon={ShieldCheck} gradient="from-teal-500 to-teal-600" />
                <GradientStatCard title="Approved" value={approvedCount} subtitle="Fully approved" icon={CheckCircle2} gradient="from-green-500 to-green-600" />
                <GradientStatCard title="Revision" value={revisionCount} subtitle="Requires revision" icon={AlertCircle} gradient="from-red-500 to-red-600" />
                <GradientStatCard title="Total Plafon" value={formatRupiahAdaptive(totalPlafond)} subtitle="Approved only" icon={DollarSign} gradient="from-purple-500 to-purple-600" />
            </div>

            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={DEFAULT_DR_FILTER}
                filterConfig={[
                    { key: "contract", label: "Contract", options: [{ value: "all", label: "All Contracts" }, ...contracts.map((c) => ({ value: c.id, label: c.contract_id }))] },
                    { key: "batch", label: "Batch ID", placeholder: "Search Batch...", type: "input", inputType: "text" },
                    { key: "startDate", label: "Start Date", type: "date" },
                    { key: "endDate", label: "End Date", type: "date" },
                    { key: "submitStatus", label: "Underwriting Status", options: [{ value: "all", label: "All Statuses" }, { value: "APPROVED_BRINS", label: "Approved (BRINS)" }, { value: "CHECKED_TUGURE", label: "Checked (Tugure)" }, { value: "APPROVED", label: "Approved (Final)" }, { value: "REVISION", label: "Revision" }] },
                    { key: "status", label: "Batch Status", options: [{ value: "all", label: "All Statuses" }, { value: "Uploaded", label: "Uploaded" }, { value: "Validated", label: "Validated" }, { value: "Matched", label: "Matched" }, { value: "Approved", label: "Approved" }] },
                ]}
            />

            {canManageDebtorActions && selectedDebtors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {isCheckerTugure && (
                        <Button onClick={() => actions.handleActionButtonClick("bulk_check")} disabled={actions.processing || actions.showBatchPickerDialog || actions.showScopeDialog}>
                            <Check className="w-4 h-4 mr-2" />Check ({selectedDebtors.length})
                        </Button>
                    )}
                    {isApproverTugure && (
                        <>
                            <Button variant="outline" onClick={() => actions.handleActionButtonClick("bulk_approve")} disabled={actions.processing || actions.showBatchPickerDialog || actions.showScopeDialog}>
                                <ShieldCheck className="w-4 h-4 mr-2" />Approve ({selectedDebtors.length})
                            </Button>
                            <Button variant="outline" onClick={() => actions.handleActionButtonClick("bulk_revision")} disabled={actions.processing || actions.showBatchPickerDialog || actions.showScopeDialog}>
                                <Pen className="w-4 h-4 mr-2" />Revision ({selectedDebtors.length})
                            </Button>
                        </>
                    )}
                </div>
            )}

            <DataTable
                columns={columns} data={pageData} isLoading={loading} emptyMessage="No debtors to review"
                pagination={{ from, to, total: totalDebtors, page, totalPages }}
                onPageChange={setPage} onSort={handleSort} sortColumn={sortColumn} sortOrder={sortOrder}
            />

            {/* ── Detail Dialog ───────────────────────────────────────────────── */}
            <Dialog open={actions.showDetailDialog} onOpenChange={actions.setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Debtor Details</DialogTitle>
                        <DialogDescription>{actions.selectedDebtor?.debtor_name}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Nomor Peserta:</span><p className="font-medium">{actions.selectedDebtor?.nomor_peserta}</p></div>
                            <div><span className="text-gray-500">Batch ID:</span><p className="font-medium">{actions.selectedDebtor?.batch_id}</p></div>
                            <div><span className="text-gray-500">Plafon:</span><p className="font-medium">{formatRupiahAdaptive(actions.selectedDebtor?.plafon)}</p></div>
                            <div><span className="text-gray-500">Net Premi:</span><p className="font-medium">{formatRupiahAdaptive(actions.selectedDebtor?.net_premi)}</p></div>
                            <div><span className="text-gray-500">Status:</span><StatusBadge status={actions.selectedDebtor?.status} /></div>
                            {actions.selectedDebtor?.validation_remarks && (
                                <div className="col-span-2 p-3 bg-orange-50 border border-orange-200 rounded">
                                    <p className="text-sm font-medium text-orange-700">Validation Remarks:</p>
                                    <p className="text-sm text-orange-600">{actions.selectedDebtor.validation_remarks}</p>
                                </div>
                            )}
                            {actions.selectedDebtor?.version_no && (
                                <div><span className="text-gray-500">Version No:</span><p className="font-medium">{actions.selectedDebtor.version_no}</p></div>
                            )}
                        </div>
                        {(actions.selectedDebtor?.version_no || 0) > 1 && actions.revisionDiffs.length > 0 && (
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-blue-900">Revision Changes</h3>
                                </div>
                                <div className="space-y-2">
                                    {actions.revisionDiffs.slice(0, 15).map((diff, idx) => (
                                        <div key={idx} className="flex items-start gap-3 text-sm">
                                            <span className="font-mono text-xs bg-white px-2 py-1 rounded text-gray-700 flex-shrink-0 min-w-32">{diff.key}</span>
                                            <div className="flex-1">
                                                <p className="text-red-600 line-through text-xs">Old: {diff.old}</p>
                                                <p className="text-green-600 text-xs">New: {diff.new}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {actions.revisionDiffs.length > 15 && (
                                        <p className="text-xs text-gray-500 mt-2">...and {actions.revisionDiffs.length - 15} more changes</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => actions.setShowDetailDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Approval Dialog ─────────────────────────────────────────────── */}
            <Dialog open={actions.showApprovalDialog} onOpenChange={actions.setShowApprovalDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actions.approvalAction?.includes("bulk")
                                ? `Bulk ${actions.approvalAction.includes("approve") ? "Approve" : "Revision"} (${selectedDebtors.length} debtors)`
                                : actions.approvalAction === "approve" ? "Approve Debtor" : "Request Revision"}
                        </DialogTitle>
                        <DialogDescription>
                            {actions.approvalAction?.includes("bulk") ? `Processing ${selectedDebtors.length} selected debtors` : actions.selectedDebtor?.debtor_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {!actions.approvalAction?.includes("bulk") && actions.selectedDebtor && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Plafond:</span><span className="ml-2 font-medium">Rp {(actions.selectedDebtor?.plafon || 0).toLocaleString("id-ID")}</span></div>
                                    <div><span className="text-gray-500">Net Premi:</span><span className="ml-2 font-medium">Rp {(actions.selectedDebtor?.net_premi || 0).toLocaleString("id-ID")}</span></div>
                                </div>
                            </div>
                        )}
                        {(actions.approvalAction === "revision" || actions.approvalAction === "bulk_revision") && (
                            <Alert>
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription>
                                    {actions.approvalAction === "bulk_revision"
                                        ? `Marking ${selectedDebtors.length} debtors for revision.`
                                        : "Marking debtor for revision will allow revision and resubmission."}
                                </AlertDescription>
                            </Alert>
                        )}
                        <div>
                            <label className="text-sm font-medium">Remarks *</label>
                            <Textarea value={actions.approvalRemarks} onChange={(e) => actions.setApprovalRemarks(e.target.value)} rows={4}
                                placeholder={actions.approvalAction?.includes("approve") ? "Enter approval notes..." : "Enter revision reason..."} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowApprovalDialog(false)} disabled={actions.processing}>Cancel</Button>
                        <Button
                            className={actions.approvalAction?.includes("approve") ? "bg-green-600 hover:bg-green-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}
                            onClick={actions.handleApproveRevise}
                            disabled={actions.processing || (actions.approvalAction?.includes("revision") && !actions.approvalRemarks.trim())}
                        >
                            {actions.processing ? "Processing..." : actions.approvalAction?.includes("approve") ? "Confirm Approval" : "Submit Revision Request"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Approval Summary Dialog ─────────────────────────────────────── */}
            <Dialog open={actions.showApprovalSummaryDialog} onOpenChange={actions.setShowApprovalSummaryDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Approve Debtors & Generate Nota</DialogTitle>
                        <DialogDescription>Review the debtors that will be approved. A Nota will be automatically generated.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div><p className="text-sm text-gray-600">Total Debtors</p><p className="text-2xl font-bold text-blue-600">{actions.approvalSummaryDebtors.length}</p></div>
                            <div><p className="text-sm text-gray-600">Total Exposure</p><p className="text-lg font-semibold">{formatRupiahAdaptive(actions.approvalSummaryDebtors.reduce((s, d) => s + (parseFloat(d.plafon) || 0), 0))}</p></div>
                            <div><p className="text-sm text-gray-600">Total Net Premi</p><p className="text-lg font-semibold">{formatRupiahAdaptive(actions.approvalSummaryDebtors.reduce((s, d) => s + (parseFloat(d.net_premi) || 0), 0))}</p></div>
                        </div>
                        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-semibold">Nomor Peserta</th>
                                        <th className="px-4 py-2 text-left font-semibold">Nama</th>
                                        <th className="px-4 py-2 text-right font-semibold">Plafon</th>
                                        <th className="px-4 py-2 text-right font-semibold">Net Premi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {actions.approvalSummaryDebtors.map((d, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-4 py-2">{d.nomor_peserta}</td>
                                            <td className="px-4 py-2 text-sm">{d.nama_peserta}</td>
                                            <td className="px-4 py-2 text-right">{formatRupiahAdaptive(d.plafon)}</td>
                                            <td className="px-4 py-2 text-right">{formatRupiahAdaptive(d.net_premi)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Alert className="border-green-200 bg-green-50">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">An invoice Nota (UNPAID) will be generated automatically in Nota Management.</AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowApprovalSummaryDialog(false); actions.setApprovalSummaryDebtors([]); }} disabled={actions.processing}>Cancel</Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={actions.executeApproval} disabled={actions.processing}>
                            {actions.processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Approve & Generate Nota</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Batch Picker Dialog ─────────────────────────────────────────── */}
            <Dialog open={actions.showBatchPickerDialog} onOpenChange={actions.setShowBatchPickerDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Batch</DialogTitle>
                        <DialogDescription>Multiple batches found. Which batch to apply this action to?</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {actions.uniqueBatches.map((bId) => {
                            const count = selectedDebtors.filter((id) => debtors.find((d) => d.id === id)?.batch_id === bId).length;
                            return (
                                <Button key={bId} variant="outline" className="w-full justify-start" onClick={() => actions.handleBatchSelect(bId)}>
                                    <span className="font-mono">{bId}</span>
                                    <span className="ml-auto text-xs text-gray-500">{count} selected</span>
                                </Button>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Scope Dialog ────────────────────────────────────────────────── */}
            <Dialog open={actions.showScopeDialog} onOpenChange={actions.setShowScopeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Action Scope</DialogTitle>
                        <DialogDescription>
                            {actions.selectedBatchForAction && <>Apply action to which debtors in batch <span className="font-mono font-semibold">{actions.selectedBatchForAction}</span>?</>}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="scope" value="selected" checked={actions.actionScope === "selected"} onChange={(e) => actions.setActionScope(e.target.value)} className="mt-1" />
                            <div>
                                <p className="font-medium">{selectedDebtors.length} selected row(s)</p>
                                <p className="text-xs text-gray-500">Apply action only to debtors selected on current page</p>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 border rounded-lg border-blue-200 bg-blue-50 cursor-pointer">
                            <input type="radio" name="scope" value="whole-batch" checked={actions.actionScope === "whole-batch"} onChange={(e) => actions.setActionScope(e.target.value)} className="mt-1" />
                            <div>
                                <p className="font-medium text-blue-900">{actions.selectedBatchForAction}</p>
                                <p className="text-xs text-blue-700">Apply to all debtors in this batch with real-time progress</p>
                            </div>
                        </label>
                        {!actions.approvalAction?.includes("check") && actions.actionScope !== "whole-batch" && !isApproverTugure && (
                            <div>
                                <label className="text-sm font-medium">Remarks *</label>
                                <Textarea value={actions.approvalRemarks} onChange={(e) => actions.setApprovalRemarks(e.target.value)} rows={3}
                                    placeholder={actions.approvalAction?.includes("approve") ? "Enter approval notes..." : "Enter revision reason..."} />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowScopeDialog(false)} disabled={actions.processing}>Cancel</Button>
                        <Button onClick={actions.handleScopeConfirm} disabled={actions.processing || (actions.actionScope !== "whole-batch" && !actions.approvalAction?.includes("check") && !isApproverTugure && !actions.approvalRemarks.trim())}>
                            {actions.processing ? "Processing..." : "Proceed"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Action Confirm Dialog (Preview Total) ───────────────────── */}
            <Dialog open={actions.showActionConfirmDialog} onOpenChange={actions.setShowActionConfirmDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Konfirmasi{" "}
                            {actions.approvalAction === "bulk_check"
                                ? "Check"
                                : actions.approvalAction === "bulk_approve"
                                ? "Approve"
                                : "Revision"}{" "}
                            Debtor
                        </DialogTitle>
                        <DialogDescription>
                            Periksa ringkasan total sebelum melanjutkan proses{" "}
                            {actions.approvalAction === "bulk_check"
                                ? "pengecekan"
                                : actions.approvalAction === "bulk_approve"
                                ? "persetujuan"
                                : "permintaan revisi"}.
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
                            {(actions.approvalAction === "bulk_approve" || actions.approvalAction === "bulk_revision") && (
                                <div>
                                    <label className="text-sm font-medium">
                                        Remarks {actions.approvalAction === "bulk_revision" && "*"}
                                    </label>
                                    <textarea
                                        className="mt-1 w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                        value={actions.approvalRemarks}
                                        onChange={(e) => actions.setApprovalRemarks(e.target.value)}
                                        placeholder={
                                            actions.approvalAction === "bulk_approve"
                                                ? "Enter approval notes..."
                                                : "Enter revision reason..."
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => actions.setShowActionConfirmDialog(false)}>
                            Batal
                        </Button>
                        <Button
                            onClick={actions.handleActionConfirm}
                            disabled={
                                actions.approvalAction === "bulk_revision" &&
                                !actions.approvalRemarks.trim()
                            }
                            className={
                                actions.approvalAction === "bulk_revision"
                                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                                    : actions.approvalAction === "bulk_approve"
                                    ? "bg-green-600 hover:bg-green-700 text-white"
                                    : ""
                            }
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {actions.approvalAction === "bulk_check"
                                ? "Confirm Check"
                                : actions.approvalAction === "bulk_approve"
                                ? "Confirm Approve"
                                : "Confirm Revision"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Progress Modal ──────────────────────────────────────────────── */}
            <Dialog open={actions.showProgressModal} onOpenChange={actions.setShowProgressModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bulk Action Progress</DialogTitle>
                        <DialogDescription>{actions.approvalAction}</DialogDescription>
                    </DialogHeader>
                    {actions.jobStatus && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                                <div><p className="text-xs text-gray-600">Processed</p><p className="text-2xl font-bold text-blue-600">{actions.jobStatus.processedCount || 0}</p></div>
                                <div><p className="text-xs text-gray-600">Total</p><p className="text-2xl font-bold text-gray-700">{actions.jobStatus.totalCount}</p></div>
                                <div><p className="text-xs text-gray-600">Progress</p><p className="text-2xl font-bold text-green-600">{actions.jobStatus.percentage}%</p></div>
                            </div>
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div className="bg-green-600 h-full transition-all duration-300" style={{ width: `${actions.jobStatus.percentage || 0}%` }} />
                                </div>
                                <p className="text-xs text-gray-600 text-center">{actions.jobStatus.message}</p>
                            </div>
                            {actions.jobStatus.errors?.length > 0 && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm font-medium text-red-700 mb-2">Errors ({actions.jobStatus.errors.length}):</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {actions.jobStatus.errors.slice(0, 10).map((err, i) => (
                                            <div key={i} className="text-xs text-red-600"><span className="font-mono">{err.debtorId || err.error}</span>: {err.error || err.nama}</div>
                                        ))}
                                        {actions.jobStatus.errors.length > 10 && <p className="text-xs text-red-500">...and {actions.jobStatus.errors.length - 10} more</p>}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-center">
                                {actions.jobStatus.status === "PROCESSING" && <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"><Loader2 className="w-4 h-4 animate-spin" />Processing...</div>}
                                {actions.jobStatus.status === "COMPLETED" && <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium"><CheckCircle2 className="w-4 h-4" />Completed</div>}
                                {actions.jobStatus.status === "FAILED" && <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium"><X className="w-4 h-4" />Failed</div>}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
