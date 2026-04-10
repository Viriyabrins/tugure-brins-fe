import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    FileText, CheckCircle2, Eye, RefreshCw, Check, Loader2,
    DollarSign, AlertCircle, Plus, ShieldCheck, Pen, Paperclip,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import { formatRupiahAdaptive } from "@/utils/currency";
import { DEFAULT_CLAIM_FILTER, CLAIM_PAGE_SIZE } from "../utils/claimReviewConstants";
import { useClaimReviewData } from "../hooks/useClaimReviewData";
import { useClaimReviewActions } from "../hooks/useClaimReviewActions";
import { FilePreviewModal } from "../../claims/components/FilePreviewModal";

export default function ClaimReview() {
    const data = useClaimReviewData();
    const {
        user, auditActor, tokenRoles,
        claims, totalClaims, subrogations, notas, contracts, debtors, batches,
        loading, filters, setFilters, claimPage, setClaimPage,
        loadData, canCheck, canApprove,
    } = data;

    const [selectedClaims, setSelectedClaims] = useState([]);
    const [activeTab, setActiveTab] = useState("review");
    const [filePreviewOpen, setFilePreviewOpen] = useState(false);
    const [selectedClaimForFiles, setSelectedClaimForFiles] = useState(null);

    const actions = useClaimReviewActions({
        user, auditActor, claims, selectedClaims, setSelectedClaims,
        debtors, notas, subrogations, loadData,
    });

    const pendingClaims = claims.filter((c) => c.status === "SUBMITTED" || c.status === "CHECKED");

    const claimPagination = {
        from: totalClaims === 0 ? 0 : (claimPage - 1) * CLAIM_PAGE_SIZE + 1,
        to: Math.min(totalClaims, claimPage * CLAIM_PAGE_SIZE),
        total: totalClaims,
        page: claimPage,
        totalPages: Math.max(1, Math.ceil(totalClaims / CLAIM_PAGE_SIZE)),
    };

    const claimColumns = [
        {
            header: (
                <Checkbox
                    checked={selectedClaims.length === claims.length && claims.length > 0}
                    onCheckedChange={(checked) => setSelectedClaims(checked ? claims.map((c) => c.id) : [])}
                />
            ),
            cell: (row) => (
                <Checkbox checked={selectedClaims.includes(row.id)}
                    onCheckedChange={(checked) => setSelectedClaims(checked ? [...selectedClaims, row.id] : selectedClaims.filter((id) => id !== row.id))} />
            ),
            width: "50px",
        },
        { header: "Claim No", accessorKey: "claim_no" },
        { header: "Batch ID", accessorKey: "batch_id" },
        {
            header: "Debtor", accessorKey: "nama_tertanggung",
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.nama_tertanggung}</div>
                    <div className="text-xs text-gray-500">{row.nomor_peserta}</div>
                </div>
            ),
        },
        { header: "Claim Amount", cell: (row) => formatRupiahAdaptive(Number(row.nilai_klaim) || 0) },
        { header: "Share Tugure", cell: (row) => formatRupiahAdaptive(Number(row.share_tugure_amount) || 0) },
        { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { actions.setSelectedClaim(row); actions.setShowViewDialog(true); }}>
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedClaimForFiles(row); setFilePreviewOpen(true); }}>
                        <Paperclip className="w-4 h-4" />
                    </Button>
                    {canCheck && row.status === "SUBMITTED" && (
                        <Button size="sm" variant="outline" onClick={() => { actions.setSelectedClaim(row); actions.setActionType("check"); actions.setShowActionDialog(true); }}>
                            <Check className="w-4 h-4 mr-1" />Check
                        </Button>
                    )}
                    {canApprove && row.status === "CHECKED" && (
                        <>
                            <Button size="sm" variant="outline" className="text-green-600 border-green-300"
                                onClick={() => { actions.setSelectedClaim(row); actions.setActionType("approve"); actions.setShowActionDialog(true); }}>
                                <ShieldCheck className="w-4 h-4 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-orange-600 border-orange-300"
                                onClick={() => { actions.setSelectedClaim(row); actions.setActionType("revise"); actions.setShowActionDialog(true); }}>
                                <Pen className="w-4 h-4 mr-1" />Revise
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    if (loading && !claims.length) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Claim Review"
                subtitle="Review and process claims - generates Claim Nota"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Claim Review" }]}
                actions={<Button variant="outline" onClick={loadData}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>}
            />

            {actions.successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">{actions.successMessage}</AlertDescription>
                </Alert>
            )}
            {actions.errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{actions.errorMessage}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard title="Pending Review" value={pendingClaims.length} subtitle="Awaiting action" icon={FileText} gradient="from-orange-500 to-orange-600" />
                <GradientStatCard title="Total Claims" value={claims.length} subtitle={formatRupiahAdaptive(claims.reduce((s, c) => s + (Number(c.nilai_klaim) || 0), 0))} icon={DollarSign} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Approved" value={claims.filter((c) => c.status === "APPROVED").length} subtitle="Nota created" icon={CheckCircle2} gradient="from-purple-500 to-purple-600" />
                <GradientStatCard title="Paid" value={claims.filter((c) => c.claim_status === "Paid").length} subtitle="Completed" icon={CheckCircle2} gradient="from-green-500 to-green-600" />
            </div>

            <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_CLAIM_FILTER}
                filterConfig={[
                    { key: "contract", label: "Contract", options: [{ value: "all", label: "All Contracts" }, ...contracts.map((c) => ({ value: c.id, label: c.contract_number }))] },
                    { key: "batch", label: "Batch ID", options: [{ value: "all", label: "All Batches" }, ...batches.map((b) => ({ value: b.batch_id, label: b.batch_id }))] },
                    { key: "claimStatus", label: "Claim Status", options: [{ value: "all", label: "All Status" }, { value: "SUBMITTED", label: "Submitted" }, { value: "CHECKED", label: "Checked" }, { value: "APPROVED", label: "Approved" }, { value: "REVISION", label: "Revision" }] },
                ]}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="review">Pending ({pendingClaims.length})</TabsTrigger>
                    <TabsTrigger value="all">All ({claims.length})</TabsTrigger>
                    <TabsTrigger value="subrogation">Subrogation ({subrogations.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="review">
                    <DataTable columns={claimColumns} data={pendingClaims} isLoading={loading} emptyMessage="No pending claims" pagination={claimPagination} onPageChange={setClaimPage} />
                </TabsContent>
                <TabsContent value="all">
                    <DataTable columns={claimColumns} data={claims} isLoading={loading} emptyMessage="No claims" pagination={claimPagination} onPageChange={setClaimPage} />
                </TabsContent>
                <TabsContent value="subrogation">
                    <DataTable
                        columns={[
                            { header: "Subrogation ID", accessorKey: "subrogation_id" },
                            { header: "Claim ID", accessorKey: "claim_id" },
                            { header: "Recovery Amount", cell: (row) => formatRupiahAdaptive(Number(row.recovery_amount) || 0) },
                            { header: "Recovery Date", cell: (row) => row.recovery_date ? new Date(row.recovery_date).toLocaleDateString("id-ID") : "-" },
                            { header: "Status", cell: (row) => <StatusBadge status={row.status} /> },
                            {
                                header: "Actions",
                                cell: (row) => (
                                    <div className="flex gap-2">
                                        {canCheck && row.status === "SUBMITTED" && (
                                            <Button size="sm" variant="outline" onClick={() => { actions.setSelectedSubrogation(row); actions.setSubrogationActionType("check"); actions.setShowSubrogationActionDialog(true); }}>
                                                <Check className="w-4 h-4 mr-1" />Check
                                            </Button>
                                        )}
                                        {canApprove && row.status === "CHECKED" && (
                                            <>
                                                <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => { actions.setSelectedSubrogation(row); actions.setSubrogationActionType("approve"); actions.setShowSubrogationActionDialog(true); }}>
                                                    <ShieldCheck className="w-4 h-4 mr-1" />Approve
                                                </Button>
                                                <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => { actions.setSelectedSubrogation(row); actions.setSubrogationActionType("revise"); actions.setShowSubrogationActionDialog(true); }}>
                                                    <Pen className="w-4 h-4 mr-1" />Revise
                                                </Button>
                                            </>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => { actions.setSelectedSubrogation(row); }}><Eye className="w-4 h-4" /></Button>
                                    </div>
                                ),
                            },
                        ]}
                        data={subrogations} isLoading={loading} emptyMessage="No subrogations"
                    />
                </TabsContent>
            </Tabs>

            {/* ── Action Dialog ───────────────────────────────────────────────── */}
            <Dialog open={actions.showActionDialog} onOpenChange={actions.setShowActionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actions.actionType.includes("check") && (actions.actionType.includes("bulk") ? "Bulk Check Claims" : "Check Claim")}
                            {actions.actionType.includes("approve") && (actions.actionType.includes("bulk") ? "Bulk Approve Claims" : "Approve Claim and Issue Nota")}
                            {actions.actionType.includes("revise") && (actions.actionType.includes("bulk") ? "Bulk Request Revision" : "Request Revision")}
                        </DialogTitle>
                        <DialogDescription>
                            {actions.actionType.includes("bulk") ? `Processing ${selectedClaims.length} selected claims` : `${actions.selectedClaim?.claim_no} - ${actions.selectedClaim?.nama_tertanggung}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {actions.actionType.includes("approve") && (
                            <Alert className="bg-purple-50 border-purple-200">
                                <Plus className="h-4 w-4 text-purple-600" />
                                <AlertDescription className="text-purple-700">
                                    <strong>Creating Claim Nota</strong> — Type: Claim, Status: UNPAID<br />
                                    Nota follows: Draft → Issued → Confirmed → Paid
                                </AlertDescription>
                            </Alert>
                        )}
                        {!actions.actionType.includes("bulk") && actions.selectedClaim && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{actions.selectedClaim.claim_no}</span></div>
                                    <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{actions.selectedClaim.nama_tertanggung}</span></div>
                                    <div><span className="text-gray-500">Claim Amount:</span><span className="ml-2 font-bold">{formatRupiahAdaptive(Number(actions.selectedClaim.nilai_klaim) || 0)}</span></div>
                                    <div><span className="text-gray-500">Share TUGURE:</span><span className="ml-2 font-bold text-green-600">{formatRupiahAdaptive(Number(actions.selectedClaim.share_tugure_amount) || 0)}</span></div>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Remarks</Label>
                            <Textarea value={actions.remarks} onChange={(e) => actions.setRemarks(e.target.value)} rows={3} placeholder="Enter remarks..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowActionDialog(false); actions.setRemarks(""); }}>Cancel</Button>
                        <Button onClick={() => actions.handleClaimAction()} disabled={actions.processing} className="bg-blue-600" type="button">
                            {actions.processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Dialog ─────────────────────────────────────────────────── */}
            <Dialog open={actions.showViewDialog} onOpenChange={actions.setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Claim Details</DialogTitle>
                        <DialogDescription>{actions.selectedClaim?.claim_no}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{actions.selectedClaim?.claim_no}</span></div>
                            <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{actions.selectedClaim?.nama_tertanggung}</span></div>
                            <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">{formatRupiahAdaptive(Number(actions.selectedClaim?.nilai_klaim) || 0)}</span></div>
                            <div><span className="text-gray-500">Status:</span><StatusBadge status={actions.selectedClaim?.status} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={() => actions.setShowViewDialog(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Subrogation Action Dialog ───────────────────────────────────── */}
            <Dialog open={actions.showSubrogationActionDialog} onOpenChange={(open) => { actions.setShowSubrogationActionDialog(open); if (!open) { actions.setSubrogationRemarks(""); actions.setSubrogationActionType(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actions.subrogationActionType === "check" && "Check Subrogation"}
                            {actions.subrogationActionType === "approve" && "Approve Subrogation & Generate Nota"}
                            {actions.subrogationActionType === "revise" && "Request Revision"}
                        </DialogTitle>
                        <DialogDescription>{actions.selectedSubrogation?.subrogation_id}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {actions.subrogationActionType === "approve" && (
                            <Alert className="bg-green-50 border-green-200">
                                <Plus className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                    <strong>Generating Nota Subrogation</strong> — Type: Subrogation, Status: UNPAID<br />
                                    Will appear in the Subrogation tab in Nota Management.
                                </AlertDescription>
                            </Alert>
                        )}
                        {actions.selectedSubrogation && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Subrogation ID:</span><span className="ml-2 font-medium">{actions.selectedSubrogation.subrogation_id}</span></div>
                                    <div><span className="text-gray-500">Claim ID:</span><span className="ml-2 font-medium">{actions.selectedSubrogation.claim_id}</span></div>
                                    <div><span className="text-gray-500">Recovery Amount:</span><span className="ml-2 font-bold text-green-600">{formatRupiahAdaptive(Number(actions.selectedSubrogation.recovery_amount) || 0)}</span></div>
                                    <div><span className="text-gray-500">Status:</span><span className="ml-2"><StatusBadge status={actions.selectedSubrogation.status} /></span></div>
                                </div>
                            </div>
                        )}
                        <div>
                            <Label>Remarks</Label>
                            <Textarea value={actions.subrogationRemarks} onChange={(e) => actions.setSubrogationRemarks(e.target.value)} rows={3} placeholder="Enter remarks..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { actions.setShowSubrogationActionDialog(false); actions.setSubrogationRemarks(""); actions.setSubrogationActionType(""); }}>Cancel</Button>
                        <Button onClick={actions.handleSubrogationAction} disabled={actions.subrogationProcessing}
                            className={actions.subrogationActionType === "approve" ? "bg-green-600" : "bg-blue-600"}>
                            {actions.subrogationProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {actions.subrogationActionType === "approve" ? "Approve & Generate Nota" : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── File Preview Modal ──────────────────────────────────────────── */}
            {selectedClaimForFiles && (
                <FilePreviewModal
                    open={filePreviewOpen}
                    onClose={() => {
                        setFilePreviewOpen(false);
                        setSelectedClaimForFiles(null);
                    }}
                    claimId={selectedClaimForFiles.claim_no}
                    batchId={selectedClaimForFiles.batch_id}
                />
            )}
        </div>
    );
}
