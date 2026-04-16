import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Trash2, Loader, Upload as UploadIcon, Eye } from "lucide-react";
import { getDownloadUrl, removeFile, getFilesByPath, uploadMultipleFilesToPath } from "@/services/storageService";
import { formatFileSize, getFileIcon } from "@/utils/fileValidation"; 
import { DocumentPreviewModal } from "@/components/common/DocumentPreviewModal"; 

/**
 * Modal for viewing, downloading, and deleting attached files for a claim.
 *
 * Props:
 *   open         {boolean}
 *   onClose      {() => void}
 *   recordId     {string} - Record ID (nomor_peserta, etc.) to load files for
 *   batchId      {string} - Batch ID (used in MinIO path)
 *   readOnly     {boolean} - If true, disables upload and delete functions
 *   onFilesLoaded {(files) => void} - Callback when files are loaded
 */
export function FilePreviewModal({ open, onClose, recordId, readOnly = false, onFilesLoaded }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [downloading, setDownloading] = useState({});
    const [deleting, setDeleting] = useState({});
    const [uploading, setUploading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewFileName, setPreviewFileName] = useState("");

    useEffect(() => {
        if (open && recordId) {
            loadFiles();
        }
    }, [open, recordId]);

    const loadFiles = async () => {
        setLoading(true);
        setError("");
        try {
            const fileList = await getFilesByPath('claim', 'attachment', recordId);
            setFiles(fileList);
            onFilesLoaded?.(fileList);
        } catch (err) {
            console.error("Failed to load files:", err);
            setError(`Failed to load files: ${err.message}`);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (file) => {
        if (!file.key) return;

        setDownloading((prev) => ({ ...prev, [file.key]: true }));
        try {
            const url = await getDownloadUrl(file.key);
            
            // Create a temporary link and click it to download
            const link = document.createElement("a");
            link.href = url;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Failed to download file:", err);
            setError(`Failed to download ${file.fileName}: ${err.message}`);
        } finally {
            setDownloading((prev) => ({ ...prev, [file.key]: false }));
        }
    };

    const handlePreview = async (file) => {
        if (!file.key) return;

        setDownloading((prev) => ({ ...prev, [file.key]: true }));
        try {
            const url = await getDownloadUrl(file.key);
            setPreviewUrl(url);
            setPreviewFileName(file.fileName);
            setPreviewOpen(true);
        } catch (err) {
            console.error("Failed to preview file:", err);
            setError(`Failed to preview ${file.fileName}: ${err.message}`);
        } finally {
            setDownloading((prev) => ({ ...prev, [file.key]: false }));
        }
    };

    const handleDelete = async (file) => {
        if (!confirm(`Are you sure you want to delete "${file.fileName}"?`)) return;

        if (!file.key) return;

        setDeleting((prev) => ({ ...prev, [file.key]: true }));
        try {
            await removeFile(file.key);
            setFiles((prev) => prev.filter((f) => f.key !== file.key));
        } catch (err) {
            console.error("Failed to delete file:", err);
            setError(`Failed to delete ${file.fileName}: ${err.message}`);
        } finally {
            setDeleting((prev) => ({ ...prev, [file.key]: false }));
        }
    };

    const handleUpload = async (e) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (!selectedFiles.length) return;

        setUploading(true);
        setError("");
        try {
            const result = await uploadMultipleFilesToPath(selectedFiles, { folder: 'claim', subfolder: 'attachment', recordId });
            if (!result.success) {
                setError(`Failed to upload some files:\\n${result.errors.join("\\n")}`);
            }
            // Reload files whether successful or partial failure to show what was uploaded
            await loadFiles();
        } catch (err) {
            console.error("Upload failed", err);
            setError(`Failed to upload files: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = ""; // Reset input
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        Attached Files
                        {files.length > 0 && (
                            <span className="text-sm font-normal text-gray-500 ml-2">
                                ({files.length} file{files.length !== 1 ? "s" : ""})
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
                    </Alert>
                )}

                {!readOnly && (
                    <div className="flex items-center gap-2 mb-2">
                        <label className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                            {uploading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <UploadIcon className="w-4 h-4 mr-2" />}
                            {uploading ? "Uploading..." : "Upload Files"}
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleUpload}
                                disabled={uploading}
                                accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.txt,.csv"
                            />
                        </label>
                    </div>
                )}

                <div className="min-h-fit max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="ml-2 text-gray-600">Loading files...</span>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-gray-500">
                            <p>No attached files for this claim.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {files.map((file) => (
                                <div
                                    key={file.key}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-xl flex-shrink-0">
                                            {getFileIcon(file.fileName)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">
                                                {file.fileName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {formatFileSize(file.size)} • {
                                                    file.lastModified
                                                        ? new Date(
                                                              file.lastModified,
                                                          ).toLocaleDateString("id-ID")
                                                        : "Unknown date"
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 ml-2 flex-shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handlePreview(file)}
                                            disabled={
                                                downloading[file.key] ||
                                                deleting[file.key]
                                            }
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDownload(file)}
                                            disabled={
                                                downloading[file.key] ||
                                                deleting[file.key]
                                            }
                                        >
                                            {downloading[file.key] ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                        </Button>
                                        {!readOnly && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDelete(file)}
                                                disabled={
                                                    downloading[file.key] ||
                                                    deleting[file.key]
                                                }
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                {deleting[file.key] ? (
                                                    <Loader className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button onClick={loadFiles} disabled={loading} variant="secondary">
                        Refresh
                    </Button>
                </DialogFooter>
            </DialogContent>

            <DocumentPreviewModal
                open={previewOpen}
                onClose={() => {
                    setPreviewOpen(false);
                    setPreviewUrl("");
                    setPreviewFileName("");
                }}
                url={previewUrl}
                fileName={previewFileName}
            />
        </Dialog>
    );
}

export default FilePreviewModal;
