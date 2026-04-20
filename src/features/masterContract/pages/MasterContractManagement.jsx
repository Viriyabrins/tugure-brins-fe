import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    FileText, Upload, RefreshCw, CheckCircle2, Clock, Download, AlertCircle,
    Pen, Check, Eye, ShieldCheck, Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import SourceFilePopover from "@/components/common/SourceFilePopover";
import { DEFAULT_MC_FILTER, MC_PAGE_SIZE, extractBaseContractNo, PREVIEW_COLUMNS } from "../utils/masterContractConstants";
import { useMasterContractData } from "../hooks/useMasterContractData";
import { useMasterContractActions } from "../hooks/useMasterContractActions";
import { useMasterContractSSE } from "@/hooks/useMasterContractSSE";
import { useIsViewer } from "@/hooks/usePermissions";

const ApprovalBadge = ({ status }) => {
    const styles = {
        SUBMITTED: "bg-blue-100 text-blue-800", APPROVED: "bg-emerald-400 text-white",
        APPROVED_BRINS: "bg-emerald-400 text-white", REVISION: "bg-red-500 text-white",
        CHECKED_BRINS: "bg-yellow-200 text-orange-500", CHECKED_TUGURE: "bg-violet-100 text-violet-800",
    };
    return <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-200 text-gray-700"}`}>{status || "Unknown"}</span>;
};

const PreviewCellValue = ({ col, value }) => {
    if (value === null || value === undefined || value === "") return "-";
    if (col.isBoolean) return value === true ? "Ya" : value === false ? "Tidak" : "-";
    if (col.isDate) return String(value).slice(0, 10);
    return String(value);
};

