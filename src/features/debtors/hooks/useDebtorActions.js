import { useState } from "react";
import { toast } from "sonner";
import { debtorService } from "../services/debtorService";

export function useDebtorActions({ user, auditActor, debtors, selectedDebtors, setSelectedDebtors, selectedContract, loadDebtors, loadInitialData }) {
    const [uploading, setUploading] = useState(false);
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [revisionNote, setRevisionNote] = useState("");

    // Whole-batch dialog state
    const [showBatchPickerDialog, setShowBatchPickerDialog] = useState(false);
    const [uniqueBatches, setUniqueBatches] = useState([]);
    const [selectedBatchForAction, setSelectedBatchForAction] = useState(null);
    const [showScopeDialog, setShowScopeDialog] = useState(false);
    const [actionScope, setActionScope] = useState("selected");
    const [pendingAction, setPendingAction] = useState(null);

    // Progress modal state
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);

    // Action confirm dialog state
    const [showActionConfirmDialog, setShowActionConfirmDialog] = useState(false);
    const [actionConfirmSummary, setActionConfirmSummary] = useState(null);

    function _getUniqueBatches(ids) {
        return Array.from(
            new Set(
                ids
                    .map((id) => debtors.find((d) => d.id === id))
                    .filter(Boolean)
                    .map((d) => d.batch_id)
                    .filter(Boolean),
            ),
        );
    }

    // ─── Entry point for checker/approver action ──────────────────────────────

    function handleActionButtonClick(action) {
        if (!selectedDebtors.length) {
            toast.error("Please select debtors to perform this action");
            return;
        }
        const batchIds = _getUniqueBatches(selectedDebtors);
        if (!batchIds.length) {
            toast.error("Selected debtors do not belong to any batch");
            return;
        }
        setPendingAction(action);
        if (batchIds.length === 1) {
            setSelectedBatchForAction(batchIds[0]);
            setShowScopeDialog(true);
        } else {
            setUniqueBatches(batchIds);
            setShowBatchPickerDialog(true);
        }
    }

    function handleBatchSelect(batchId) {
        setSelectedBatchForAction(batchId);
        setShowBatchPickerDialog(false);
        setShowScopeDialog(true);
    }

    async function handleScopeConfirm() {
        setShowScopeDialog(false);

        let summary;
        if (actionScope === "whole-batch") {
            // Fetch ALL debtors in the batch from the API (not limited by pagination)
            summary = await debtorService.getBatchSummary(selectedBatchForAction, selectedContract || null);
            if (!summary) { toast.error("Failed to get batch summary"); return; }
        } else {
            const eligibleDebtors = selectedDebtors
                .map((id) => debtors.find((d) => d.id === id))
                .filter(Boolean);
            summary = eligibleDebtors.reduce(
                (acc, d) => {
                    acc.totalNetPremi += parseFloat(d.net_premi) || 0;
                    acc.totalKomisi += parseFloat(d.ric_amount) || 0;
                    acc.totalPlafon += parseFloat(d.plafon) || 0;
                    acc.totalNominalPremi += parseFloat(d.nominal_premi) || 0;
                    // grossPremi aggregates raw PREMIUM / premium_amount
                    acc.grossPremi += parseFloat(d.premium_amount || d.premium) || 0;
                    acc.count += 1;
                    return acc;
                },
                { totalNetPremi: 0, totalKomisi: 0, totalPlafon: 0, totalNominalPremi: 0, grossPremi: 0, count: 0 },
            );
            summary.batchId = selectedBatchForAction || eligibleDebtors[0]?.batch_id || "-";
            summary.contractId = selectedContract || eligibleDebtors[0]?.contract_id || "-";
        }

        setActionConfirmSummary(summary);
        setShowActionConfirmDialog(true);
    }

    async function handleActionConfirm() {
        setShowActionConfirmDialog(false);
        if (actionScope === "selected") {
            if (pendingAction === "check") return handleCheckerBrinsCheck();
            if (pendingAction === "approve") return handleApproverBrinsApprove();
            return;
        }
        // Whole-batch background job
        try {
            setShowProgressModal(true);
            setJobStatus(null);
            setJobId(null);
            const res = await debtorService.startBulkAction(
                pendingAction === "check" ? "check" : "approve",
                selectedBatchForAction,
                selectedContract,
                auditActor?.user_email || user?.email,
            );
            const newJobId = res?.jobId || res?.id || null;
            if (!newJobId) throw new Error("Failed to start background job");
            setJobId(newJobId);
            startPolling(newJobId);
        } catch (e) {
            console.error("Failed to start whole-batch job", e);
            toast.error("Failed to start job: " + (e?.message || ""));
            setShowProgressModal(false);
        }
    }

    function startPolling(jid) {
        if (pollingInterval) clearInterval(pollingInterval);
        let count = 0;
        const intervalId = setInterval(async () => {
            try {
                const status = await debtorService.getJobStatus(jid);
                setJobStatus(status);
                const norm = (status?.status || "").toUpperCase();
                if (norm === "COMPLETED" || norm === "FAILED") {
                    clearInterval(intervalId);
                    setPollingInterval(null);
                    if (norm === "COMPLETED") {
                        toast.success(`Batch action completed: ${status?.processedCount || 0} success, ${status?.failedCount || 0} failed`);
                    } else {
                        toast.error(`Batch action failed: ${status?.message || "See logs"}`);
                    }
                    setTimeout(() => {
                        setShowProgressModal(false);
                        setJobId(null);
                        setPendingAction(null);
                        setSelectedBatchForAction(null);
                        setSelectedDebtors([]);
                        loadInitialData();
                        loadDebtors(1);
                    }, 1500);
                }
            } catch (e) {
                console.warn("Polling error", e);
            }
            count++;
            if (count > 300) {
                clearInterval(intervalId);
                setPollingInterval(null);
                toast.error("Job polling timeout");
            }
        }, 500);
        setPollingInterval(intervalId);
    }

    // ─── Checker BRINS: SUBMITTED → CHECKED_BRINS ────────────────────────────

    async function handleCheckerBrinsCheck() {
        if (!selectedDebtors.length) {
            toast.error("Please select debtors to check");
            return;
        }
        setUploading(true);
        let processedCount = 0;
        try {
            for (const id of selectedDebtors) {
                const d = debtors.find((x) => x.id === id);
                if (!d || d.status !== "SUBMITTED") continue;
                await debtorService.updateStatus(d.id, "CHECKED_BRINS");
                processedCount++;
                await debtorService._audit(
                    "DEBTOR_CHECKED_BRINS", "DEBTOR", d.id,
                    JSON.stringify({ status: "SUBMITTED" }),
                    JSON.stringify({ status: "CHECKED_BRINS" }),
                    auditActor?.user_email || user?.email,
                    auditActor?.user_role || user?.role,
                    `Checker BRINS checked debtor ${d.nama_peserta}`,
                );
            }
            if (!processedCount) {
                toast.warning("No debtors with SUBMITTED status in your selection.");
                setSelectedDebtors([]);
                return;
            }
            const batchId = debtors.find((d) => selectedDebtors.includes(d.id))?.batch_id || "";
            await debtorService.notifyChecked(processedCount, batchId, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role);
            toast.success(`${processedCount} debtor(s) checked.`);
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (e) {
            console.error("Check failed:", e);
            toast.error(`Check failed: ${e.message}`);
        } finally {
            setUploading(false);
        }
    }

    // ─── Approver BRINS: CHECKED_BRINS → APPROVED_BRINS ──────────────────────

    async function handleApproverBrinsApprove() {
        if (!selectedDebtors.length) {
            toast.error("Please select debtors to approve");
            return;
        }
        setUploading(true);
        let processedCount = 0;
        try {
            for (const id of selectedDebtors) {
                const d = debtors.find((x) => x.id === id);
                if (!d || d.status !== "CHECKED_BRINS") continue;
                await debtorService.updateStatus(d.id, "APPROVED_BRINS");
                processedCount++;
                await debtorService._audit(
                    "DEBTOR_APPROVED_BRINS", "DEBTOR", d.id,
                    JSON.stringify({ status: "CHECKED_BRINS" }),
                    JSON.stringify({ status: "APPROVED_BRINS" }),
                    auditActor?.user_email || user?.email,
                    auditActor?.user_role || user?.role,
                    `Approver BRINS approved debtor ${d.nama_peserta}`,
                );
            }
            if (!processedCount) {
                toast.warning("No debtors with CHECKED_BRINS status in your selection.");
                setSelectedDebtors([]);
                return;
            }
            const batchId = debtors.find((d) => selectedDebtors.includes(d.id))?.batch_id || "";
            await debtorService.notifyApproved(processedCount, batchId, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role);
            toast.success(`${processedCount} debtor(s) approved by BRINS.`);
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (e) {
            console.error("Approve failed:", e);
            toast.error(`Approve failed: ${e.message}`);
        } finally {
            setUploading(false);
        }
    }

    // ─── Request Revision → CONDITIONAL ──────────────────────────────────────

    async function handleRequestRevision() {
        if (!selectedDebtors.length) {
            toast.error("Please select debtors to revise");
            return;
        }
        if (!revisionNote.trim()) {
            toast.error("Please provide a revision note");
            return;
        }
        setUploading(true);
        try {
            for (const id of selectedDebtors) {
                const d = debtors.find((x) => x.id === id);
                if (!d) continue;
                await debtorService.requestRevision(d.id, revisionNote);
                await debtorService._audit(
                    "REQUEST_REVISION", "DEBTOR", d.id,
                    JSON.stringify({ status: d.status }),
                    JSON.stringify({ status: "CONDITIONAL" }),
                    auditActor?.user_email || user?.email,
                    auditActor?.user_role || user?.role,
                    revisionNote,
                );
            }

            await debtorService._notify(
                "Revision Requested",
                `Revision requested for ${selectedDebtors.length} debtors: ${revisionNote}`,
                "DEBTOR", undefined, "ALL",
            );

            toast.success(`Revision requested for ${selectedDebtors.length} debtor(s)`);
            setRevisionDialogOpen(false);
            setRevisionNote("");
            setSelectedDebtors([]);
            await loadDebtors();
        } catch (e) {
            console.error("Failed to request revision:", e);
            toast.error(`Failed to request revision: ${e.message}`);
        } finally {
            setUploading(false);
        }
    }

    return {
        uploading,
        revisionDialogOpen, setRevisionDialogOpen,
        revisionNote, setRevisionNote,
        showBatchPickerDialog, setShowBatchPickerDialog,
        uniqueBatches,
        selectedBatchForAction,
        showScopeDialog, setShowScopeDialog,
        actionScope, setActionScope,
        pendingAction,
        showProgressModal, setShowProgressModal,
        jobId, jobStatus,
        showActionConfirmDialog, setShowActionConfirmDialog,
        actionConfirmSummary,
        handleActionButtonClick,
        handleBatchSelect,
        handleScopeConfirm,
        handleActionConfirm,
        handleCheckerBrinsCheck,
        handleApproverBrinsApprove,
        handleRequestRevision,
    };
}
