import { useState, useEffect } from "react";
import { toast } from "sonner";
import { debtorReviewService } from "../services/debtorReviewService";

export function useDebtorReviewActions({
    user, auditActor, debtors, selectedDebtors, setSelectedDebtors,
    filters, loadData,
}) {
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");

    // Dialog state
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showApprovalSummaryDialog, setShowApprovalSummaryDialog] = useState(false);
    const [showBatchPickerDialog, setShowBatchPickerDialog] = useState(false);
    const [showScopeDialog, setShowScopeDialog] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [showActionConfirmDialog, setShowActionConfirmDialog] = useState(false);
    const [actionConfirmSummary, setActionConfirmSummary] = useState(null);

    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [approvalAction, setApprovalAction] = useState("");
    const [approvalRemarks, setApprovalRemarks] = useState("");
    const [approvalSummaryDebtors, setApprovalSummaryDebtors] = useState([]);

    // Batch/scope dialog state
    const [uniqueBatches, setUniqueBatches] = useState([]);
    const [selectedBatchForAction, setSelectedBatchForAction] = useState(null);
    const [actionScope, setActionScope] = useState("selected");

    // Progress modal state
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);

    // Revision diffs
    const [revisionDiffs, setRevisionDiffs] = useState([]);

    // Cleanup polling on unmount
    useEffect(() => () => { if (pollingInterval) clearInterval(pollingInterval); }, [pollingInterval]);

    // Load revision diffs when detail dialog opens
    useEffect(() => {
        if (!showDetailDialog || !selectedDebtor || (selectedDebtor?.version_no || 0) <= 1) {
            setRevisionDiffs([]);
            return;
        }
        let mounted = true;
        debtorReviewService.loadRevisionDiffs(selectedDebtor.nomor_peserta, selectedDebtor)
            .then((diffs) => { if (mounted) setRevisionDiffs(diffs); })
            .catch(() => { if (mounted) setRevisionDiffs([]); });
        return () => { mounted = false; };
    }, [showDetailDialog, selectedDebtor]);

    // ─── Batch/scope routing ───────────────────────────────────────────────────

    function handleActionButtonClick(action) {
        const batches = [...new Set(
            debtors.filter((d) => selectedDebtors.includes(d.id)).map((d) => d.batch_id).filter(Boolean)
        )];
        if (!batches.length) { toast.error("Please select debtors first"); return; }
        setApprovalAction(action);
        if (batches.length > 1) { setUniqueBatches(batches); setShowBatchPickerDialog(true); }
        else { setSelectedBatchForAction(batches[0]); setActionScope("selected"); setShowScopeDialog(true); }
    }

    function handleBatchSelect(batchId) {
        setSelectedBatchForAction(batchId);
        setShowBatchPickerDialog(false);
        setActionScope("selected");
        setShowScopeDialog(true);
    }

    async function handleScopeConfirm() {
        setShowScopeDialog(false);
        setProcessing(true);
        try {
            let summary;
            if (actionScope === "whole-batch") {
                const contractId = filters.contract !== "all" ? filters.contract : undefined;
                const batchFilters = contractId ? { contract_id: contractId } : {};
                summary = await debtorReviewService.getBatchSummary(selectedBatchForAction, batchFilters);
                if (!summary) { toast.error("Failed to get batch summary"); setProcessing(false); return; }
            } else {
                const eligibleDebtors = debtors.filter((d) => selectedDebtors.includes(d.id));
                summary = eligibleDebtors.reduce(
                    (acc, d) => {
                        acc.totalNetPremi += parseFloat(d.net_premi) || 0;
                        acc.totalKomisi += parseFloat(d.ric_amount) || 0;
                        acc.totalPlafon += parseFloat(d.plafon) || 0;
                        acc.totalNominalPremi += parseFloat(d.nominal_premi) || 0;
                        // grossPremi aggregates the raw PREMIUM / premium_amount field
                        acc.grossPremi += parseFloat(d.premium_amount || d.premium) || 0;
                        acc.count += 1;
                        return acc;
                    },
                    { totalNetPremi: 0, totalKomisi: 0, totalPlafon: 0, totalNominalPremi: 0, grossPremi: 0, count: 0 }
                );
                summary.batchId = selectedBatchForAction || eligibleDebtors[0]?.batch_id || "-";
                summary.contractId = eligibleDebtors[0]?.contract_id || "-";
            }
            setActionConfirmSummary(summary);
            setShowActionConfirmDialog(true);
        } catch (e) {
            console.error("Failed to compute batch summary:", e);
            toast.error("Failed to load batch summary");
        }
        setProcessing(false);
    }

    async function handleActionConfirm() {
        setShowActionConfirmDialog(false);
        setActionConfirmSummary(null);
        if (actionScope === "selected") {
            if (approvalAction === "bulk_check") await handleCheck(true);
            else await executeApproval();
        } else {
            await executeApprovalWholeBatch();
        }
    }

    // ─── Polling ───────────────────────────────────────────────────────────────

    function startPolling(newJobId) {
        setJobId(newJobId);
        let count = 0;
        const interval = setInterval(async () => {
            try {
                const status = await debtorReviewService.getJobStatus(newJobId);
                setJobStatus(status);
                if (status.status === "COMPLETED" || status.status === "FAILED") {
                    clearInterval(interval);
                    setPollingInterval(null);
                    if (status.status === "COMPLETED") toast.success(`Action completed: ${status.processedCount} success, ${status.failedCount} failed`);
                    else toast.error(`Action failed: ${status.message}`);
                    setTimeout(() => { setShowProgressModal(false); loadData(); }, 1500);
                }
            } catch (e) { console.error("Polling error:", e); }
            if (++count > 300) { clearInterval(interval); setPollingInterval(null); toast.error("Job polling timeout"); }
        }, 500);
        setPollingInterval(interval);
    }

    // ─── Check ─────────────────────────────────────────────────────────────────

    async function handleCheck(isBulk = false, debtorArg = null) {
        const targets = isBulk
            ? debtors.filter((d) => selectedDebtors.includes(d.id))
            : debtorArg ? [debtorArg] : selectedDebtor ? [selectedDebtor] : [];
        if (!targets.length) { toast.error("Please select debtors to check"); return; }
        setProcessing(true);
        try {
            const count = await debtorReviewService.checkDebtors(targets, user, auditActor);
            if (!count) { toast.warning("No debtors with APPROVED_BRINS status found."); setProcessing(false); return; }
            setSuccessMessage(`${count} debtor(s) checked successfully.`);
            toast.success(`${count} debtor(s) checked.`);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            setTimeout(() => loadData(), 1000);
        } catch (e) {
            console.error("Check failed:", e);
            toast.error("Check action failed.");
        }
        setProcessing(false);
    }

    // ─── Approve / Revise ──────────────────────────────────────────────────────

    async function handleApproveRevise() {
        const isBulk = approvalAction.startsWith("bulk_");
        const debtorsToProcess = isBulk
            ? debtors.filter((d) => selectedDebtors.includes(d.id))
            : selectedDebtor ? [selectedDebtor] : [];
        if (!debtorsToProcess.length) return;

        if (approvalAction.includes("approve")) {
            setApprovalSummaryDebtors(debtorsToProcess);
            setShowApprovalSummaryDialog(true);
            return;
        }
        await executeApproval();
    }

    async function executeApproval() {
        const isBulk = approvalAction.startsWith("bulk_");
        const action = isBulk ? approvalAction.replace("bulk_", "") : approvalAction;
        const debtorsToProcess = isBulk
            ? debtors.filter((d) => selectedDebtors.includes(d.id))
            : selectedDebtor ? [selectedDebtor] : [];
        if (!debtorsToProcess.length) return;

        setProcessing(true);
        try {
            let count;
            if (action === "approve") {
                count = await debtorReviewService.approveDebtors(debtorsToProcess, approvalRemarks, user, auditActor);
                setSuccessMessage(`${count} debtor(s) approved. Nota generated.`);
            } else {
                count = await debtorReviewService.reviseDebtors(debtorsToProcess, approvalRemarks, user, auditActor);
                setSuccessMessage(`${count} debtor(s) marked for revision.`);
            }
            if (!count) { toast.warning("No debtors with CHECKED_TUGURE status found."); }
            setShowApprovalDialog(false);
            setShowApprovalSummaryDialog(false);
            setSelectedDebtor(null);
            setSelectedDebtors([]);
            setApprovalRemarks("");
            setApprovalSummaryDebtors([]);
            setTimeout(() => loadData(), 1000);
        } catch (e) {
            console.error("Approval error:", e);
            toast.error("Failed to process approval");
        }
        setProcessing(false);
    }

    async function executeApprovalWholeBatch() {
        if (!selectedBatchForAction || !approvalAction) { toast.error("Invalid action or batch"); return; }
        const action = approvalAction.replace("bulk_", "");
        setProcessing(true);
        try {
            const contractId = filters.contract !== "all" ? filters.contract : undefined;
            const response = await debtorReviewService.startBulkAction(action, selectedBatchForAction, filters, approvalRemarks, contractId);
            if (response?.jobId) {
                setShowProgressModal(true);
                setApprovalRemarks("");
                setSelectedDebtor(null);
                setSelectedDebtors([]);
                startPolling(response.jobId);
            } else {
                toast.error("Failed to start bulk action job");
            }
        } catch (e) {
            console.error("Bulk action error:", e);
            toast.error(`Failed to start bulk action: ${e.message}`);
        }
        setProcessing(false);
    }

    return {
        processing, successMessage, setSuccessMessage,
        showDetailDialog, setShowDetailDialog,
        showApprovalDialog, setShowApprovalDialog,
        showApprovalSummaryDialog, setShowApprovalSummaryDialog,
        showBatchPickerDialog, setShowBatchPickerDialog,
        showScopeDialog, setShowScopeDialog,
        showProgressModal, setShowProgressModal,
        showActionConfirmDialog, setShowActionConfirmDialog,
        actionConfirmSummary,
        selectedDebtor, setSelectedDebtor,
        approvalAction, setApprovalAction,
        approvalRemarks, setApprovalRemarks,
        approvalSummaryDebtors, setApprovalSummaryDebtors,
        uniqueBatches, selectedBatchForAction,
        actionScope, setActionScope,
        jobStatus, revisionDiffs,
        handleActionButtonClick, handleBatchSelect, handleScopeConfirm,
        handleCheck, handleApproveRevise, executeApproval, handleActionConfirm,
    };
}
