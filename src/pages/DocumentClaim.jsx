import React, { useState, useEffect } from "react";
import keycloakService from "@/services/keycloakService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    RefreshCw,
    Eye,
    Folder,
    File,
    CheckCircle2,
    AlertCircle,
    Plus,
    Download,
    DollarSign,
    Clock,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

export default function DocumentClaim() {
    const [user, setUser] = useState(null);
    const [batches, setBatches] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [filters, setFilters] = useState({
        contract: "all",
        batch: "",
        status: "all",
        version: "all",
        startDate: "",
        endDate: "",
    });

    useEffect(() => {
        loadUser();
        loadData();
    }, []);

    const loadUser = () => {
        try {
            const userInfo = keycloakService.getCurrentUserInfo();
            if (userInfo) {
                const roles = keycloakService.getRoles();
                let role = 'USER';
                if (roles.includes('admin') || roles.includes('ADMIN')) role = 'admin';
                else if (roles.includes('BRINS')) role = 'BRINS';
                else if (roles.includes('TUGURE')) role = 'TUGURE';
                setUser({ id: userInfo.id, email: userInfo.email, full_name: userInfo.name, role });
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [batchData, docData, contractData] = await Promise.all([
                backend.list("Batch"),
                backend.list("Document"),
                backend.list("Contract"), // Ubah dari MasterContract ke Contract
            ]);

            // Pastikan data adalah array
            const nextBatches = Array.isArray(batchData) ? batchData : [];
            const nextDocuments = Array.isArray(docData) ? docData : [];
            const nextContracts = Array.isArray(contractData)
                ? contractData
                : [];

            // Filter documents yang memiliki claim_id
            const claimDocuments = nextDocuments.filter((d) => d.claim_id);

            // Filter contracts yang aktif
            const activeContracts = nextContracts.filter(
                (c) => c.status === "ACTIVE",
            );

            setBatches(nextBatches);
            setDocuments(claimDocuments);
            setContracts(activeContracts);
        } catch (error) {
            console.error("Failed to load data:", error);
            setBatches([]);
            setDocuments([]);
            setContracts([]);
        }
        setLoading(false);
    };

    const getBatchDocuments = (batchId) => {
        return documents.filter((d) => d.batch_id === batchId);
    };

    const handleBulkUpload = async () => {
        if (!selectedBatch || uploadFiles.length === 0) {
            setErrorMessage("Please select files");
            return;
        }

        setProcessing(true);
        setErrorMessage("");
        try {
            const batch = batches.find(
                (b) => b.id === selectedBatch || b.batch_id === selectedBatch,
            );

            if (!batch) {
                setErrorMessage("Batch not found");
                setProcessing(false);
                return;
            }

            for (const file of uploadFiles) {
                // Untuk demo, kita gunakan URL dummy karena backend mungkin tidak punya upload file
                // Jika punya endpoint upload, bisa disesuaikan
                const file_url = URL.createObjectURL(file); // URL lokal untuk preview

                const existingDocs = documents.filter(
                    (d) =>
                        d.batch_id === batch.batch_id &&
                        d.document_name === file.name &&
                        d.claim_id,
                );
                const latestVersion =
                    existingDocs.length > 0
                        ? Math.max(...existingDocs.map((d) => d.version || 1))
                        : 0;

                // Buat dokumen menggunakan backend client
                await backend.create("Document", {
                    batch_id: batch.batch_id,
                    claim_id: batch.batch_id, // Untuk demo, claim_id sama dengan batch_id
                    document_type: "Claim Document",
                    document_name: file.name,
                    file_url: file_url,
                    upload_date: new Date().toISOString().split("T")[0],
                    status: "PENDING",
                    version: latestVersion + 1,
                    parent_document_id:
                        existingDocs.length > 0
                            ? existingDocs[existingDocs.length - 1].id
                            : null,
                    uploaded_by: user?.email,
                });
            }

            // Buat notifikasi menggunakan backend client
            await backend.create("Notification", {
                title: "Claim Documents Uploaded",
                message: `${uploadFiles.length} claim documents uploaded for batch ${batch.batch_id}`,
                type: "INFO",
                module: "DOCUMENT",
                reference_id: batch.batch_id,
                target_role: "TUGURE",
            });

            setSuccessMessage(`${uploadFiles.length} documents uploaded`);
            setShowUploadDialog(false);
            setSelectedBatch(null);
            setUploadFiles([]);
            loadData(); // Reload data
        } catch (error) {
            console.error("Upload error:", error);
            setErrorMessage("Failed to upload documents");
        }
        setProcessing(false);
    };

    const filteredBatches = batches.filter((b) => {
        if (filters.contract !== "all" && b.contract_id !== filters.contract)
            return false;
        if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
        if (filters.startDate && b.created_date < filters.startDate)
            return false;
        if (filters.endDate && b.created_date > filters.endDate) return false;

        const batchDocs = getBatchDocuments(b.batch_id);
        if (
            filters.status !== "all" &&
            !batchDocs.some((d) => d.status === filters.status)
        )
            return false;
        if (
            filters.version !== "all" &&
            !batchDocs.some((d) => d.version === parseInt(filters.version))
        )
            return false;

        return true;
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Document Claim"
                subtitle="Upload claim documents per batch"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Document Claim" },
                ]}
                actions={
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                }
            />

            {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {successMessage}
                    </AlertDescription>
                </Alert>
            )}

            {errorMessage && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <Select
                            value={filters.contract}
                            onValueChange={(val) =>
                                setFilters({ ...filters, contract: val })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Contract" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Contracts
                                </SelectItem>
                                {contracts.map((c) => (
                                    <SelectItem
                                        key={c.id || c.contract_number}
                                        value={c.id || c.contract_number}
                                    >
                                        {c.contract_number ||
                                            c.contract_id ||
                                            c.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Batch..."
                            value={filters.batch}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    batch: e.target.value,
                                })
                            }
                        />
                        <Select
                            value={filters.status}
                            onValueChange={(val) =>
                                setFilters({ ...filters, status: val })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="VERIFIED">
                                    Verified
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.version}
                            onValueChange={(val) =>
                                setFilters({ ...filters, version: val })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Version" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="1">v1</SelectItem>
                                <SelectItem value="2">v2</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    startDate: e.target.value,
                                })
                            }
                        />
                        <Input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    endDate: e.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setFilters({
                                    contract: "all",
                                    batch: "",
                                    status: "all",
                                    version: "all",
                                    startDate: "",
                                    endDate: "",
                                })
                            }
                        >
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Batches */}
            <div className="grid gap-4">
                {filteredBatches.map((batch) => {
                    const batchDocs = getBatchDocuments(
                        batch.batch_id || batch.id,
                    );

                    return (
                        <Card
                            key={batch.id}
                            className="hover:shadow-lg transition-shadow"
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Folder className="w-8 h-8 text-blue-600" />
                                        <div>
                                            <CardTitle className="text-lg">
                                                {batch.batch_id || batch.id}
                                            </CardTitle>
                                            <p className="text-sm text-gray-500">
                                                {batch.batch_month}/
                                                {batch.batch_year} • v
                                                {batch.version || 1}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge variant="outline">
                                            {batchDocs.length} docs
                                        </Badge>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setSelectedBatch(batch.id);
                                                setShowUploadDialog(true);
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add Docs
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            {batchDocs.length > 0 && (
                                <CardContent>
                                    <div className="space-y-2">
                                        {batchDocs.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <File className="w-5 h-5 text-blue-600" />
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {doc.document_name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <StatusBadge
                                                                status={
                                                                    doc.status
                                                                }
                                                            />
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                v{doc.version}
                                                            </Badge>
                                                            <span className="text-xs text-gray-500">
                                                                {
                                                                    doc.upload_date
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        window.open(
                                                            doc.file_url,
                                                            "_blank",
                                                        )
                                                    }
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Upload Dialog */}
            <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Claim Documents</DialogTitle>
                        <DialogDescription>
                            {selectedBatch
                                ? batches.find(
                                      (b) =>
                                          b.id === selectedBatch ||
                                          b.batch_id === selectedBatch,
                                  )?.batch_id
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Alert className="bg-blue-50 border-blue-200 mb-4">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                Upload multiple claim documents - accepted
                                formats: PDF, JPG, JPEG, PNG, DOC, DOCX
                            </AlertDescription>
                        </Alert>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={(e) =>
                                    setUploadFiles(Array.from(e.target.files))
                                }
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="cursor-pointer"
                            >
                                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-600">
                                    Click to select files or drag and drop
                                </p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Multiple files allowed
                                </p>
                            </label>
                        </div>
                        {uploadFiles.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-medium text-green-600">
                                    {uploadFiles.length} file(s) selected:
                                </p>
                                <ul className="mt-2 text-sm text-gray-600">
                                    {uploadFiles.map((file, index) => (
                                        <li key={index} className="truncate">
                                            • {file.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowUploadDialog(false);
                                setUploadFiles([]);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkUpload}
                            disabled={processing || uploadFiles.length === 0}
                            className="bg-blue-600"
                        >
                            {processing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                `Upload ${uploadFiles.length} File(s)`
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Document Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Document Details</DialogTitle>
                    </DialogHeader>
                    {selectedDocument && (
                        <div className="py-4 space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">
                                            Document Name:
                                        </span>
                                        <p className="font-medium">
                                            {selectedDocument.document_name}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Type:
                                        </span>
                                        <p className="font-medium">
                                            {selectedDocument.document_type}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Status:
                                        </span>
                                        <StatusBadge
                                            status={selectedDocument.status}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Version:
                                        </span>
                                        <p className="font-medium">
                                            v{selectedDocument.version || 1}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Upload Date:
                                        </span>
                                        <p className="font-medium">
                                            {selectedDocument.upload_date}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">
                                            Uploaded By:
                                        </span>
                                        <p className="font-medium">
                                            {selectedDocument.uploaded_by}
                                        </p>
                                    </div>
                                    {selectedDocument.file_url && (
                                        <div className="col-span-2">
                                            <span className="text-gray-500">
                                                File URL:
                                            </span>
                                            <p className="font-medium truncate">
                                                {selectedDocument.file_url}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {selectedDocument.file_url && (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() =>
                                            window.open(
                                                selectedDocument.file_url,
                                                "_blank",
                                            )
                                        }
                                        className="flex-1"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download File
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowViewDialog(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload Dialog */}
            {/* <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Claim Documents</DialogTitle>
                        <DialogDescription>
                            {selectedBatch
                                ? batches.find((b) => b.id === selectedBatch)
                                      ?.batch_id
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Alert className="bg-blue-50 border-blue-200 mb-4">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-700">
                                Upload multiple files - any name/type
                            </AlertDescription>
                        </Alert>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) =>
                                setUploadFiles(Array.from(e.target.files))
                            }
                            className="w-full"
                        />
                        {uploadFiles.length > 0 && (
                            <p className="text-sm text-green-600 mt-2">
                                {uploadFiles.length} file(s) selected
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowUploadDialog(false);
                                setUploadFiles([]);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkUpload}
                            disabled={processing || uploadFiles.length === 0}
                            className="bg-blue-600"
                        >
                            {processing
                                ? "Uploading..."
                                : `Upload ${uploadFiles.length} File(s)`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog> */}
        </div>
    );
}
