import { useState } from "react";
import { toast } from "sonner";
import { claimReviewService } from "../services/claimReviewService";

export function useClaimReviewActions({ user, auditActor, claims, selectedClaims, setSelectedClaims, debtors, notas, subrogations, loadData }) {
    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Claim dialog state
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showActionDialog, setShowActionDialog] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [actionType, setActionType] = useState("");
    const [remarks, setRemarks] = useState("");

    // Subrogation dialog state
    const [showSubrogationActionDialog, setShowSubrogationActionDialog] = useState(false);
    const [selectedSubrogation, setSelectedSubrogation] = useState(null);
    const [subrogationActionType, setSubrogationActionType] = useState("");
    const [subrogationRemarks, setSubrogationRemarks] = useState("");
    const [subrogationProcessing, setSubrogationProcessing] = useState(false);

    // ─── Claim actions ─────────────────────────────────────────────────────────

    async function handleClaimAction(overrideAction = null) {
        const currentAction = typeof overrideAction === "string" ? overrideAction : actionType;
        if (!currentAction) return;
        if (!selectedClaim && !currentAction.startsWith("bulk_")) return;

        setProcessing(true);
        setErrorMessage("");

        try {
            const isBulk = currentAction.startsWith("bulk_");
            const baseAction = currentAction.replace("bulk_", "");
            const claimsToProcess = isBulk
                ? claims.filter((c) => selectedClaims.includes(c.id))
                : [selectedClaim];

            let successCount = 0;

            for (const claim of claimsToProcess) {
                if (!claim) continue;
                if (baseAction === "check" && claim.status !== "SUBMITTED") continue;
                if ((baseAction === "approve" || baseAction === "revise") && claim.status !== "CHECKED") continue;

                if (baseAction === "check") {
                    const result = await claimReviewService.checkClaim(claim, debtors, notas, user, auditActor);
                    if (result.blocked) { setErrorMessage(result.message); setProcessing(false); return; }
                } else if (baseAction === "approve") {
                    await claimReviewService.approveClaim(claim, remarks, user, auditActor);
                } else if (baseAction === "revise") {
                    await claimReviewService.reviseClaim(claim, remarks, user, auditActor);
                }
                successCount++;
            }

            setSuccessMessage(
                isBulk
                    ? `Successfully processed ${successCount} claims`
                    : `Claim ${baseAction}ed successfully${baseAction === "approve" ? " - Nota created" : ""}`
            );
            setShowActionDialog(false);
            setSelectedClaim(null);
            if (isBulk) setSelectedClaims([]);
            if (baseAction !== "check") { setRemarks(""); setActionType(""); }
            loadData();
        } catch (e) {
            console.error("Claim action error:", e);
            setErrorMessage("Failed to process claim(s)");
        }
        setProcessing(false);
    }

    // ─── Subrogation actions ───────────────────────────────────────────────────

    async function handleSubrogationAction() {
        if (!selectedSubrogation || !subrogationActionType) return;
        setSubrogationProcessing(true);
        try {
            if (subrogationActionType === "check") {
                await claimReviewService.checkSubrogation(selectedSubrogation, user, auditActor);
            } else if (subrogationActionType === "approve") {
                await claimReviewService.approveSubrogation(selectedSubrogation, claims, subrogationRemarks, user, auditActor);
            } else if (subrogationActionType === "revise") {
                await claimReviewService.reviseSubrogation(selectedSubrogation, subrogationRemarks, user, auditActor);
            }
            setSuccessMessage(
                `Subrogation ${subrogationActionType}d successfully${subrogationActionType === "approve" ? " - Nota Subrogation created" : ""}`
            );
            setShowSubrogationActionDialog(false);
            setSelectedSubrogation(null);
            setSubrogationRemarks("");
            setSubrogationActionType("");
            loadData();
        } catch (e) {
            console.error("Subrogation action error:", e);
        }
        setSubrogationProcessing(false);
    }

    return {
        processing, successMessage, setSuccessMessage, errorMessage, setErrorMessage,
        showViewDialog, setShowViewDialog,
        showActionDialog, setShowActionDialog,
        selectedClaim, setSelectedClaim,
        actionType, setActionType,
        remarks, setRemarks,
        showSubrogationActionDialog, setShowSubrogationActionDialog,
        selectedSubrogation, setSelectedSubrogation,
        subrogationActionType, setSubrogationActionType,
        subrogationRemarks, setSubrogationRemarks,
        subrogationProcessing,
        handleClaimAction, handleSubrogationAction,
    };
}
