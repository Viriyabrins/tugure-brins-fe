import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
    extractBaseContractNo, toNullableString, parseUploadFile, buildContractPayload,
    readableError, normalizeStatus, MC_TEMPLATE_CSV,
} from "../utils/masterContractConstants";
import { masterContractService } from "../services/masterContractService";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";

export function useMasterContractActions({ user, auditActor, contracts, statsContracts, reload, page, filters, loadContracts, loadStats }) {
    // Dialog state
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showVersionDialog, setShowVersionDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [showDetailDialog, setShowDetailDialog] = useState(false);

    // Upload state
    const [uploadMode, setUploadMode] = useState("new");
    const [selectedContractForRevision, setSelectedContractForRevision] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreviewData, setUploadPreviewData] = useState([]);
    const [uploadTabActive, setUploadTabActive] = useState(1);
    const [previewValidationError, setPreviewValidationError] = useState("");

    // Action state
    const [selectedContract, setSelectedContract] = useState(null);
    const [selectedContractIds, setSelectedContractIds] = useState([]);
    const [actionType, setActionType] = useState("");
    const [approvalAction, setApprovalAction] = useState("");
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [revisionDiffs, setRevisionDiffs] = useState([]);

    const revisionContracts = Array.isArray(statsContracts)
        ? statsContracts.filter((c) => normalizeStatus(c.contract_status || c.effective_status) === "REVISION")
            .sort((a, b) => new Date(b.input_date || b.updated_at || 0).getTime() - new Date(a.input_date || a.updated_at || 0).getTime())
        : [];

    // Load revision diffs when detail dialog opens
    useEffect(() => {
        let mounted = true;
        if (showDetailDialog && selectedContract) {
            masterContractService.loadRevisionDiffs(selectedContract).then((diffs) => {
                if (mounted) setRevisionDiffs(diffs);
            });
        } else {
            if (mounted) setRevisionDiffs([]);
        }
        return () => { mounted = false; };
    }, [showDetailDialog, selectedContract]);

    // Validate revise mode on preview tab
    useEffect(() => {
        if (uploadMode !== "revise" || uploadTabActive !== 2) return;
        if (!selectedContractForRevision) { setPreviewValidationError("Silakan pilih kontrak yang akan direvisi."); return; }
        const selected = revisionContracts.find((c) => (c.contract_id || c.id) === selectedContractForRevision);
        if (!selected) { setPreviewValidationError("Kontrak yang dipilih tidak ditemukan."); return; }
        const expectedBase = extractBaseContractNo(toNullableString(selected.contract_no) || "") || "";
        if (!expectedBase) { setPreviewValidationError("Kontrak terpilih tidak memiliki Contract No yang valid."); return; }
        const mismatch = (uploadPreviewData || []).find((r) => {
            const rNo = toNullableString(r.contract_no) || "";
            return extractBaseContractNo(rNo).trim().toUpperCase() !== expectedBase.trim().toUpperCase();
        });
        setPreviewValidationError(mismatch ? `Contract No pada file (${extractBaseContractNo(mismatch.contract_no) || "-"}) tidak sesuai dengan kontrak yang dipilih untuk direvisi (${expectedBase}).` : "");
    }, [uploadPreviewData, selectedContractForRevision, uploadMode, uploadTabActive]);

    const openUploadDialog = () => {
        setUploadPreviewData([]); setPreviewValidationError(""); setUploadTabActive(1);
        setUploadFile(null); setUploadMode("new"); setSelectedContractForRevision("");
        setShowUploadDialog(true);
    };

    const closeUploadDialog = () => {
        setShowUploadDialog(false); setUploadMode("new"); setSelectedContractForRevision("");
        setUploadFile(null); setUploadPreviewData([]); setUploadTabActive(1); setPreviewValidationError("");
    };

    const handleDownloadTemplate = () => {
        const blob = new Blob([MC_TEMPLATE_CSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "master_contract_template.csv"; a.click();
    };

    const handlePreviewExcel = async () => {
        if (!uploadFile) return;
        if (uploadMode === "revise" && !selectedContractForRevision) { setErrorMessage("Please select a contract to revise"); return; }
        setProcessing(true); setErrorMessage(""); setPreviewValidationError("");
        try {
            const rows = await parseUploadFile(uploadFile);
            if (!rows || rows.length === 0) { setErrorMessage("File kosong atau format tidak valid."); setProcessing(false); return; }
            setUploadPreviewData(rows.map((row, i) => buildContractPayload(row, i, uploadMode)));
            setUploadTabActive(2);
        } catch (error) {
            setPreviewValidationError(readableError(error));
            setUploadTabActive(2);
        }
        setProcessing(false);
    };

    const handleConfirmSave = async () => {
        setProcessing(true); setErrorMessage(""); setSuccessMessage(""); setPreviewValidationError("");
        try {
            if (uploadMode === "revise") {
                if (!selectedContractForRevision) { setPreviewValidationError("Silakan pilih kontrak yang akan direvisi."); setProcessing(false); return; }
                const selected = revisionContracts.find((c) => (c.contract_id || c.id) === selectedContractForRevision);
                if (!selected) { setPreviewValidationError("Kontrak yang dipilih tidak ditemukan."); setProcessing(false); return; }
                const expectedBase = extractBaseContractNo(toNullableString(selected.contract_no) || "") || "";
                if (!expectedBase) { setPreviewValidationError("Kontrak terpilih tidak memiliki Contract No yang valid."); setProcessing(false); return; }
                const mismatch = (uploadPreviewData || []).find((r) => extractBaseContractNo(toNullableString(r.contract_no) || "").trim().toUpperCase() !== expectedBase.trim().toUpperCase());
                if (mismatch) { setPreviewValidationError(`Contract No pada file tidak sesuai dengan kontrak yang dipilih untuk direvisi.`); setUploadTabActive(2); setProcessing(false); return; }
            }
            const result = await masterContractService.uploadContracts({ uploadMode, selectedContractForRevision: uploadMode === "revise" ? selectedContractForRevision : null, contracts: uploadPreviewData });
            const uploaded = Number(result?.createdCount || 0);
            setSuccessMessage(`Berhasil upload ${uploaded} contract${uploaded > 1 ? "s" : ""}.`);
            sendNotificationEmail({ targetGroup: "brins-checker", objectType: "Contract", statusTo: "SUBMITTED", recipientRole: "BRINS", variables: { user_name: auditActor?.user_email || user?.email || "System", date: new Date().toLocaleDateString("id-ID"), count: String(uploaded) }, fallbackSubject: "Contracts Uploaded", fallbackBody: "<p>{user_name} has uploaded {count} contract(s) on {date}. Awaiting review.</p>" }).catch(console.error);
            closeUploadDialog();
            loadContracts(page, filters); loadStats();
        } catch (error) {
            setPreviewValidationError(readableError(error, "Upload gagal. Periksa data dan coba lagi."));
            setUploadTabActive(2);
        }
        setProcessing(false);
    };

    const handleCheckerBrinsCheck = async (selectedContractIds, clearSelection) => {
        if (!selectedContractIds.length) { toast.error("Please select contracts to check"); return; }
        setProcessing(true); setErrorMessage(""); setSuccessMessage("");
        try {
            const count = await masterContractService.checkBrins(selectedContractIds, contracts, auditActor, user);
            if (count === 0) { toast.warning("No contracts with Draft/SUBMITTED status were found."); clearSelection(); setProcessing(false); return; }
            setSuccessMessage(`${count} contract(s) checked successfully.`);
            toast.success(`${count} contract(s) checked.`);
            clearSelection(); reload();
        } catch (e) { setErrorMessage(`Check failed: ${e.message}`); }
        setProcessing(false);
    };

    const handleApproverBrinsApprove = async (selectedContractIds, clearSelection) => {
        if (!selectedContractIds.length) { toast.error("Please select contracts to approve"); return; }
        setProcessing(true); setErrorMessage(""); setSuccessMessage("");
        try {
            const count = await masterContractService.approveBrins(selectedContractIds, contracts, auditActor, user);
            if (count === 0) { toast.warning("No contracts with CHECKED_BRINS status found."); clearSelection(); setProcessing(false); return; }
            setSuccessMessage(`${count} contract(s) approved by BRINS. Now available for Tugure review.`);
            toast.success(`${count} contract(s) approved by BRINS.`);
            clearSelection(); reload();
        } catch (e) { setErrorMessage(`Approve failed: ${e.message}`); }
        setProcessing(false);
    };

    const handleCheckerTugureCheck = async (selectedContractIds, clearSelection) => {
        if (!selectedContractIds.length) { toast.error("Please select contracts to check"); return; }
        setProcessing(true); setErrorMessage(""); setSuccessMessage("");
        try {
            const count = await masterContractService.checkTugure(selectedContractIds, contracts, auditActor, user);
            if (count === 0) { toast.warning("No contracts with APPROVED_BRINS status found."); clearSelection(); setProcessing(false); return; }
            setSuccessMessage(`${count} contract(s) checked by Tugure. Awaiting final approval.`);
            toast.success(`${count} contract(s) checked by Tugure.`);
            clearSelection(); reload();
        } catch (e) { setErrorMessage(`Check failed: ${e.message}`); }
        setProcessing(false);
    };

    const handleApproverTugureAction = async (selectedContractIds, clearSelection) => {
        if (!selectedContractIds.length) { toast.error("Please select contracts"); return; }
        if (!approvalAction) return;
        setProcessing(true); setErrorMessage(""); setSuccessMessage("");
        try {
            const count = await masterContractService.approveTugure(selectedContractIds, contracts, approvalAction, approvalRemarks, auditActor, user);
            if (count === 0) { toast.warning("No contracts with CHECKED_TUGURE status found."); clearSelection(); setProcessing(false); return; }
            const verb = approvalAction === "APPROVED" ? "approved" : "sent for revision";
            setSuccessMessage(`${count} contract(s) ${verb}.`);
            toast.success(`${count} contract(s) ${verb}.`);
            clearSelection(); setShowApprovalDialog(false); setApprovalAction(""); setApprovalRemarks("");
            reload();
        } catch (e) { setErrorMessage(`Action failed: ${e.message}`); }
        setProcessing(false);
    };

    const handleContractAction = async () => {
        if (!approvalRemarks) return;
        setProcessing(true);
        try {
            await masterContractService.closeOrInvalidate(selectedContract, actionType, approvalRemarks, auditActor, user);
            setSuccessMessage(`Contract ${actionType}d successfully`);
            setShowActionDialog(false); setApprovalRemarks("");
            reload();
        } catch (e) { setErrorMessage(`Failed to process action: ${e.message}`); }
        setProcessing(false);
    };

    return {
        showUploadDialog, setShowUploadDialog, showApprovalDialog, setShowApprovalDialog,
        showVersionDialog, setShowVersionDialog, showActionDialog, setShowActionDialog,
        showDetailDialog, setShowDetailDialog,
        uploadMode, setUploadMode, selectedContractForRevision, setSelectedContractForRevision,
        uploadFile, setUploadFile, uploadPreviewData, uploadTabActive, setUploadTabActive,
        previewValidationError,
        selectedContract, setSelectedContract, selectedContractIds: undefined, // managed in page
        actionType, setActionType, approvalAction, setApprovalAction,
        approvalRemarks, setApprovalRemarks, processing, successMessage, errorMessage,
        revisionDiffs, revisionContracts,
        openUploadDialog, closeUploadDialog, handleDownloadTemplate,
        handlePreviewExcel, handleConfirmSave,
        handleCheckerBrinsCheck, handleApproverBrinsApprove,
        handleCheckerTugureCheck, handleApproverTugureAction, handleContractAction,
    };
}
