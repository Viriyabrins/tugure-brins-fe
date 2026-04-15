import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Folder, File, CheckCircle2, AlertCircle, Plus, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { DEFAULT_DOC_ELIGIBILITY_FILTER, DOC_ELIGIBILITY_BATCH_STATUSES, DOC_ELIGIBILITY_DOC_STATUSES } from "../utils/documentEligibilityConstants";
import { documentEligibilityService } from "../services/documentEligibilityService";
import { useDocumentEligibilityData } from "../hooks/useDocumentEligibilityData";

export default function DocumentEligibilityBatch() {
    const { batches, debtors, documents, contracts, loading, filters, setFilters, filteredBatches, getBatchDocuments, selectedDocs, setSelectedDocs, toggleDocSelection, userEmail, reload } = useDocumentEligibilityData();

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [processing, setProcessing] = useState(false);

    const handleBulkUpload = async () => {
        if (!selectedBatch || uploadFiles.length === 0) { toast.error("Please select files to upload"); return; }
        const batch = batches.find((b) => b.id === selectedBatch);
        if (!batch) { toast.error("Batch not found"); return; }
        setProcessing(true);
        try {
            await documentEligibilityService.uploadDocuments(batch, uploadFiles, documents, userEmail);
            toast.success(`${uploadFiles.length} documents uploaded successfully`);
            setShowUploadDialog(false); setSelectedBatch(null); setUploadFiles([]); reload();
        } catch { toast.error("Failed to upload documents"); }
        setProcessing(false);
    };

    const handleDeleteDocs = async () => {
        if (selectedDocs.length === 0) return;
        if (!window.confirm(`Delete ${selectedDocs.length} document(s)?`)) return;
        setProcessing(true);
        try {
            await documentEligibilityService.deleteDocs(selectedDocs);
            toast.success(`${selectedDocs.length} document(s) deleted`);
            setSelectedDocs([]); reload();
        } catch { toast.error("Failed to delete documents"); }
        setProcessing(false);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Document Eligibility (Bordero)"
                subtitle="Bulk upload and manage debtor documents per batch"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Document Eligibility" }]}
                actions={
                    <div className="flex gap-2">
                        {selectedDocs.length > 0 && <Button variant="destructive" onClick={handleDeleteDocs} disabled={processing}><Trash2 className="w-4 h-4 mr-2" />Delete ({selectedDocs.length})</Button>}
                        <Button variant="outline" onClick={reload}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ModernKPI title="Total Batches" value={filteredBatches.length} subtitle={`${filteredBatches.reduce((s, b) => s + (b.total_records || 0), 0)} debtors`} icon={Folder} color="blue" />
                <ModernKPI title="Total Documents" value={documents.length} subtitle="All uploaded" icon={File} color="green" />
                <ModernKPI title="Pending Verification" value={documents.filter((d) => d.status === "PENDING").length} subtitle="Awaiting review" icon={AlertCircle} color="orange" />
                <ModernKPI title="Verified" value={documents.filter((d) => d.status === "VERIFIED").length} subtitle="Approved docs" icon={CheckCircle2} color="purple" />
            </div>

            <Card>
                <CardHeader><CardTitle className="text-sm font-semibold text-gray-600">Filter Documents</CardTitle></CardHeader>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Contract</label>
                            <Select value={filters.contract} onValueChange={(val) => setFilters({ ...filters, contract: val })}>
                                <SelectTrigger><SelectValue placeholder="All Contracts" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Contracts</SelectItem>{contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.contract_id}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Batch ID</label><Input placeholder="Search batch..." value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} /></div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Batch Status</label>
                            <Select value={filters.batchStatus} onValueChange={(val) => setFilters({ ...filters, batchStatus: val })}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All</SelectItem>{DOC_ELIGIBILITY_BATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Doc Status</label>
                            <Select value={filters.docStatus} onValueChange={(val) => setFilters({ ...filters, docStatus: val })}>
                                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All</SelectItem>{DOC_ELIGIBILITY_DOC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label><Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></div>
                        <div><label className="text-xs font-medium text-gray-600 mb-1 block">End Date</label><Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></div>
                    </div>
                    <div className="mt-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_DOC_ELIGIBILITY_FILTER)}>Clear Filters</Button></div>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {filteredBatches.map((batch) => {
                    const batchDocs = getBatchDocuments(batch.batch_id);
                    const debtor = debtors.find((d) => d.batch_id === batch.batch_id);
                    return (
                        <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Folder className="w-8 h-8 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg">{batch.batch_id}</CardTitle>
                                            <p className="text-sm text-gray-500">{batch.batch_month}/{batch.batch_year} • {batch.total_records || 0} debtors • v{batch.version || 1}</p>
                                            {debtor?.validation_remarks && <p className="text-xs text-orange-600 mt-1">⚠️ {debtor.validation_remarks}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge variant="outline">{batchDocs.length} docs</Badge>
                                        <Button size="sm" onClick={() => { setSelectedBatch(batch.id); setShowUploadDialog(true); }}><Plus className="w-4 h-4 mr-1" />Add Docs</Button>
                                    </div>
                                </div>
                            </CardHeader>
                            {batchDocs.length > 0 && (
                                <CardContent>
                                    <div className="space-y-2">
                                        {batchDocs.map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox checked={selectedDocs.includes(doc.id)} onCheckedChange={() => toggleDocSelection(doc.id)} onClick={(e) => e.stopPropagation()} />
                                                    <File className="w-5 h-5 text-blue-600" />
                                                    <div className="cursor-pointer flex-1" onClick={() => { setSelectedDocument({ ...doc, versions: batchDocs.filter((d) => d.document_name === doc.document_name) }); setShowViewDialog(true); }}>
                                                        <p className="font-medium text-sm">{doc.document_name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <StatusBadge status={doc.status} />
                                                            <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                                                            <span className="text-xs text-gray-500">{doc.upload_date}</span>
                                                            {doc.remarks && <span className="text-xs text-orange-600">{doc.remarks}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(doc.file_url, "_blank"); }}><Download className="w-4 h-4" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
                {filteredBatches.length === 0 && <Card><CardContent className="p-12 text-center text-gray-500">No batches found matching filters</CardContent></Card>}
            </div>

            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Upload Documents for Batch</DialogTitle><DialogDescription>{selectedBatch ? batches.find((b) => b.id === selectedBatch)?.batch_id : "Select batch"}</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4">
                        <Alert className="bg-blue-50 border-blue-200"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">Upload multiple files at once. Files can be any name/type - no restrictions.</AlertDescription></Alert>
                        <div>
                            <label className="text-sm font-medium">Select Files (multiple)</label>
                            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(e) => setUploadFiles(Array.from(e.target.files))} className="w-full mt-1" />
                            {uploadFiles.length > 0 && <p className="text-sm text-green-600 mt-2">{uploadFiles.length} file(s) selected</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowUploadDialog(false); setSelectedBatch(null); setUploadFiles([]); }}>Cancel</Button>
                        <Button onClick={handleBulkUpload} disabled={processing || !selectedBatch || uploadFiles.length === 0} className="bg-blue-600">{processing ? "Uploading..." : `Upload ${uploadFiles.length} File(s)`}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Document Details</DialogTitle><DialogDescription>{selectedDocument?.document_name}</DialogDescription></DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            {[["File Name", selectedDocument?.document_name], ["Version", <Badge key="v">v{selectedDocument?.version}</Badge>], ["Status", <StatusBadge key="s" status={selectedDocument?.status} />], ["Uploaded By", selectedDocument?.uploaded_by], ["Upload Date", selectedDocument?.upload_date]].map(([label, val]) => (
                                <div key={label} className="flex justify-between text-sm"><span className="text-gray-500">{label}:</span><span className="font-medium">{val}</span></div>
                            ))}
                        </div>
                        {selectedDocument?.versions?.length > 1 && (
                            <div>
                                <div className="text-sm font-medium mb-2">Version History:</div>
                                <div className="space-y-2">
                                    {selectedDocument.versions.map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                            <div className="flex items-center gap-2"><Badge variant="outline">v{doc.version}</Badge><span className="text-sm">{doc.upload_date}</span><StatusBadge status={doc.status} /></div>
                                            <Button variant="ghost" size="sm" onClick={() => window.open(doc.file_url, "_blank")}><Download className="w-4 h-4" /></Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
                        <Button onClick={() => window.open(selectedDocument?.file_url, "_blank")}><Download className="w-4 h-4 mr-2" />Download</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
