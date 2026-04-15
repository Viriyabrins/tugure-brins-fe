import { backend } from "@/api/backendClient";

async function _audit(action, module, entityType, entityId, oldVal, newVal, userEmail, userRole, reason) {
    try {
        await backend.create("AuditLog", {
            action, module, entity_type: entityType, entity_id: entityId,
            old_value: JSON.stringify(oldVal),
            new_value: JSON.stringify(newVal),
            user_email: userEmail, user_role: userRole, reason,
        });
    } catch (e) { console.warn("Audit failed:", e); }
}

async function _notify(title, message, type, module, referenceId, targetRole) {
    try {
        await backend.create("Notification", { title, message, type, module, reference_id: referenceId, target_role: targetRole });
    } catch (e) { console.warn("Notification failed:", e); }
}

export const claimReviewService = {
    async listClaimsPaginated(filters, page, pageSize) {
        const result = await backend.listPaginated("Claim", {
            page, limit: pageSize, q: JSON.stringify(filters),
        });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async listAll() {
        const ctx = await backend.getClaimReviewContext();
        return {
            subrogations: Array.isArray(ctx?.subrogations) ? ctx.subrogations : [],
            notas: Array.isArray(ctx?.notas) ? ctx.notas : [],
            contracts: Array.isArray(ctx?.contracts) ? ctx.contracts : [],
            debtors: Array.isArray(ctx?.debtors) ? ctx.debtors : [],
            batches: Array.isArray(ctx?.batches) ? ctx.batches : [],
        };
    },

    /** Returns null on success, error string if blocked */
    async checkClaim(claim, debtors, notas, user, auditActor) {
        const relatedDebtor = debtors.find((d) => d.id === claim.debtor_id);
        if (relatedDebtor) {
            const batchNotas = notas.filter((n) => n.reference_id === relatedDebtor.batch_id && n.nota_type === "Batch");
            if (!batchNotas.some((n) => n.status === "Paid")) {
                const blockMsg = `❌ BLOCKED: Claim review not allowed.\n\nClaim Review may proceed ONLY IF nota_payment_status = PAID.\n\nCurrent Nota status: ${batchNotas[0]?.status || "No Nota found"}`;
                await _audit("BLOCKED_CLAIM_REVIEW", "CLAIM", "Claim", claim.claim_no || claim.id, {}, { blocked_reason: "Nota payment not completed" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, "Attempted claim review before Nota payment");
                return { blocked: true, message: blockMsg };
            }
        }
        const claimId = claim.claim_no || claim.id;
        await backend.processClaimWorkflowAction(claimId, {
            action: "CHECK_BRINS",
            actorEmail: auditActor?.user_email || user?.email,
            actorRole: auditActor?.user_role || user?.role,
        });
        await _notify(`Claim CHECKED`, `Claim ${claim.claim_no} moved to CHECKED`, "INFO", "CLAIM", claimId, "tugure-approver-role");
        return { blocked: false };
    },

    async approveClaim(claim, remarks, user, auditActor) {
        const claimId = claim.claim_no || claim.id;
        await backend.processClaimWorkflowAction(claimId, {
            action: "APPROVE",
            remarks,
            actorEmail: auditActor?.user_email || user?.email,
            actorRole: auditActor?.user_role || user?.role,
        });
        const notaNumber = `NOTA-${claim.claim_no}-${Date.now()}`;
        await _notify(`Claim APPROVED`, `Nota ${notaNumber} created for Claim ${claim.claim_no}. Remarks: ${remarks}`, "ACTION_REQUIRED", "CLAIM", claimId, "maker-brins-role");
        return notaNumber;
    },

    async reviseClaim(claim, remarks, user, auditActor) {
        const claimId = claim.claim_no || claim.id;
        await backend.processClaimWorkflowAction(claimId, {
            action: "REVISION",
            remarks,
            actorEmail: auditActor?.user_email || user?.email,
            actorRole: auditActor?.user_role || user?.role,
        });
        await _notify(`Claim REVISION`, `Claim ${claim.claim_no} moved to REVISION`, "WARNING", "CLAIM", claimId, "maker-brins-role");
    },

    async checkSubrogation(subrogation, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        await backend.processSubrogationWorkflowAction(subId, { action: "check" });
    },

    async approveSubrogation(subrogation, claims, remarks, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        const associatedClaim = claims.find((c) => c.claim_no === subrogation.claim_id);
        const contractId = associatedClaim?.contract_id || "";
        const recoveryAmount = parseFloat(subrogation.recovery_amount || 0);
        const result = await backend.processSubrogationWorkflowAction(subId, { action: "approve", contractId, recoveryAmount, remarks });
        return result?.notaNumber;
    },

    async reviseSubrogation(subrogation, remarks, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        await backend.processSubrogationWorkflowAction(subId, { action: "revise", remarks });
    },
};
