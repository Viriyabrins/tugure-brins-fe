import { backend } from "@/api/backendClient";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";

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
        const [subrogationData, notaData, contractData, debtorData, batchData] = await Promise.all([
            backend.list("Subrogation"),
            backend.list("Nota"),
            backend.list("Contract"),
            backend.list("Debtor"),
            backend.list("Batch"),
        ]);
        return {
            subrogations: Array.isArray(subrogationData) ? subrogationData : [],
            notas: Array.isArray(notaData) ? notaData : [],
            contracts: Array.isArray(contractData) ? contractData : [],
            debtors: Array.isArray(debtorData) ? debtorData : [],
            batches: Array.isArray(batchData) ? batchData : [],
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
        await backend.update("Claim", claimId, {
            status: "CHECKED",
            checked_by: user?.email,
            checked_date: new Date().toISOString(),
            reviewed_by: user?.email,
            review_date: new Date().toISOString(),
        });
        sendNotificationEmail({ targetGroup: "tugure-approver", objectType: "Record", statusTo: "CHECKED", recipientRole: "TUGURE", variables: { claim_no: claim.claim_no, action_by: user?.email }, fallbackSubject: `Claim ${claim.claim_no} Checked`, fallbackBody: `Claim ${claim.claim_no} checked by ${user?.email}.` }).catch(console.warn);
        await _audit("CLAIM_CHECK", "CLAIM", "Claim", claimId, { status: claim.status }, { status: "CHECKED" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, "");
        await _notify(`Claim CHECKED`, `Claim ${claim.claim_no} moved to CHECKED`, "INFO", "CLAIM", claimId, "tugure-approver-role");
        return { blocked: false };
    },

    async approveClaim(claim, remarks, user, auditActor) {
        const claimId = claim.claim_no || claim.id;
        const claimAmount = claim.nilai_klaim || 0;
        const notaNumber = `NOTA-${claim.claim_no}-${Date.now()}`;
        await backend.create("Nota", {
            nota_number: notaNumber, 
            nota_type: "Claim", 
            reference_id: claim.claim_no,
            contract_id: claim.contract_id, 
            amount: claimAmount,
            currency: "IDR", 
            status: "UNPAID", 
            issued_by: auditActor?.user_email || user?.email,
            issued_date: new Date().toISOString(), 
            is_immutable: false, 
            total_actual_paid: 0, 
            reconciliation_status: "PENDING",
            premium: 0,
            commission: 0,
            claim: claimAmount,
            total: claimAmount,
            net_due: claimAmount,
        });
        await backend.update("Claim", claimId, {
            status: "APPROVED", approved_by: user?.email, approved_date: new Date().toISOString(),
            reviewed_by: user?.email, review_date: new Date().toISOString(),
        });
        sendNotificationEmail({ targetGroup: "brins-maker", objectType: "Record", statusTo: "APPROVED", recipientRole: "BRINS", variables: { claim_no: claim.claim_no, action_by: user?.email }, fallbackSubject: `Claim ${claim.claim_no} Approved`, fallbackBody: `Claim ${claim.claim_no} approved. Nota ${notaNumber} generated.` }).catch(console.warn);
        await _notify(`Claim APPROVED`, `Nota ${notaNumber} created for Claim ${claim.claim_no}. Remarks: ${remarks}`, "ACTION_REQUIRED", "CLAIM", claimId, "maker-brins-role");
        await _audit("CLAIM_APPROVE", "CLAIM", "Claim", claimId, { status: claim.status }, { status: "APPROVED" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, remarks);
        return notaNumber;
    },

    async reviseClaim(claim, remarks, user, auditActor) {
        const claimId = claim.claim_no || claim.id;
        await backend.update("Claim", claimId, { status: "REVISION", revision_reason: remarks });
        sendNotificationEmail({ targetGroup: "brins-maker", objectType: "Record", statusTo: "REVISION", recipientRole: "BRINS", variables: { claim_no: claim.claim_no, action_by: user?.email, remark: remarks || "Please review and revise." }, fallbackSubject: `Claim ${claim.claim_no} Needs Revision`, fallbackBody: `Claim ${claim.claim_no} needs revision. Remarks: ${remarks}` }).catch(console.warn);
        await _audit("CLAIM_REVISE", "CLAIM", "Claim", claimId, { status: claim.status }, { status: "REVISION" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, remarks);
        await _notify(`Claim REVISION`, `Claim ${claim.claim_no} moved to REVISION`, "WARNING", "CLAIM", claimId, "maker-brins-role");
    },

    async checkSubrogation(subrogation, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        await backend.update("Subrogation", subId, { status: "CHECKED", checked_by: user?.email, checked_date: new Date().toISOString(), reviewed_by: user?.email, review_date: new Date().toISOString() });
        await _audit("SUBROGATION_CHECK", "SUBROGATION", "Subrogation", subId, { status: subrogation.status }, { status: "CHECKED" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, "");
    },

    async approveSubrogation(subrogation, claims, remarks, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        const associatedClaim = claims.find((c) => c.claim_no === subrogation.claim_id);
        const contractId = associatedClaim?.contract_id || "";
        const recoveryAmount = parseFloat(subrogation.recovery_amount || 0);
        const notaNumber = `NOTA-SBR-${subId}-${Date.now()}`;
        await backend.create("Nota", {
            nota_number: notaNumber, nota_type: "Subrogation", reference_id: subId,
            contract_id: contractId, amount: recoveryAmount,
            currency: "IDR", status: "UNPAID", issued_by: auditActor?.user_email || user?.email,
            issued_date: new Date().toISOString(), is_immutable: false, total_actual_paid: 0, reconciliation_status: "PENDING",
            premium: 0,
            commission: 0,
            claim: recoveryAmount,
            total: recoveryAmount,
            net_due: recoveryAmount,
        });
        await backend.update("Subrogation", subId, {
            status: "APPROVED", approved_by: user?.email, approved_date: new Date().toISOString(),
            invoiced_by: user?.email, invoiced_date: new Date().toISOString(),
            ...(remarks ? { remarks } : {}),
        });
        await _notify("Subrogation Nota Generated", `Nota ${notaNumber} created for Subrogation ${subId}. Remarks: ${remarks || "-"}`, "ACTION_REQUIRED", "SUBROGATION", subId, "maker-brins-role");
        await _audit("SUBROGATION_APPROVE", "SUBROGATION", "Subrogation", subId, { status: subrogation.status }, { status: "APPROVED" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, remarks);
    },

    async reviseSubrogation(subrogation, remarks, user, auditActor) {
        const subId = subrogation.subrogation_id || subrogation.id;
        await backend.update("Subrogation", subId, { status: "REVISION", remarks });
        await _audit("SUBROGATION_REVISE", "SUBROGATION", "Subrogation", subId, { status: subrogation.status }, { status: "REVISION" }, auditActor?.user_email || user?.email, auditActor?.user_role || user?.role, remarks);
    },
};
