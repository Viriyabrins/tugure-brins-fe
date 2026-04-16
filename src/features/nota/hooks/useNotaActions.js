import { useState } from "react";
import { notaService } from "../services/notaService";
import { getNextStatus, BRINS_ACTION_ROLES } from "../utils/notaConstants";

export function useNotaActions({ user, auditActor, notas, dnCnRecords, loadData, loadNotas, notaPage, filters }) {
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [remarks, setRemarks] = useState("");

    // Dialog state
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [showDnCnDialog, setShowDnCnDialog] = useState(false);
    const [showDnCnActionDialog, setShowDnCnActionDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [showNotaStatusDialog, setShowNotaStatusDialog] = useState(false);

    const [selectedNota, setSelectedNota] = useState(null);
    const [selectedDnCn, setSelectedDnCn] = useState(null);
    const [selectedRecon, setSelectedRecon] = useState(null);
    const [selectedNotaForStatus, setSelectedNotaForStatus] = useState(null);
    const [actionType, setActionType] = useState("");
    const [newNotaStatus, setNewNotaStatus] = useState("PAID");

    const [paymentFormData, setPaymentFormData] = useState({
        actual_paid_amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        bank_reference: "",
    });
    const [dnCnFormData, setDnCnFormData] = useState({
        note_type: "Debit Note",
        adjustment_amount: 0,
        reason_code: "Payment Difference",
        reason_description: "",
    });

    // ─── Mark Nota Paid (via action dialog) ───────────────────────────────────

    async function handleNotaAction() {
        if (!selectedNota || !actionType) return;
        setProcessing(true);
        try {
            const nextStatus = getNextStatus(selectedNota.status);
            if (!nextStatus) return;
            await notaService.markNotaPaid(
                selectedNota.nota_number || selectedNota.id,
                user?.email,
            );
            await notaService._notify(
                "Nota marked as PAID",
                `Nota ${selectedNota.nota_number} (${selectedNota.nota_type}) has been marked as PAID.`,
                "INFO", "DEBTOR", selectedNota.nota_number, "ALL",
            );
            await notaService._audit(
                "NOTA_MARKED_PAID", "DEBTOR", "Nota",
                selectedNota.nota_number,
                JSON.stringify({ status: selectedNota.status }),
                JSON.stringify({ status: nextStatus }),
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                remarks,
            );
            setSuccessMessage("Nota marked as PAID successfully");
            setShowActionDialog(false);
            setSelectedNota(null);
            setRemarks("");
            loadData();
        } catch (e) {
            console.error("Action error:", e);
        }
        setProcessing(false);
    }

    // ─── Direct status change (confirm payment) ───────────────────────────────

    async function handleChangeNotaStatus() {
        if (!selectedNotaForStatus) return;
        setProcessing(true);
        try {
            await notaService.changeNotaStatus(
                selectedNotaForStatus.nota_number,
                newNotaStatus,
                auditActor?.user_email || user?.email,
            );
            await loadNotas(notaPage, filters);
            setShowNotaStatusDialog(false);
            setSelectedNotaForStatus(null);
            setNewNotaStatus("PAID");
            setSuccessMessage(`Nota status updated to ${newNotaStatus}`);
        } catch (e) {
            console.error("Failed to update nota status:", e);
        }
        setProcessing(false);
    }

    // ─── Record payment ────────────────────────────────────────────────────────

    function _parseNumberSafe(value) {
        if (value === null || value === undefined || value === "") return 0;
        if (typeof value === "number") return isNaN(value) || !isFinite(value) ? 0 : value;
        const cleaned = value.toString().trim().replace(/,/g, "").replace(/[^\d.-]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) || !isFinite(num) ? 0 : num;
    }

    async function handleRecordPayment() {
        if (!selectedRecon || !paymentFormData.actual_paid_amount) return;
        setProcessing(true);
        try {
            const paidAmount = _parseNumberSafe(paymentFormData.actual_paid_amount);
            if (isNaN(paidAmount)) { alert("Please enter a valid number."); return; }
            if (paidAmount === 0) { alert("Payment amount cannot be zero."); return; }

            const notaAmount = _parseNumberSafe(selectedRecon.amount) || 0;
            const previousPaid = _parseNumberSafe(selectedRecon.total_actual_paid) || 0;
            const newTotalPaid = previousPaid + paidAmount;
            const difference = notaAmount - newTotalPaid;

            let matchStatus, exceptionType, reconStatus;
            if (Math.abs(difference) <= 1000) {
                matchStatus = "MATCHED"; exceptionType = "NONE"; reconStatus = "MATCHED";
            } else if (difference > 0) {
                matchStatus = "PARTIALLY_MATCHED"; exceptionType = "UNDER"; reconStatus = "PARTIAL";
            } else {
                matchStatus = "PARTIALLY_MATCHED"; exceptionType = "OVER"; reconStatus = "OVERPAID";
            }

            const paymentRef = await notaService.recordPayment({
                notaNumber: selectedRecon.nota_number,
                contractId: selectedRecon.contract_id,
                paidAmount,
                paymentDate: paymentFormData.payment_date,
                bankReference: paymentFormData.bank_reference,
                matchStatus, exceptionType, reconStatus, newTotalPaid,
                userEmail: user?.email,
            });

            if (reconStatus === "MATCHED") {
                await notaService._notify(
                    "Payment MATCHED - Nota Marked PAID",
                    `Nota ${selectedRecon.nota_number} fully paid. Amount: Rp ${newTotalPaid.toLocaleString("id-ID")}. Status marked as PAID.`,
                    "INFO", "DEBTOR", selectedRecon.nota_number, "ALL",
                );
            } else {
                await notaService._notify(
                    `Payment ${reconStatus}${exceptionType !== "NONE" ? " - Exception Detected" : ""}`,
                    `Nota ${selectedRecon.nota_number}: Rp ${paidAmount.toLocaleString("id-ID")} recorded. Total: Rp ${newTotalPaid.toLocaleString("id-ID")}.`,
                    exceptionType !== "NONE" ? "WARNING" : "INFO",
                    "DEBTOR", selectedRecon.nota_number, "ALL",
                );
            }

            await notaService._audit(
                "PAYMENT_RECORDED", "PAYMENT", "Payment", paymentRef,
                "{}", JSON.stringify({ nota_id: selectedRecon.nota_number, amount: paidAmount, match_status: matchStatus, exception_type: exceptionType }),
                auditActor?.user_email || user?.email, auditActor?.user_role || user?.role,
                paymentFormData.bank_reference || "",
            );

            setSuccessMessage(`Payment recorded: ${reconStatus}.${exceptionType !== "NONE" ? ` Exception may be required.` : ""}`);
            setShowPaymentDialog(false);
            setSelectedRecon(null);
            setPaymentFormData({ actual_paid_amount: "", payment_date: new Date().toISOString().split("T")[0], bank_reference: "" });
            loadData();
        } catch (e) {
            console.error("Payment error:", e);
        }
        setProcessing(false);
    }

    // ─── Mark recon FINAL ──────────────────────────────────────────────────────

    async function handleMarkReconFinal(nota) {
        if (nota.reconciliation_status === "PARTIAL") {
            const diff = (nota.amount || 0) - (nota.total_actual_paid || 0);
            if (Math.abs(diff) > 1000) {
                alert(`❌ Cannot mark as FINAL while payment is PARTIAL.\n\nDifference: Rp ${Math.abs(diff).toLocaleString()}`);
                await notaService._audit(
                    "BLOCKED_RECON_FINAL", "RECONCILIATION", "Nota",
                    nota.nota_number, "{}", JSON.stringify({ blocked_reason: "PARTIAL payment" }),
                    auditActor?.user_email || user?.email, auditActor?.user_role || user?.role,
                    "Attempted to finalize reconciliation with outstanding difference",
                );
                return;
            }
        }
        setProcessing(true);
        try {
            await notaService.markReconFinal(nota.nota_number);
            await notaService._notify(
                "Reconciliation Marked FINAL",
                `Nota ${nota.nota_number} reconciliation finalized.`,
                "INFO", "RECONCILIATION", nota.nota_number, "ALL",
            );
            setSuccessMessage("Reconciliation marked as FINAL");
            loadData();
        } catch (e) {
            console.error("Mark final error:", e);
        }
        setProcessing(false);
    }

    // ─── Create Debit/Credit Note ──────────────────────────────────────────────

    async function handleCreateDnCn() {
        if (!selectedNota) return;
        if (selectedNota.reconciliation_status !== "FINAL") {
            alert("❌ BLOCKED: Exception can only be created after reconciliation is marked FINAL.");
            await notaService._audit(
                "BLOCKED_DNCN_CREATION", "RECONCILIATION", "Nota",
                selectedNota.nota_number, "{}", JSON.stringify({ blocked_reason: "reconciliation_status not FINAL" }),
                auditActor?.user_email || user?.email, auditActor?.user_role || user?.role,
                "Attempted Exception creation before reconciliation finalized",
            );
            setShowDnCnDialog(false);
            return;
        }
        const diff = (selectedNota.amount || 0) - (selectedNota.total_actual_paid || 0);
        if (Math.abs(diff) <= 1000) {
            alert("❌ BLOCKED: Exception not needed. Payment is MATCHED.");
            setShowDnCnDialog(false);
            return;
        }
        setProcessing(true);
        try {
            const noteNumber = await notaService.createDnCn({
                notaNumber: selectedNota.nota_number,
                referenceId: selectedNota.reference_id,
                contractId: selectedNota.contract_id,
                noteType: dnCnFormData.note_type,
                adjustmentAmount: dnCnFormData.adjustment_amount,
                reasonCode: dnCnFormData.reason_code,
                reasonDescription: dnCnFormData.reason_description,
                createdBy: user?.email,
            });
            await notaService._audit(
                "DNCN_CREATED", "RECONCILIATION", "DebitCreditNote",
                noteNumber, "{}", JSON.stringify({ original_nota: selectedNota.nota_number, adjustment: dnCnFormData.adjustment_amount }),
                auditActor?.user_email || user?.email, auditActor?.user_role || user?.role,
                dnCnFormData.reason_description,
            );
            setSuccessMessage(`${dnCnFormData.note_type} created successfully`);
            setShowDnCnDialog(false);
            setSelectedNota(null);
            setDnCnFormData({ note_type: "Debit Note", adjustment_amount: 0, reason_code: "Payment Difference", reason_description: "" });
            loadData();
        } catch (e) {
            console.error("DnCn creation error:", e);
        }
        setProcessing(false);
    }

    // ─── DnCn action ──────────────────────────────────────────────────────────

    async function handleDnCnAction(dnCn, action) {
        setProcessing(true);
        try {
            const statusMap = { review: "Under Review", approve: "Approved", revision: "Revision", acknowledge: "Acknowledged" };
            const updates = { status: statusMap[action] };
            if (action === "review") { updates.reviewed_by = user?.email; updates.reviewed_date = new Date().toISOString(); }
            else if (action === "approve") {
                updates.approved_by = user?.email; updates.approved_date = new Date().toISOString();
                const originalNota = notas.find((n) => n.nota_number === dnCn.original_nota_id);
                if (originalNota) await notaService.markReconFinal(originalNota.nota_number);
            } else if (action === "acknowledge") {
                updates.acknowledged_by = user?.email; updates.acknowledged_date = new Date().toISOString();
            } else if (action === "revision") {
                updates.revision_reason = remarks;
            }
            await notaService.updateDnCn(dnCn.note_number, updates);
            await notaService._notify(
                `Exception ${statusMap[action]}`,
                `${dnCn.note_type} ${dnCn.note_number} is now ${statusMap[action]}`,
                "ACTION_REQUIRED", "RECONCILIATION", dnCn.note_number, BRINS_ACTION_ROLES[0],
            );
            await notaService._audit(
                `DNCN_${action.toUpperCase()}`, "RECONCILIATION", "DebitCreditNote",
                dnCn.note_number, JSON.stringify({ status: dnCn.status }), JSON.stringify({ status: statusMap[action] }),
                auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, remarks,
            );
            setSuccessMessage(`Exception ${action}ed successfully`);
            setShowDnCnActionDialog(false);
            setSelectedDnCn(null);
            setRemarks("");
            loadData();
        } catch (e) {
            console.error("DnCn action error:", e);
        }
        setProcessing(false);
    }

    const [showBulkPaidDialog, setShowBulkPaidDialog] = useState(false);

    // ─── Bulk Mark Notas Paid ──────────────────────────────────────────────────

    async function handleBulkMarkPaid(selectedNotaNumbers, setSelectedNotas) {
        if (!selectedNotaNumbers || selectedNotaNumbers.length === 0) return;
        setProcessing(true);
        try {
            await notaService.bulkMarkNotasPaid(selectedNotaNumbers, auditActor?.user_email || user?.email);
            await notaService._notify(
                "Notas marked as PAID",
                `${selectedNotaNumbers.length} nota(s) have been marked as PAID.`,
                "INFO", "DEBTOR", selectedNotaNumbers[0], "ALL",
            );
            await notaService._audit(
                "BULK_NOTA_MARKED_PAID", "DEBTOR", "Nota",
                selectedNotaNumbers.join(","),
                JSON.stringify({ status: "UNPAID" }),
                JSON.stringify({ status: "PAID", count: selectedNotaNumbers.length }),
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                `Bulk mark paid: ${selectedNotaNumbers.length} notas`,
            );
            setSuccessMessage(`${selectedNotaNumbers.length} nota(s) marked as PAID`);
            setShowBulkPaidDialog(false);
            setSelectedNotas([]);
            await loadNotas(notaPage, filters);
        } catch (e) {
            console.error("Bulk mark paid error:", e);
        }
        setProcessing(false);
    }

    // ─── Close Nota ────────────────────────────────────────────────────────────

    async function handleCloseNota(nota) {
        const hasApprovedDnCn = dnCnRecords.some(
            (d) => d.original_nota_id === nota.nota_number && d.status === "Approved",
        );
        if (nota.reconciliation_status !== "MATCHED" && !hasApprovedDnCn) {
            alert(`❌ BLOCKED: Cannot close Nota.\n\nNota can only be closed if MATCHED or Exception Approved.\nCurrent: ${nota.reconciliation_status}\nDiff: Rp ${Math.abs((nota.amount || 0) - (nota.total_actual_paid || 0)).toLocaleString()}`);
            await notaService._audit(
                "BLOCKED_NOTA_CLOSE", "RECONCILIATION", "Nota",
                nota.nota_number, "{}", JSON.stringify({ blocked_reason: "Payment not matched and no approved Exception" }),
                auditActor?.user_email || user?.email, auditActor?.user_role || user?.role,
                "Attempted to close Nota without payment match or Exception approval",
            );
            return;
        }
        setProcessing(true);
        try {
            await notaService.closeNota(nota.nota_number);
            setSuccessMessage("Nota marked as PAID successfully");
            loadData();
        } catch (e) {
            console.error("Close nota error:", e);
        }
        setProcessing(false);
    }

    return {
        processing, successMessage, setSuccessMessage,
        remarks, setRemarks,
        showViewDialog, setShowViewDialog,
        showActionDialog, setShowActionDialog,
        showDnCnDialog, setShowDnCnDialog,
        showDnCnActionDialog, setShowDnCnActionDialog,
        showPaymentDialog, setShowPaymentDialog,
        showNotaStatusDialog, setShowNotaStatusDialog,
        showBulkPaidDialog, setShowBulkPaidDialog,
        selectedNota, setSelectedNota,
        selectedDnCn, setSelectedDnCn,
        selectedRecon, setSelectedRecon,
        selectedNotaForStatus, setSelectedNotaForStatus,
        actionType, setActionType,
        newNotaStatus, setNewNotaStatus,
        paymentFormData, setPaymentFormData,
        dnCnFormData, setDnCnFormData,
        handleNotaAction,
        handleChangeNotaStatus,
        handleBulkMarkPaid,
        handleRecordPayment,
        handleMarkReconFinal,
        handleCreateDnCn,
        handleDnCnAction,
        handleCloseNota,
        parseNumberSafe: _parseNumberSafe,
    };
}
