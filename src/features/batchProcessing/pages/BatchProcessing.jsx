import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, ArrowRight, Loader2, Eye, RefreshCw, Check, X, CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { formatRupiahAdaptive } from "@/utils/currency";
import { useKeycloakAuth } from "@/lib/KeycloakContext";
import { DEFAULT_BATCH_FILTER, BATCH_FILTER_STATUSES, getNextStatus, getActionLabel, getStatusField } from "../utils/batchProcessingConstants";
import { batchProcessingService } from "../services/batchProcessingService";
import { useBatchProcessingData } from "../hooks/useBatchProcessingData";

export default function BatchProcessing() {
    const { user } = useKeycloakAuth();
    const { batches, contracts, debtors, loading, filters, setFilters, filteredBatches, selectedBatches, setSelectedBatches, toggleBatchSelection, toggleAllSelection, reload } = useBatchProcessingData();

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [actionType, setActionType] = useState("");
    const [processing, setProcessing] = useState(false);
    const [remarks, setRemarks] = useState("");

    const handleBatchAction = async () => {
        if (!selectedBatch) return;
        setProcessing(true);

        if (actionType === "close") {
            const result = await batchProcessingService.closeBatch(selectedBatch, debtors, user?.email, user?.role);
            if (result.blocked) {
                alert(`❌ Cannot close batch.\n\n${result.unreviewed > 0 ? `${result.unreviewed} debtors not reviewed\n` : ""}${result.pendingClaims > 0 ? `${result.pendingClaims} claims pending` : ""}`);
            } else {
                toast.success("Batch closed successfully");
                setShowActionDialog(false);
                reload();
            }
        } else {
            const result = await batchProcessingService.advanceBatch(selectedBatch, user?.email, user?.role, remarks);
            if (result.blocked) {
                if (result.reason === "APPROVAL_BLOCKED") alert("❌ BLOCKED: Batch approval is handled automatically.\n\nPlease use Debtor Review menu to review and approve/reject debtors.");
                else if (result.reason === "NOTA_BLOCKED") alert("❌ BLOCKED: Debtor Review must be completed first.\n\nPlease go to Debtor Review menu to approve/reject debtors before generating Nota.");
            } else {
                toast.success(`Batch processed to ${result.nextStatus} successfully`);
                setShowActionDialog(false);
                setRemarks("");
                reload();
            }
        }
        setSelectedBatch(null);
        setProcessing(false);
    };

    const handleRejectBatch = async () => {
        if (!selectedBatch || !remarks) return;
        setProcessing(true);
        await batchProcessingService.rejectBatch(selectedBatch, user?.email, user?.role, remarks);
        toast.success("Batch sent for revision - BRINS can revise and resubmit");
        setShowRejectDialog(false);
        setRemarks("");
        reload();
        setProcessing(false);
    };

    const handleBulkAction = async () => {
        if (selectedBatches.length === 0) return;
        setProcessing(true);
        const batchesToProcess = batches.filter((b) => selectedBatches.includes(b.batch_id));
        await batchProcessingService.bulkAdvance(batchesToProcess, user?.email, user?.role);
        toast.success(`${batchesToProcess.length} batches processed successfully`);
        setShowBulkDialog(false);
        setSelectedBatches([]);
        reload();
        setProcessing(false);
    };

    const columns = [
        {
            header: <Checkbox checked={selectedBatches.length === filteredBatches.length && filteredBatches.length > 0} onCheckedChange={(checked) => toggleAllSelection(checked)} />,
            cell: (row) => <Checkbox checked={selectedBatches.includes(row.batch_id)} onCheckedChange={() => toggleBatchSelection(row.batch_id)} />,
            width: "40px",
        },
        { header: "Batch ID", cell: (row) => (<div><p className="font-medium font-mono">{row.batch_id}</p><p className="text-xs text-gray-500">{row.batch_month}/{row.batch_year} • v{row.version || 1}</p></div>) },
        { header: "Records", accessorKey: "total_records" },
        {
            header: "Raw / Final Exposure",
            cell: (row) => {
                const raw = Number(row.total_exposure) || 0; const final = Number(row.final_exposure_amount) || 0;
                return (<div><div className="text-sm">{formatRupiahAdaptive(raw)}</div>{final > 0 && <div className="text-xs text-green-600 font-bold">Final: {formatRupiahAdaptive(final)}</div>}</div>);
            },
        },
        {
            header: "Raw / Final Premium",
            cell: (row) => {
                const raw = Number(row.total_premium) || 0; const final = Number(row.final_premium_amount) || 0;
                return (<div><div className="text-sm">{formatRupiahAdaptive(raw)}</div>{final > 0 && <div className="text-xs text-green-600 font-bold">Final: {formatRupiahAdaptive(final)}</div>}</div>);
            },
        },
        {
            header: "Status",
            cell: (row) => (<div className="space-y-1"><StatusBadge status={row.status} />{row.batch_ready_for_nota && <div className="text-xs text-green-600 font-semibold">✓ Ready for Nota</div>}</div>),
        },
        {
            header: "Processed By",
            cell: (row) => { const { by, date } = getStatusField(row.status); return row[by] ? (<div className="text-xs"><p>{row[by]}</p><p className="text-gray-500">{row[date]}</p></div>) : "-"; },
        },
        {
            header: "Actions",
            cell: (row) => (
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedBatch(row); setShowViewDialog(true); }}><Eye className="w-4 h-4" /></Button>
                    {row.status !== "Closed" && row.status !== "Revision" && getNextStatus(row.status) && (
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => { setSelectedBatch(row); setActionType(getActionLabel(row.status)); setShowActionDialog(true); }} disabled={row.status === "Approved" && (!row.debtor_review_completed || !row.batch_ready_for_nota)}>
                            <ArrowRight className="w-4 h-4 mr-1" />{getActionLabel(row.status)}
                        </Button>
                    )}
                    {row.status === "Matched" && (
                        <Button size="sm" variant="destructive" onClick={() => { setSelectedBatch(row); setShowRejectDialog(true); }}><X className="w-4 h-4 mr-1" />Reject</Button>
                    )}
                    {row.status === "Paid" && (
                        <Button size="sm" className="bg-gray-600" onClick={() => { setSelectedBatch(row); setActionType("close"); setShowActionDialog(true); }}>Close Batch</Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Batch Processing"
                subtitle="Process batch submissions through workflow"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Batch Processing" }]}
                actions={
                    <div className="flex gap-2">
                        {selectedBatches.length > 0 && <Button className="bg-blue-600" onClick={() => setShowBulkDialog(true)}><Check className="w-4 h-4 mr-2" />Process ({selectedBatches.length})</Button>}
                        <Button variant="outline" onClick={reload}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <ModernKPI title="Total Batches" value={batches.length} subtitle="All submissions" icon={FileText} color="blue" />
                <ModernKPI title="Validated" value={batches.filter((b) => b.status === "Validated").length} subtitle="In processing" icon={CheckCircle2} color="teal" />
                <ModernKPI title="Approved" value={batches.filter((b) => b.status === "Approved").length} subtitle="Ready for nota" icon={CheckCircle2} color="green" />
                <ModernKPI title="Paid" value={batches.filter((b) => b.status === "Paid").length} subtitle="Payment completed" icon={DollarSign} color="purple" />
                <ModernKPI title="Revision" value={batches.filter((b) => b.status === "Revision").length} subtitle="Requires revision" icon={AlertCircle} color="red" />
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-600">Filter Batches</CardTitle></CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Contract</label>
                            <Select value={filters.contract} onValueChange={(val) => setFilters({ ...filters, contract: val })}>
                                <SelectTrigger><SelectValue placeholder="All Contracts" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Contracts</SelectItem>{contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Batch ID</label>
                            <Input placeholder="Search batch..." value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                            <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Status</SelectItem>{BATCH_FILTER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
                            <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label>
                            <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_BATCH_FILTER)}>Clear Filters</Button>
                    </div>
                </CardContent>
            </Card>

            <DataTable columns={columns} data={filteredBatches} isLoading={loading} />

            {/* Action Dialog */}
            <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{actionType} Batch</DialogTitle><DialogDescription>{selectedBatch?.batch_id}</DialogDescription></DialogHeader>
                    <div className="py-4"><label className="text-sm font-medium">Remarks</label><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} /></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
                        <Button onClick={handleBatchAction} disabled={processing} className="bg-blue-600">{processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirm</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reject Batch</DialogTitle><DialogDescription>{selectedBatch?.batch_id}</DialogDescription></DialogHeader>
                    <div className="py-4">
                        <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>Rejecting batch allows BRINS to revise and resubmit. All debtors will be marked inactive.</AlertDescription></Alert>
                        <label className="text-sm font-medium">Rejection Reason *</label>
                        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter reason..." rows={3} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRemarks(""); }}>Cancel</Button>
                        <Button onClick={handleRejectBatch} disabled={processing || !remarks} variant="destructive">{processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Reject Batch</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Process {selectedBatches.length} Batches</DialogTitle></DialogHeader>
                    <div className="py-4"><Alert className="bg-blue-50 border-blue-200"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">All selected batches will be moved to their next workflow status</AlertDescription></Alert></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
                        <Button onClick={handleBulkAction} disabled={processing} className="bg-blue-600">{processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Process</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Batch Details</DialogTitle><DialogDescription>{selectedBatch?.batch_id}</DialogDescription></DialogHeader>
                    <div className="py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Records:</span><span className="ml-2 font-medium">{selectedBatch?.total_records}</span></div>
                            <div><span className="text-gray-500">Exposure:</span><span className="ml-2 font-medium">Rp {(Number(selectedBatch?.total_exposure) || 0).toLocaleString()}</span></div>
                            <div><span className="text-gray-500">Premium:</span><span className="ml-2 font-medium">Rp {(Number(selectedBatch?.total_premium) || 0).toLocaleString()}</span></div>
                            <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedBatch?.status} /></div>
                            {selectedBatch?.final_exposure_amount > 0 && <div><span className="text-gray-500">Final Exposure:</span><span className="ml-2 font-medium text-green-600">Rp {(Number(selectedBatch?.final_exposure_amount) || 0).toLocaleString()}</span></div>}
                            {selectedBatch?.final_premium_amount > 0 && <div><span className="text-gray-500">Final Premium:</span><span className="ml-2 font-medium text-green-600">Rp {(Number(selectedBatch?.final_premium_amount) || 0).toLocaleString()}</span></div>}
                        </div>
                    </div>
                    <DialogFooter><Button onClick={() => setShowViewDialog(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
