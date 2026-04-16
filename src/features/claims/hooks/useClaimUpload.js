import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { maskKtp, getExcelDate } from "@/shared/utils/dataTransform";
import { backend } from "@/api/backendClient";
import { parseClaimFile } from "../services/claimParser";
import { claimService } from "../services/claimService";
import { uploadFileToPath } from "@/services/storageService";
import {
    validateClaimRow,
    validateFileInternalDuplicates,
    validateExistingDuplicates,
    buildValidationSummary,
} from "../utils/claimValidation";

/**
 * Encapsulates the entire two-step upload workflow:
 *   1. handleFileUpload   → parse + validate file → populate preview
 *   2. handleBulkUpload   → submit validated rows to backend
 *
 * Usage:
 *   const { ... } = useClaimUpload({ batches, debtors, user, isBrinsUser, onSuccess });
 */
export function useClaimUpload({ debtors, user, isBrinsUser, onSuccess }) {
    const [processing, setProcessing] = useState(false);
    const [parsedClaims, setParsedClaims] = useState([]);
    const [validationRemarks, setValidationRemarks] = useState([]);
    const [dialogError, setDialogError] = useState("");
    const [previewValidationError, setPreviewValidationError] = useState("");
    const rawFileRef = useRef(null);

    const reset = () => {
        setParsedClaims([]);
        setValidationRemarks([]);
        setDialogError("");
        setPreviewValidationError("");
        rawFileRef.current = null;
    };

    /**
     * Download claim upload template as XLSX file.
     */
    const handleDownloadTemplate = () => {
        try {
            const headers = [
                "nama_tertanggung",
                "nomor_peserta",
                "no_ktp_npwp",
                "no_fasilitas_kredit",
                "bdo_premi",
                "tanggal_realisasi_kredit",
                "plafond",
                "max_coverage",
                "kol_debitur",
                "dol",
                "nilai_klaim",
                "claim_no",
                "policy_no",
                "nomor_sertifikat",
                "share_tugure_percentage",
                "share_tugure_amount",
                "check_bdo_premi",
            ];

            const sampleData = [
                [
                    "Orang 29",
                    "0000A.00022.2026.05.00029.1.3",
                    "",
                    "17101500875158",
                    "Juni 2023",
                    "27-Jun-23",
                    "200.000.000,00",
                    "150.000.000,00",
                    "Kol 4",
                    "22-Sep-24",
                    "114685298",
                    "811514102500344",
                    "1127361019000029",
                    "2239",
                    "44%",
                    "50.461.531",
                    "TRUE",
                ]
            ];

            // Create worksheet with headers and sample data
            const wsData = [headers, ...sampleData];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set column widths for better readability
            ws["!cols"] = headers.map(() => ({ wch: 18 }));

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Claim");

            // Generate and download
            XLSX.writeFile(wb, "claim_template.xlsx");
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
        setParsedClaims([]);

        try {
            const rows = await parseClaimFile(file);

            // Backend data-type validation before building preview.
            try {
                const rowsForValidation = rows.map((row) => ({
                    ...row,
                    tanggal_realisasi_kredit: getExcelDate(row.tanggal_realisasi_kredit),
                    dol: getExcelDate(row.dol),
                }));
                await backend.validateClaimsPayload(rowsForValidation);
            } catch (validationError) {
                setDialogError(validationError?.message || "Validasi tipe data gagal. Periksa isi file dan coba lagi.");
                setProcessing(false);
                return false;
            }

            const parsed = [];
            const validationErrors = [];

            for (const row of rows) {
                // BRINS users upload recovery data — debtor matching is not
                // required because they reference an existing claim_no instead.
                const { debtor, issues } = isBrinsUser
                    ? { debtor: undefined, issues: [] }
                    : validateClaimRow(row, debtors);

                if (issues.length > 0) {
                    validationErrors.push({
                        row: row.excelRow,
                        participant: row.nomor_peserta || row.claim_no || "Unknown",
                        issues,
                    });
                }
                parsed.push({
                    claim_no: row.claim_no,
                    excelRow: row.excelRow,
                    policy_no: row.policy_no,
                    nomor_sertifikat: row.nomor_sertifikat,
                    nama_tertanggung: row.nama_tertanggung,
                    nomor_peserta: row.nomor_peserta,
                    no_ktp_npwp: maskKtp(row.no_ktp_npwp_raw),
                    no_fasilitas_kredit: row.no_fasilitas_kredit,
                    bdo_premi: row.bdo_premi,
                    tanggal_realisasi_kredit: row.tanggal_realisasi_kredit,
                    plafond: Number(row.plafond) || 0,
                    max_coverage: Number(row.max_coverage) || 0,
                    kol_debitur: row.kol_debitur,
                    dol: row.dol,
                    nilai_klaim: Number(row.nilai_klaim) || 0,
                    tahun_polis: row.tahun_polis,
                    bordero_klaim: row.bordero_klaim,
                    share_tugure_percentage:
                        Number(row.share_tugure_percentage) || 0,
                    share_tugure_amount: Number(row.share_tugure_amount) || 0,
                    check_bdo_premi: !!row.check_bdo_premi,
                    validation_remarks: issues.join("; "),
                    debtor_id: debtor?.id,
                    contract_id: debtor?.contract_id,
                    batch_id: debtor?.batch_id,
                });
            }

            const fileErrors = validateFileInternalDuplicates(parsed);
            validationErrors.push(...fileErrors);
            // For BRINS recovery uploads, skip claim-level duplicate check
            // (Subrogation duplicates are handled at DB level by claim_id uniqueness).
            if (!isBrinsUser) {
                const existingErrors = await validateExistingDuplicates(parsed);
                validationErrors.push(...existingErrors);
            }

            setParsedClaims(parsed);
            setValidationRemarks(validationErrors);

            if (validationErrors.length > 0) {
                setDialogError(
                    `${validationErrors.length} validation issues found`,
                );
                setPreviewValidationError(
                    buildValidationSummary(validationErrors),
                );
            } else {
                setPreviewValidationError("");
            }
            setProcessing(false);
        } catch (err) {
            console.error("Parse error:", err);
            setDialogError("Failed to parse file: " + err.message);
        }
        setProcessing(false);
    };

    /**
     * Step 2: Submit all valid parsed rows to the backend.
     * Call this when the user clicks "Upload N Claims".
     */
    const handleBulkUpload = async () => {
        if (
            !Array.isArray(parsedClaims) ||
            parsedClaims.length === 0
        ) {
            setDialogError(
                isBrinsUser
                    ? "No valid recoveries to upload"
                    : "No valid claims to upload",
            );
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

            // Derive contract_id from parsed claims for nota check
            const contractId = parsedClaims.find((c) => c.contract_id)?.contract_id;

            // Block if there are notas but none are PAID
            if (contractId) {
                const contractNotas = await claimService.checkNotaPayment(
                    contractId,
                );
                if (
                    !contractNotas.some((n) => n.status === "PAID") &&
                    contractNotas.length > 0
                ) {
                    setDialogError(
                        `❌ BLOCKED: ${isBrinsUser ? "Recovery" : "Claim"} submission not allowed. Nota must be PAID first.`,
                    );
                    await claimService
                        .auditBlockedSubmission(
                            contractId,
                            user?.email,
                            user?.role,
                        )
                        .catch(() => {});
                    setProcessing(false);
                    return;
                }
            }

            const now = new Date();
            const prefix = `CLM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
            let maxSeq = await claimService.getNextClaimSequence(prefix);

            // Store raw Excel file in MinIO (non-blocking)
            if (rawFileRef.current) {
                const claimNo = `${prefix}${String(maxSeq + 1).padStart(6, "0")}`;
                uploadFileToPath(rawFileRef.current, {
                    folder: 'claim',
                    subfolder: 'excel',
                    identifier: claimNo,
                }).catch((err) => console.error('[Claim Excel] Failed to store Excel in MinIO:', err));
            }

            let uploaded = 0;
            const errors = [];

            for (const claim of parsedClaims) {
                if (claim.validation_remarks) continue;
                try {
                    maxSeq++;
                    const claimNo = `${prefix}${String(maxSeq).padStart(6, "0")}`;
                    await claimService.uploadClaim(
                        claim,
                        claimNo,
                        user,
                        isBrinsUser,
                    );
                    uploaded++;

                } catch (err) {
                    errors.push(`Row ${uploaded + 1}: ${err.message}`);
                    console.error("Failed to create claim:", err);
                }
            }

            if (uploaded > 0) {
                await claimService
                    .notifyBulkUpload(
                        uploaded,
                        contractId,
                        user?.email,
                        isBrinsUser,
                    )
                    .catch(() => {});
            }

            const message =
                errors.length > 0
                    ? `Uploaded ${uploaded} ${isBrinsUser ? "recoveries" : "claims"}, but ${errors.length} failed`
                    : `✓ Successfully uploaded ${uploaded} ${isBrinsUser ? "recoveries" : "claims"}`;

            if (errors.length > 0) {
                setDialogError(
                    `❌ ${errors.length} upload${errors.length > 1 ? "s" : ""} failed:\n${errors.join("\n")}`
                );
                setProcessing(false);
                return;
            }

            reset();
            onSuccess?.(message);
        } catch (err) {
            console.error("Upload error:", err);
            setDialogError(
                "Failed to upload " +
                    (isBrinsUser ? "recoveries: " : "claims: ") +
                    err.message,
            );
        }
        setProcessing(false);
    };

    return {
        processing,
        parsedClaims,
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