export default function MasterContractManagement() {
    const isViewer = useIsViewer();
    const data = useMasterContractData();
    const {
        user, auditActor, contracts, total, statsContracts, loading,
        filters, setFilters, page, setPage, reload, loadContracts, loadStats,
        canManageUploadTemplate, isCheckerBrins, isApproverBrins, isCheckerTugure, isApproverTugure,
    } = data;

    const [selectedContractIds, setSelectedContractIds] = useState([]);
    const clearSelection = () => setSelectedContractIds([]);

    const actions = useMasterContractActions({ user, auditActor, contracts, statsContracts, reload, page, filters, loadContracts, loadStats });

    // SSE hook for real-time master contract updates
    useMasterContractSSE(() => {
        console.log('[MasterContractManagement] SSE event received, reloading contracts');
        loadContracts();
        loadStats();
    });

    const totalPages = Math.max(1, Math.ceil(total / MC_PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * MC_PAGE_SIZE + 1;
    const to = Math.min(total, page * MC_PAGE_SIZE);

    const activeContracts = statsContracts.filter((c) => c.effective_status === "Active");
    const stats = {
        total: statsContracts.length,
        active: activeContracts.length,
        pending: statsContracts.filter((c) => String(c.contract_status || c.effective_status || "").toUpperCase() !== "ACTIVE").length,
        draft: statsContracts.filter((c) => (c.contract_status || "") === "Draft").length,
    };

    const actionableStatuses = isCheckerBrins ? ["SUBMITTED", "Draft"] : isApproverBrins ? ["CHECKED_BRINS"] : isCheckerTugure ? ["APPROVED_BRINS"] : isApproverTugure ? ["CHECKED_TUGURE"] : [];
    const actionableContracts = contracts.filter((c) => actionableStatuses.includes(c.status_approval || ""));
    const columns = [
        {
            header: isViewer ? null : (
                <Checkbox
                    checked={actionableContracts.length > 0 && actionableContracts.every((c) => selectedContractIds.includes(c.contract_id || c.id))}
                    onCheckedChange={(checked) => setSelectedContractIds(checked ? actionableContracts.map((c) => c.contract_id || c.id) : [])}
                />
            ),
            cell: (row) => isViewer ? null : (() => {
                const cId = row.contract_id || row.id;
                if (!actionableStatuses.includes(row.status_approval || "")) return <Checkbox disabled checked={false} />;
                return <Checkbox checked={selectedContractIds.includes(cId)} onCheckedChange={(checked) => setSelectedContractIds(checked ? [...selectedContractIds, cId] : selectedContractIds.filter((id) => id !== cId))} />;
            })(),
            width: "50px",
        },
        { header: "Contract No", cell: (row) => extractBaseContractNo(row.contract_no || row.contract_no_from || row.contract_id || "") || "-" },
        { header: "Source File", cell: (row) => <SourceFilePopover filename={row.source_filename} uploadDate={row.uploaded_date} folder="master-contract" subfolder="excel" recordId={extractBaseContractNo(row.contract_no || row.contract_no_from || row.contract_id || "")} /> },
        { header: "Underwriter Name", accessorKey: "underwriter_name" },
        { header: "Contract Status", cell: (row) => <span className="text-sm font-medium">{row.contract_status || "-"}</span> },
        { header: "Status Approval", cell: (row) => <ApprovalBadge status={row.status_approval} /> },
        { header: "Source Name", accessorKey: "source_name" },
        { header: "Ceding Name", accessorKey: "ceding_name" },
        { header: "Type of Contract", accessorKey: "type_of_contract" },
        {
            header: "Action", width: "80px",
            cell: (row) => (
                <Button variant="outline" size="sm" onClick={() => { actions.setSelectedContract(row); actions.setShowDetailDialog(true); }} title="View detail">
                    <Eye className="w-4 h-4" />
                </Button>
            ),
        },
    ];

    if (loading && !contracts.length) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Master Contract Management"
                subtitle="Manage reinsurance master contracts with approval workflow"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Master Contract Management" }]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={reload}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                        {canManageUploadTemplate && (
                            <>
                                <Button variant="outline" onClick={actions.handleDownloadTemplate}><Download className="w-4 h-4 mr-2" />Download Template</Button>
                                <Button variant="outline" onClick={actions.openUploadDialog}><Upload className="w-4 h-4 mr-2" />Upload Excel</Button>
                            </>
                        )}
                    </div>
                }
            />

            {actions.successMessage && <Alert className="bg-green-50 border-green-200"><CheckCircle2 className="h-4 w-4 text-green-600" /><AlertDescription className="text-green-700">{actions.successMessage}</AlertDescription></Alert>}
            {actions.errorMessage && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="whitespace-pre-wrap">{actions.errorMessage}</AlertDescription></Alert>}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard title="Total Contracts" value={stats.total} subtitle="All versions" icon={FileText} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Active Contracts" value={stats.active} subtitle={`${stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(0) : 0}% of total`} icon={CheckCircle2} gradient="from-green-500 to-green-600" />
                <GradientStatCard title="Needs Action" value={stats.pending} subtitle="Requires action" icon={Clock} gradient="from-orange-500 to-orange-600" />
                <GradientStatCard title="Draft Status" value={stats.draft} subtitle="Not yet submitted" icon={FileText} gradient="from-gray-500 to-gray-600" />
            </div>

            <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_MC_FILTER}
                filterConfig={[
                    { key: "contractId", placeholder: "Search contract...", label: "Contract ID", type: "input", inputType: "text" },
                    { key: "productType", label: "Product Type", options: [{ value: "all", label: "All Product Type" }, { value: "Treaty", label: "Treaty" }, { value: "Facultative", label: "Facultative" }, { value: "Retro", label: "Retro" }] },
                    { key: "creditType", label: "Credit Type", options: [{ value: "all", label: "All Credit Type" }, { value: "Individual", label: "Individual" }, { value: "Corporate", label: "Corporate" }] },
                    { key: "status", label: "Filter By Status", options: [{ value: "all", label: "All Status" }, { value: "REVISION", label: "Revision" }, { value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }, { value: "Archived", label: "Archived" }, { value: "APPROVED_BRINS", label: "Approved by BRINS" }, { value: "CHECKED_BRINS", label: "Checked by BRINS" }] },
                    { key: "startDate", placeholder: "Start Date", label: "Start Date", type: "date" },
                    { key: "endDate", placeholder: "End Date", label: "End Date", type: "date" },
                ]}
            />

            <div className="flex flex-wrap gap-2">
                {isCheckerBrins && <Button variant="outline" onClick={() => actions.handleCheckerBrinsCheck(selectedContractIds, clearSelection)} disabled={actions.processing || !selectedContractIds.length}><Check className="w-4 h-4 mr-2" />Check{selectedContractIds.length > 0 ? ` (${selectedContractIds.length})` : ""}</Button>}
                {isApproverBrins && <Button variant="outline" onClick={() => actions.handleApproverBrinsApprove(selectedContractIds, clearSelection)} disabled={actions.processing || !selectedContractIds.length}><ShieldCheck className="w-4 h-4 mr-2" />Approve{selectedContractIds.length > 0 ? ` (${selectedContractIds.length})` : ""}</Button>}
                {isCheckerTugure && <Button variant="outline" onClick={() => actions.handleCheckerTugureCheck(selectedContractIds, clearSelection)} disabled={actions.processing || !selectedContractIds.length}><Check className="w-4 h-4 mr-2" />Check{selectedContractIds.length > 0 ? ` (${selectedContractIds.length})` : ""}</Button>}
                {isApproverTugure && (
                    <>
                        <Button variant="outline" onClick={() => { actions.setApprovalAction("APPROVED"); actions.setShowApprovalDialog(true); }} disabled={actions.processing || !selectedContractIds.length}><ShieldCheck className="w-4 h-4 mr-2" />Approve{selectedContractIds.length > 0 ? ` (${selectedContractIds.length})` : ""}</Button>
                        <Button variant="outline" onClick={() => { actions.setApprovalAction("REVISION"); actions.setShowApprovalDialog(true); }} disabled={actions.processing || !selectedContractIds.length}><Pen className="w-4 h-4 mr-2" />Revision{selectedContractIds.length > 0 ? ` (${selectedContractIds.length})` : ""}</Button>
                    </>
                )}
            </div>

            <DataTable columns={columns} data={contracts} isLoading={loading} pagination={{ from, to, total, page, totalPages }} onPageChange={(p) => { clearSelection(); setPage(p); }} emptyMessage="No master contracts found" />

            {/* ── Upload Dialog ──────────────────────────────────────────────── */}
            <Dialog open={actions.showUploadDialog} onOpenChange={(open) => { if (!open) actions.closeUploadDialog(); }}>
                <DialogContent className="max-w-4xl w-full" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{actions.uploadTabActive === 1 ? "Upload Master Contracts" : "Master Contract Preview"}</DialogTitle>
                        <DialogDescription>{actions.uploadTabActive === 1 ? "Upload atau revisi kontrak via Excel/CSV" : "Periksa data sebelum disimpan ke database"}</DialogDescription>
                        <div className="flex mt-3">
                            {[{ n: 1, label: "Upload Master Contracts" }, { n: 2, label: "Master Contract Preview" }].map(({ n, label }) => (
                                <div key={n} className={`flex items-center gap-2 flex-1 pb-3 text-sm border-b-2 transition-all duration-300 ${actions.uploadTabActive === n ? "border-blue-600 text-blue-600 font-medium" : n < actions.uploadTabActive ? "border-green-600 text-green-600" : "border-gray-200 text-gray-400"}`}>
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${actions.uploadTabActive === n ? "bg-blue-600 text-white" : n < actions.uploadTabActive ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500"}`}>{n < actions.uploadTabActive ? "✓" : n}</div>
                                    {label}
                                </div>
                            ))}
                        </div>
                    </DialogHeader>
                    <div className="py-4 space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
                        {actions.uploadTabActive === 1 && (
                            <>
                                {actions.errorMessage && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="whitespace-pre-wrap">{actions.errorMessage}</AlertDescription>
                                    </Alert>
                                )}
                                <div>
                                    <label className="text-sm font-medium">Upload Mode</label>
                                    <Select value={actions.uploadMode} onValueChange={actions.setUploadMode}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">Create New Contracts</SelectItem>
                                            <SelectItem value="revise">Revise Existing Contract</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {actions.uploadMode === "revise" && (
                                    <div>
                                        <label className="text-sm font-medium">Select Contract to Revise</label>
                                        <Select value={actions.selectedContractForRevision} onValueChange={actions.setSelectedContractForRevision}>
                                            <SelectTrigger><SelectValue placeholder="Select contract" /></SelectTrigger>
                                            <SelectContent>
                                                {actions.revisionContracts.length === 0 ? (
                                                    <SelectItem value="__no_revision__" disabled>Tidak ada kontrak berstatus REVISION</SelectItem>
                                                ) : actions.revisionContracts.map((c) => {
                                                    const cId = c.contract_id || "-";
                                                    return <SelectItem key={cId} value={cId}>{c.contract_no || "-"} ({cId})</SelectItem>;
                                                })}
                                            </SelectContent>
                                        </Select>
                                        {actions.selectedContractForRevision && (
                                            <Alert className="mt-2 bg-blue-50 border-blue-200">
                                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                                <AlertDescription className="text-blue-700">Will create a new version and archive the previous one</AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm font-medium">Upload File</label>
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => actions.setUploadFile(e.target.files[0])} className="w-full mt-1 text-sm" />
                                    <p className="text-xs text-gray-500 mt-1">Excel atau CSV format</p>
                                </div>
                            </>
                        )}
                        {actions.uploadTabActive === 2 && (
                            <>
                                <div className="flex gap-3 flex-wrap">
                                    <div className="bg-gray-50 rounded-lg px-4 py-2"><p className="text-xs text-gray-500">Total Rows</p><p className="text-xl font-medium">{actions.uploadPreviewData.length}</p></div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2"><p className="text-xs text-gray-500">Mode</p><p className="text-sm font-medium mt-1">{actions.uploadMode === "new" ? "New Contracts" : "Revise"}</p></div>
                                    <div className="bg-gray-50 rounded-lg px-4 py-2"><p className="text-xs text-gray-500">File</p><p className="text-sm font-medium mt-1">{actions.uploadFile?.name}</p></div>
                                </div>
                                {actions.previewValidationError ? (
                                    <Alert className="bg-red-50 border-red-200"><AlertCircle className="h-4 w-4 text-red-600" /><AlertDescription className="text-red-700">{actions.previewValidationError}</AlertDescription></Alert>
                                ) : (
                                    <Alert className="bg-blue-50 border-blue-200"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">Below is a preview of the data that will be saved. Please review before confirming.</AlertDescription></Alert>
                                )}
                                <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "340px", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                                    <table className="text-xs" style={{ minWidth: "max-content", borderCollapse: "collapse" }}>
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="text-left p-2 font-medium text-gray-500 border-b whitespace-nowrap" style={{ minWidth: "36px" }}>#</th>
                                                {PREVIEW_COLUMNS.map((col) => <th key={col.key} className="text-left p-2 font-medium text-gray-500 border-b whitespace-nowrap" style={{ minWidth: "130px" }}>{col.label}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {actions.uploadPreviewData.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50 border-b border-gray-100">
                                                    <td className="p-2 text-gray-400 whitespace-nowrap">{i + 1}</td>
                                                    {PREVIEW_COLUMNS.map((col) => <td key={col.key} className="p-2 whitespace-nowrap"><PreviewCellValue col={col} value={row[col.key]} /></td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={actions.closeUploadDialog}>Cancel</Button>
                        {actions.uploadTabActive === 2 && <Button variant="outline" onClick={() => actions.setUploadTabActive(1)}>← Back</Button>}
                        {actions.uploadTabActive === 1 && <Button onClick={actions.handlePreviewExcel} disabled={actions.processing || !actions.uploadFile || (actions.uploadMode === "revise" && !actions.selectedContractForRevision)}>{actions.processing ? "Memproses..." : "Preview Data →"}</Button>}
                        {actions.uploadTabActive === 2 && (
                            <Button onClick={actions.handleConfirmSave} disabled={actions.processing || (actions.uploadMode === "revise" && !!actions.previewValidationError)} className={`bg-green-600 text-white ${(actions.processing || (actions.uploadMode === "revise" && !!actions.previewValidationError)) ? "opacity-60" : "hover:bg-green-700"}`}>
                                {actions.processing ? (actions.uploadMode === "revise" ? "Revising..." : "Uploading...") : (actions.uploadMode === "revise" ? "Revise" : "Upload")}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Approval Dialog (Tugure Approver) ─────────────────────────── */}
            <Dialog open={actions.showApprovalDialog} onOpenChange={actions.setShowApprovalDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actions.approvalAction === "REVISION" ? "Send for Revision" : "Approve (Final)"} — {selectedContractIds.length} contract(s)</DialogTitle>
                        <DialogDescription>{actions.approvalAction === "REVISION" ? "Selected contracts will be sent back for revision." : "Selected contracts will be approved (final)."}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium">Remarks</label>
                        <Textarea value={actions.approvalRemarks} onChange={(e) => actions.setApprovalRemarks(e.target.value)} placeholder="Enter approval/revision remarks..." />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowApprovalDialog(false); actions.setApprovalAction(""); actions.setApprovalRemarks(""); }}>Cancel</Button>
                        <Button onClick={() => actions.handleApproverTugureAction(selectedContractIds, clearSelection)} disabled={actions.processing || (actions.approvalAction === "REVISION" && !actions.approvalRemarks)}>
                            {actions.processing ? "Processing..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Contract Action Dialog (Close/Invalidate) ─────────────────── */}
            <Dialog open={actions.showActionDialog} onOpenChange={actions.setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{actions.actionType === "close" ? "Close Contract" : "Invalidate Contract"}</DialogTitle>
                        <DialogDescription>{actions.selectedContract?.contract_id} — {actions.selectedContract?.policy_number}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Alert variant={actions.actionType === "close" ? "default" : "destructive"}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{actions.actionType === "close" ? "This contract will be marked as Inactive. No new batches can reference it." : "This contract will be permanently invalidated and cannot be used."}</AlertDescription>
                        </Alert>
                        <div>
                            <label className="text-sm font-medium">Remarks *</label>
                            <Textarea value={actions.approvalRemarks} onChange={(e) => actions.setApprovalRemarks(e.target.value)} placeholder="Enter reason for this action..." rows={3} />
                        </div>
                    </div>
                    <DialogFooter className="shrink-0 border-t pt-4">
                        <Button variant="outline" onClick={() => { actions.setShowActionDialog(false); actions.setApprovalRemarks(""); }}>Cancel</Button>
                        <Button onClick={actions.handleContractAction} disabled={actions.processing || !actions.approvalRemarks} variant={actions.actionType === "close" ? "default" : "destructive"}>
                            {actions.processing ? "Processing..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Version History Dialog ────────────────────────────────────── */}
            <Dialog open={actions.showVersionDialog} onOpenChange={actions.setShowVersionDialog}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Contract Version History</DialogTitle><DialogDescription>{actions.selectedContract?.contract_id}</DialogDescription></DialogHeader>
                    <div className="py-4">
                        {actions.selectedContract && (
                            <div className="space-y-4">
                                {contracts.filter((c) => c.contract_id === actions.selectedContract.contract_id || c.parent_contract_id === actions.selectedContract.contract_id).sort((a, b) => (b.version || 1) - (a.version || 1)).map((version, idx) => (
                                    <Card key={idx}><CardContent className="pt-4">
                                        <div className="flex items-center gap-2 mb-2"><Badge>Version {version.version || 1}</Badge><StatusBadge status={version.effective_status} /></div>
                                        <div className="text-sm space-y-1">
                                            <p><strong>Policy:</strong> {version.policy_no}</p>
                                            <p><strong>Coverage:</strong> {version.coverage_start_date} to {version.coverage_end_date}</p>
                                            {version.remark && <p><strong>Remarks:</strong> {version.remark}</p>}
                                        </div>
                                    </CardContent></Card>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => actions.setShowVersionDialog(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Detail Dialog ─────────────────────────────────────────────── */}
            <Dialog open={actions.showDetailDialog} onOpenChange={actions.setShowDetailDialog}>
                <DialogContent className="max-w-4xl w-full" style={{ maxHeight: "90vh", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <DialogHeader>
                        <DialogTitle>Master Contract Detail</DialogTitle>
                        <DialogDescription>{actions.selectedContract?.contract_no || actions.selectedContract?.contract_no_from || actions.selectedContract?.contract_id || "-"}</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {actions.selectedContract && Object.entries(actions.selectedContract).filter(([key]) => key !== "id").map(([key, val]) => (
                            <div key={key} className="border rounded p-2">
                                <div className="font-medium text-gray-600">{key}</div>
                                <div className="break-words">{val === null || val === undefined || val === "" ? "-" : String(val)}</div>
                            </div>
                        ))}
                    </div>
                    {actions.revisionDiffs.length > 0 && (
                        <div className="mt-4 w-full">
                            <div className="font-semibold mb-2">Revision Differences</div>
                            <div className="grid grid-cols-1 gap-2">
                                {actions.revisionDiffs.map((d) => (
                                    <div key={d.key} className="p-2 border rounded flex justify-between">
                                        <div className="w-1/3 font-medium text-sm">{d.key}</div>
                                        <div className="w-2/3 text-sm">
                                            <div className="text-yellow-600 font-normal">Old: {d.old}</div>
                                            <div className="text-green-600 font-medium text-base">New: {d.new}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button variant="outline" onClick={() => actions.setShowDetailDialog(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
