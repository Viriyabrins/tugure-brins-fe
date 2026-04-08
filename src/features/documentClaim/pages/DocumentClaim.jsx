import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, RefreshCw, Folder, File, CheckCircle2, AlertCircle, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { DEFAULT_DOC_CLAIM_FILTER } from "../utils/documentClaimConstants";
import { documentClaimService } from "../services/documentClaimService";
import { useDocumentClaimData } from "../hooks/useDocumentClaimData";

export default function DocumentClaim() {
    const { batches, contracts, loading, filters, setFilters, filteredBatches, getBatchDocuments, userEmail, reload } = useDocumentClaimData();

    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [processing, setProcessing] = useState(false);

    const handleBulkUpload = async () => {
        if (!selectedBatch || uploadFiles.length === 0) { toast.error("Please select files"); return; }
        const batch = batches.find((b) => b.id === selectedBatch || b.batch_id === selectedBatch);
        if (!batch) { toast.error("Batch not found"); return; }
        setProcessing(true);
        try {
            await documentClaimService.uploadDocuments(batch, uploadFiles, userEmail);
            toast.success(`${uploadFiles.length} documents uploaded`);
            setShowUploadDialog(false); setSelectedBatch(null); setUploadFiles([]); reload();
        } catch { toast.error("Failed to upload documents"); }
        setProcessing(false);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Document Claim"
                subtitle="Upload claim documents per batch"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Document Claim" }]}
                actions={<Button variant="outline" onClick={reload}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>}
            />

            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <Select value={filters.contract} onValueChange={(val) => setFilters({ ...filters, contract: val })}>
                            <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Contracts</SelectItem>{contracts.map((c) => <SelectItem key={c.id || c.contract_number} value={c.id || c.contract_number}>{c.contract_number || c.contract_id || c.id}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input placeholder="Batch..." value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })} />
                        <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="VERIFIED">Verified</SelectItem></SelectContent>
                        </Select>
                        <Select value={filters.version} onValueChange={(val) => setFilters({ ...filters, version: val })}>
                            <SelectTrigger><SelectValue placeholder="Version" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="1">v1</SelectItem><SelectItem value="2">v2</SelectItem></SelectContent>
                        </Select>
                        <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                        <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                    </div>
                    <div className="mt-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_DOC_CLAIM_FILTER)}>Clear</Button></div>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {filteredBatches.map((batch) => {
                    const batchDocs = getBatchDocuments(batch.batch_id || batch.id);
                    return (
                        <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Folder className="w-8 h-8 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg">{batch.batch_id || batch.id}</CardTitle>
                                            <p className="text-sm text-gray-500">{batch.batch_month}/{batch.batch_year} • v{batch.version || 1}</p>
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
                                        {batchDocs.map((doc) => (
                                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <File className="w-5 h-5 text-blue-600" />
                                                    <div>
                                                        <p className="font-medium text-sm">{doc.document_name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <StatusBadge status={doc.status} />
                                                            <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                                                            <span className="text-xs text-gray-500">{doc.upload_date}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => window.open(doc.file_url, "_blank")}><Download className="w-4 h-4" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Claim Documents</DialogTitle>
                        <DialogDescription>{selectedBatch ? batches.find((b) => b.id === selectedBatch || b.batch_id === selectedBatch)?.batch_id : ""}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Alert className="bg-blue-50 border-blue-200 mb-4"><AlertCircle className="h-4 w-4 text-blue-600" /><AlertDescription className="text-blue-700">Upload multiple claim documents - accepted formats: PDF, JPG, JPEG, PNG, DOC, DOCX</AlertDescription></Alert>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setUploadFiles(Array.from(e.target.files))} className="hidden" id="file-upload" />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-600">Click to select files or drag and drop</p>
                                <p className="text-sm text-gray-400 mt-1">Multiple files allowed</p>
                            </label>
                        </div>
                        {uploadFiles.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-green-600">{uploadFiles.length} file(s) selected:</p>
                                <ul className="mt-2 text-sm text-gray-600">{uploadFiles.map((file, i) => <li key={i} className="truncate">• {file.name}</li>)}</ul>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadFiles([]); }}>Cancel</Button>
                        <Button onClick={handleBulkUpload} disabled={processing || uploadFiles.length === 0} className="bg-blue-600">
                            {processing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : `Upload ${uploadFiles.length} File(s)`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
