import { useState } from "react";
import { maskKtp } from "@/shared/utils/dataTransform";
import { parseClaimFile } from "../services/claimParser";
import { claimService } from "../services/claimService";
import {
    validateClaimRow,
    validateFileInternalDuplicates,
    validateBatchDuplicates,
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
export function useClaimUpload({ batches, debtors, user, isBrinsUser, onSuccess }) {
    const [processing, setProcessing] = useState(false);
    const [parsedClaims, setParsedClaims] = useState([]);
    const [validationRemarks, setValidationRemarks] = useState([]);
    const [dialogError, setDialogError] = useState("");
    const [previewValidationError, setPreviewValidationError] = useState("");

    const reset = () => {
        setParsedClaims([]);
        setValidationRemarks([]);
        setDialogError("");
        setPreviewValidationError("");
    };

    /**
     * Step 1: Parse the file, run validation, and populate preview state.
     * Call this when the user clicks "Preview Data →".
     * Returns true if parse succeeded (rows loaded), false on error.
     */
    const handleFileUpload = async (file, selectedBatch) => {
        if (!file || !selectedBatch) return false;
        setProcessing(true);
        setDialogError("");
        setValidationRemarks([]);
        setParsedClaims([]);

        try {
            const batch = batches.find(
                (b) => b.batch_id === selectedBatch || b.id === selectedBatch,
            );
            if (!batch) {
                setDialogError("Batch not found");
                setProcessing(false);
                return false;
            }

            const batchDebtors = debtors.filter(
                (d) => d.batch_id === batch.batch_id,
            );
            const rows = await parseClaimFile(file);

            const parsed = [];
            const validationErrors = [];

            for (const row of rows) {
                // BRINS users upload recovery data — debtor matching is not
                // required because they reference an existing claim_no instead.
                const { debtor, issues } = isBrinsUser
                    ? { debtor: undefined, issues: [] }
                    : validateClaimRow(row, batchDebtors);

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
                const batchErrors = await validateBatchDuplicates(
                    parsed,
                    batch.batch_id,
                );
                validationErrors.push(...batchErrors);
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
            return true;
        } catch (err) {
            console.error("Parse error:", err);
            setDialogError("Failed to parse file: " + err.message);
        }
        setProcessing(false);
        return false;
    };

    /**
     * Step 2: Submit all valid parsed rows to the backend.
     * Call this when the user clicks "Upload N Claims".
     */
    const handleBulkUpload = async (selectedBatch) => {
        if (
            !Array.isArray(parsedClaims) ||
            parsedClaims.length === 0 ||
            !selectedBatch
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
            const batch = batches.find((b) => b.batch_id === selectedBatch);
            if (!batch) {
                setDialogError("Batch not found");
                setProcessing(false);
                return;
            }

            // Block if there are notas but none are PAID
            const batchNotas = await claimService.checkNotaPayment(
                batch.batch_id,
            );
            if (
                !batchNotas.some((n) => n.status === "PAID") &&
                batchNotas.length > 0
            ) {
                setDialogError(
                    `❌ BLOCKED: ${isBrinsUser ? "Recovery" : "Claim"} submission not allowed. Nota must be PAID first.`,
                );
                await claimService
                    .auditBlockedSubmission(
                        batch.batch_id,
                        user?.email,
                        user?.role,
                    )
                    .catch(() => {});
                setProcessing(false);
                return;
            }

            const now = new Date();
            const prefix = `CLM-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
            let maxSeq = await claimService.getNextClaimSequence(prefix);

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
                        batch,
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
                        batch.batch_id,
                        user?.email,
                        isBrinsUser,
                    )
                    .catch(() => {});
            }

            const message =
                errors.length > 0
                    ? `Uploaded ${uploaded} ${isBrinsUser ? "recoveries" : "claims"}, but ${errors.length} failed`
                    : `✓ Successfully uploaded ${uploaded} ${isBrinsUser ? "recoveries" : "claims"}`;

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
    };
}
