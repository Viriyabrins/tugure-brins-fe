import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { backend } from "@/api/backendClient";
import { parseSubrogationFile } from "../services/subrogationParser";
import { uploadFileToPath } from "@/services/storageService";
import {
    SUBROGATION_TEMPLATE_HEADERS,
    SUBROGATION_TEMPLATE_SAMPLE,
} from "../utils/subrogationConstants";

/**
 * Encapsulates the entire two-step upload workflow for subrogations:
 *   1. handleFileUpload   → parse + validate file → populate preview
 *   2. handleBulkUpload   → submit validated rows to backend
 *
 * Usage:
 *   const { ... } = useSubrogationUpload({ user, onSuccess });
 */
export function useSubrogationUpload({ user, onSuccess }) {
    const [processing, setProcessing] = useState(false);
    const [parsedSubrogations, setParsedSubrogations] = useState([]);
    const [validationRemarks, setValidationRemarks] = useState([]);
    const [dialogError, setDialogError] = useState("");
    const [previewValidationError, setPreviewValidationError] = useState("");
    const rawFileRef = useRef(null);

    const reset = () => {
        setParsedSubrogations([]);
        setValidationRemarks([]);
        setDialogError("");
        setPreviewValidationError("");
        rawFileRef.current = null;
    };

    /**
     * Download subrogation upload template as XLSX file.
     */
    const handleDownloadTemplate = () => {
        try {
            // Create worksheet with headers and sample data
            const wsData = [SUBROGATION_TEMPLATE_HEADERS, ...SUBROGATION_TEMPLATE_SAMPLE];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set column widths for better readability
            ws["!cols"] = SUBROGATION_TEMPLATE_HEADERS.map(() => ({ wch: 22 }));

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Subrogation");

            // Generate and download
            XLSX.writeFile(wb, "subrogation_template.xlsx");
        } catch (error) {
            setDialogError("Failed to generate template: " + error.message);
        }
    };

    /**
     * Step 1: Parse the file, run validation, and populate preview state.
     * Call this when the user clicks "Preview Data →".
     */
    const handleFileUpload = async (file) => {
        if (!file) return;
        rawFileRef.current = file;
        setProcessing(true);
        setDialogError("");
        setValidationRemarks([]);
        setParsedSubrogations([]);

        try {
            const rows = await parseSubrogationFile(file);

            // Backend validation
            try {
                await backend.validateSubrogationPayload({ rows });
            } catch (validationError) {
                setDialogError(validationError?.message || "Validation failed. Please check the file data and try again.");
                setProcessing(false);
                return false;
            }

            // Set parsed data (no additional frontend validation needed since backend handles domain validation)
            setParsedSubrogations(rows);
            setValidationRemarks([]);
            setPreviewValidationError("");

            setProcessing(false);
        } catch (err) {
            console.error("Parse error:", err);
            setDialogError("Failed to parse file: " + err.message);
        }
        setProcessing(false);
    };

    /**
     * Step 2: Submit all valid parsed rows to the backend.
     * Call this when the user clicks "Upload N Subrogations".
     */
    const handleBulkUpload = async () => {
        if (
            !Array.isArray(parsedSubrogations) ||
            parsedSubrogations.length === 0
        ) {
            setDialogError("No valid subrogations to upload");
            return;
        }

        setProcessing(true);
        try {
            // Block if there are validation errors from preview step
            if (validationRemarks && validationRemarks.length > 0) {
                setDialogError(
                    `❌ BLOCKED: Cannot submit. ${validationRemarks.length} row(s) have validation issues. Please fix the data and re-upload.`,
                );
                setProcessing(false);
                return;
            }

            // Store raw Excel file in MinIO (non-blocking)
            if (rawFileRef.current) {
                const firstSubrogation = parsedSubrogations[0];
                const fileIdentifier = firstSubrogation?.claim_no || "unknown";
                uploadFileToPath(rawFileRef.current, {
                    folder: 'subrogation',
                    subfolder: 'excel',
                    identifier: fileIdentifier,
                }).catch((err) => console.error('[Subrogation Excel] Failed to store Excel in MinIO:', err));
            }

            // Upload subrogations
            const result = await backend.uploadSubrogationsAtomic({
                subrogations: parsedSubrogations,
                source_filename: rawFileRef.current?.name || null,
            });

            const message = `✓ Successfully uploaded ${result.createdCount} subrogations`;

            reset();
            onSuccess?.(message);
        } catch (err) {
            console.error("Upload error:", err);
            setDialogError("Failed to upload subrogations: " + err.message);
        }
        setProcessing(false);
    };

    return {
        processing,
        parsedSubrogations,
        validationRemarks,
        dialogError,
        previewValidationError,
        handleFileUpload,
        handleBulkUpload,
        reset,
        setDialogError,
        handleDownloadTemplate,
    };
}