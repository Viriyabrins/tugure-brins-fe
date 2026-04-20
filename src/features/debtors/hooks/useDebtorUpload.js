import { useState } from "react";
import { toast } from "sonner";
import { backend } from "@/api/backendClient";
import { debtorService } from "../services/debtorService";
import {
    parseDebtorFile,
    validateUploadRows,
    buildDebtorPayload,
    toNullableString,
    normalizeDebtorRowDatesForValidation,
} from "../utils/debtorParser";
import { uploadFileToPath } from "@/services/storageService";

export function useDebtorUpload({ user, auditActor, debtors, loadDebtors, loadInitialData }) {
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadTabActive, setUploadTabActive] = useState(1);
    const [uploadPreviewData, setUploadPreviewData] = useState([]);
    const [uploadPreviewLoading, setUploadPreviewLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [selectedContract, setSelectedContract] = useState("");
    const [batchMode, setBatchMode] = useState("new");
    const [selectedBatch, setSelectedBatch] = useState("");
    const [fileDuplicates, setFileDuplicates] = useState([]);
    const [databaseDuplicates, setDatabaseDuplicates] = useState([]);
    const [fileDuplicateResolutions, setFileDuplicateResolutions] = useState({});
    const [uploadError, setUploadError] = useState("");

    function resetUploadState() {
        setUploadTabActive(1);
        setUploadPreviewData([]);
        setUploadFile(null);
        setSelectedContract("");
        setBatchMode("new");
        setSelectedBatch("");
        setFileDuplicates([]);
        setDatabaseDuplicates([]);
        setFileDuplicateResolutions({});
        setUploadError("");
    }

    async function handlePreviewData() {
        if (!selectedContract) {
            toast.error("Please select a contract");
            return;
        }
        if (batchMode === "revise" && !selectedBatch) {
            toast.error("Please select a batch to revise");
            return;
        }
        if (!uploadFile) {
            toast.error("Please select a file to upload");
            return;
        }

        if (batchMode === "revise") {
            const revisionDebtors = debtors.filter(
                (d) => d.batch_id === selectedBatch && d.contract_id === selectedContract && d.status === "REVISION",
            );
            if (revisionDebtors.length === 0) {
                const msg = `No debtors with status REVISION found in batch ${selectedBatch} for contract ${selectedContract}.`;
                setUploadError(msg);
                toast.error(msg);
                return;
            }
        }

        setUploadPreviewLoading(true);
        setUploadError("");

        try {
            const parsed = await parseDebtorFile(uploadFile);

            if (parsed.parseErrors?.length > 0) {
                const first = parsed.parseErrors[0];
                const msg = `Invalid format${first?.row ? ` on row ${first.row}` : ""}: ${first?.message || "Unable to parse file."}`;
                setUploadError(msg);
                toast.error(msg);
                return;
            }

            let normalizedRows = Array.isArray(parsed.rows) ? parsed.rows : [];
            const validation = validateUploadRows(normalizedRows, parsed.headers);
            normalizedRows = validation.normalizedRows;

            if (validation.validationErrors.length > 0) {
                const detail =
                    `Upload validation failed: ${validation.validationErrors.length} issue(s).\n` +
                    validation.validationErrors.slice(0, 5).join("\n") +
                    (validation.validationErrors.length > 5
                        ? `\n...and ${validation.validationErrors.length - 5} more`
                        : "");
                setUploadError(detail);
                toast.error(validation.validationErrors[0]);
                return;
            }

            if (!normalizedRows.length) {
                const msg = "File is empty or invalid format";
                setUploadError(msg);
                toast.error(msg);
                return;
            }

            // Backend data-type validation before building preview
            try {
                await backend.validateDebtorsPayload(normalizeDebtorRowDatesForValidation(normalizedRows));
            } catch (validationError) {
                const msg = validationError?.message || "Validasi tipe data gagal. Periksa isi file dan coba lagi.";
                setUploadError(msg);
                toast.error("Validation failed: data type errors detected.");
                return;
            }

            // Resolve batch / bordero IDs
            let batchId, borderoId;

            if (batchMode === "new") {
                batchId = toNullableString(normalizedRows[0]?.batch_id);
                if (!batchId) {
                    const msg = "BATCH_ID is required in all rows.";
                    setUploadError(msg);
                    toast.error(msg);
                    return;
                }
                const mismatch = normalizedRows.find((r) => toNullableString(r.batch_id) !== batchId);
                if (mismatch) {
                    const msg = `All rows must share the same BATCH_ID. Found "${toNullableString(mismatch.batch_id)}" but expected "${batchId}".`;
                    setUploadError(msg);
                    toast.error(msg);
                    return;
                }
                borderoId = `BRD-${batchId.replace("BATCH-", "")}`;
            } else {
                batchId = selectedBatch;
                const borderos = await backend.list("Bordero");
                const match = Array.isArray(borderos)
                    ? borderos.find((b) => b.batch_id === batchId && b.contract_id === selectedContract)
                    : null;
                if (!match?.bordero_id) {
                    const msg = `Bordero not found for batch ${batchId} and contract ${selectedContract}. Please generate Bordero first.`;
                    setUploadError(msg);
                    toast.error(msg);
                    return;
                }
                borderoId = match.bordero_id;
            }

            // Build payloads
            const previewPayloads = normalizedRows.map((row, i) => {
                const nomorPeserta = toNullableString(row.nomor_peserta);
                const namaPeserta = toNullableString(row.nama_peserta);
                if (!nomorPeserta || !namaPeserta) {
                    throw new Error(`Row ${i + 2}: nomor_peserta and nama_peserta are required`);
                }
                return buildDebtorPayload(row, borderoId, batchId, selectedContract);
            });

            // Check duplicates
            const dupResult = await debtorService.checkUploadDuplicates(previewPayloads);
            const fileDups = dupResult?.fileDuplicates || [];
            let dbDups = dupResult?.databaseDuplicates || [];

            if (batchMode === "revise") {
                dbDups = dbDups.filter((d) => d.field !== "nomor_peserta" && d.field !== "policy_no");
            }

            if (dbDups.length > 0) {
                const msgs = dbDups.slice(0, 5).map((d) => {
                    const label = d.field === "nomor_peserta" ? "Nomor Peserta" : "Policy No";
                    return `Row ${d.rowIndex + 2}: ${label} "${d.value}" already exists in database`;
                });
                const msg =
                    `Upload rejected: ${dbDups.length} record(s) already exist in database.\n` +
                    msgs.join("\n") +
                    (dbDups.length > 5 ? `\n...and ${dbDups.length - 5} more` : "");
                setUploadError(msg);
                toast.error("Upload contains duplicates from database.");
                return;
            }

            setFileDuplicates([]);
            setDatabaseDuplicates([]);
            setFileDuplicateResolutions({});
            setUploadPreviewData(previewPayloads);
            setUploadTabActive(2);
        } catch (e) {
            const msg = e?.message || "Failed to generate preview";
            setUploadError(msg);
            toast.error(msg);
        } finally {
            setUploadPreviewLoading(false);
        }
    }

    async function handleConfirmSave() {
        if (!uploadPreviewData.length) {
            toast.error("No preview data available.");
            return;
        }

        setUploading(true);
        setUploadError("");

        const batchId = uploadPreviewData[0].batch_id;
        const borderoId = uploadPreviewData[0].bordero_id;
        const contractId = uploadPreviewData[0].contract_id;
        const createdDebtorIds = [];
        let batchCreatedByUs = false;
        let borderoCreatedByUs = false;

        try {
            const totalExposure = uploadPreviewData.reduce((s, r) => s + (r.plafon || 0), 0);
            const totalPremium = uploadPreviewData.reduce((s, r) => s + (r.nominal_premi || 0), 0);

            if (batchMode === "new") {
                await debtorService.createBatch(batchId, contractId, uploadPreviewData.length, totalExposure, totalPremium, uploadFile?.name);
                batchCreatedByUs = true;
                const now = new Date();
                const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                await debtorService.createBordero(borderoId, contractId, batchId, period);
                borderoCreatedByUs = true;
            }

            const result = await debtorService.uploadDebtorsAtomic(batchMode, selectedBatch, uploadPreviewData);
            const createdDebtors = result?.debtors || [];
            createdDebtorIds.push(...createdDebtors.map((d) => d.id));
            const uploaded = createdDebtors.length;

            // Store raw Excel file in MinIO (non-blocking)
            if (uploadFile) {
                uploadFileToPath(uploadFile, {
                    folder: 'batch',
                    subfolder: 'excel',
                    identifier: batchId,
                }).catch((err) => console.error('[Batch Excel] Failed to store Excel in MinIO:', err));
            }

            if (uploaded === 0) {
                setUploadError("No debtors were created. Please check your data.");
                return;
            }

            // Update bordero totals
            const totals = uploadPreviewData.reduce(
                (acc, r) => {
                    acc.total_plafon += parseFloat(r.plafon) || 0;
                    acc.total_nominal_premi += parseFloat(r.nominal_premi) || 0;
                    acc.total_net_premi += parseFloat(r.net_premi) || 0;
                    acc.total_premium_amount += parseFloat(r.premium_amount) || 0;
                    acc.total_ric_amount += parseFloat(r.ric_amount) || 0;
                    acc.total_bf_amount += parseFloat(r.bf_amount) || 0;
                    return acc;
                },
                { total_plafon: 0, total_nominal_premi: 0, total_net_premi: 0, total_premium_amount: 0, total_ric_amount: 0, total_bf_amount: 0 },
            );
            await debtorService.updateBorderoTotals(borderoId, { ...totals, total_debtors: uploaded });

            await debtorService._audit(
                batchMode === "new" ? "BULK_UPLOAD" : "BULK_REVISION",
                "DEBTOR",
                batchId,
                "",
                JSON.stringify({ count: uploaded, upload_mode: batchMode }),
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                `${batchMode === "new" ? "Uploaded" : "Revised"} ${uploaded} debtors to batch ${batchId}`,
            );

            await debtorService.notifyUploadComplete(
                uploaded,
                batchId,
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
            );

            const msg = batchMode === "revise"
                ? `Successfully uploaded ${uploaded} revised debtor(s) to batch ${batchId}.`
                : `Successfully uploaded ${uploaded} debtors to batch ${batchId}`;
            toast.success(msg);

            setUploadDialogOpen(false);
            resetUploadState();
            await loadInitialData();
            await loadDebtors();
        } catch (e) {
            console.error("Upload error:", e);

            // Rollback — only undo records WE created in this attempt
            for (const id of createdDebtorIds.reverse()) {
                await debtorService.deleteDebtor(id);
            }
            if (borderoCreatedByUs) await debtorService.deleteBordero(borderoId);
            if (batchCreatedByUs) await debtorService.deleteBatch(batchId);

            const msg = `Upload failed: ${e.message}`;
            setUploadError(msg);
            toast.error(msg);
        } finally {
            setUploading(false);
        }
    }

    return {
        uploadDialogOpen, setUploadDialogOpen,
        uploadTabActive, setUploadTabActive,
        uploadPreviewData,
        uploadPreviewLoading,
        uploading,
        uploadFile, setUploadFile,
        selectedContract, setSelectedContract,
        batchMode, setBatchMode,
        selectedBatch, setSelectedBatch,
        fileDuplicates, setFileDuplicates,
        databaseDuplicates,
        fileDuplicateResolutions, setFileDuplicateResolutions,
        uploadError, setUploadError,
        handlePreviewData,
        handleConfirmSave,
        resetUploadState,
    };
}
