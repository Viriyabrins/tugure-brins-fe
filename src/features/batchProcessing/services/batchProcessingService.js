import { backend } from "@/api/backendClient";
import { computeBatchReviewSync, getNextStatus, getStatusField } from "../utils/batchProcessingConstants";

export const batchProcessingService = {
    async loadData() {
        const [batchData, contractData, debtorData] = await Promise.all([
            backend.list("Batch"),
            backend.list("Contract"),
            backend.list("Debtor"),
        ]);
        const batches = Array.isArray(batchData) ? batchData : [];
        const contracts = Array.isArray(contractData) ? contractData : [];
        const debtors = Array.isArray(debtorData) ? debtorData : [];

        const syncEntries = computeBatchReviewSync(batches, debtors);
        const updatedBatches = syncEntries.map((e) => e.batch);

        const updatePromises = syncEntries
            .filter((e) => e.needsUpdate && e.batch.batch_id)
            .map((e) => backend.update("Batch", e.batch.batch_id, e.updatePayload).catch(() => {}));
        if (updatePromises.length > 0) await Promise.allSettled(updatePromises);

        return { batches: updatedBatches, contracts, debtors };
    },

    async advanceBatch(batch, userEmail, userRole, remarks) {
        const nextStatus = getNextStatus(batch.status);
        if (!nextStatus) return { blocked: true, reason: "No next status" };

        if (nextStatus === "Approved") {
            await backend.create("AuditLog", { action: "BLOCKED_MANUAL_BATCH_APPROVAL", module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ blocked_action: "Manual Approve" }), user_email: userEmail, user_role: userRole, reason: "Attempted manual batch approval - use Debtor Review instead" });
            return { blocked: true, reason: "APPROVAL_BLOCKED" };
        }

        if (nextStatus === "Nota Issued" && (!batch.debtor_review_completed || !batch.batch_ready_for_nota)) {
            await backend.create("AuditLog", { action: "BLOCKED_NOTA_GENERATION", module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ blocked_action: "Generate Nota" }), user_email: userEmail, user_role: userRole, reason: "Attempted to generate Nota before Debtor Review completion" });
            return { blocked: true, reason: "NOTA_BLOCKED" };
        }

        const { by, date } = getStatusField(nextStatus);
        await backend.update("Batch", batch.batch_id, { status: nextStatus, [by]: userEmail, [date]: new Date().toISOString() });

        if (nextStatus === "Nota Issued") {
            const notaNumber = `NOTA-${batch.batch_id}-${Date.now()}`;
            await backend.create("Nota", { nota_number: notaNumber, nota_type: "Batch", reference_id: batch.batch_id, contract_id: batch.contract_id, amount: batch.final_premium_amount || 0, currency: "IDR", status: "Draft", is_immutable: false, total_actual_paid: 0, reconciliation_status: "PENDING" });
            const invoiceNumber = `INV-${batch.batch_id}-${Date.now()}`;
            await backend.create("Invoice", { invoice_number: invoiceNumber, contract_id: batch.contract_id, period: `${batch.batch_year}-${String(batch.batch_month).padStart(2, "0")}`, total_amount: batch.final_premium_amount || 0, paid_amount: 0, outstanding_amount: batch.final_premium_amount || 0, currency: "IDR", status: "ISSUED" });
            await backend.create("AuditLog", { action: "NOTA_GENERATED_FROM_FINAL", module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({}), new_value: JSON.stringify({ nota_number: notaNumber, amount: batch.final_premium_amount, source: "Debtor Review Final Amounts" }), user_email: userEmail, user_role: userRole, reason: `Nota generated with final premium: Rp ${(batch.final_premium_amount || 0).toLocaleString()}` });
        }

        const targetRole = nextStatus === "Nota Issued" ? "BRINS" : nextStatus === "Branch Confirmed" ? "TUGURE" : "ALL";
        const exposureAmount = batch.final_exposure_amount || batch.total_exposure || 0;
        const premiumAmount = batch.final_premium_amount || batch.total_premium || 0;
        await backend.create("Notification", { title: `Batch ${nextStatus}`, message: `Batch ${batch.batch_id} moved to ${nextStatus}. Total Exposure: Rp ${exposureAmount.toLocaleString("id-ID")}, Total Premium: Rp ${premiumAmount.toLocaleString("id-ID")}`, type: "INFO", module: "DEBTOR", reference_id: batch.batch_id, target_role: targetRole });
        await backend.create("AuditLog", { action: `BATCH_${nextStatus.toUpperCase().replace(" ", "_")}`, module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ status: nextStatus }), user_email: userEmail, user_role: userRole, reason: remarks });

        return { blocked: false, nextStatus };
    },

    async closeBatch(batch, allDebtors, userEmail, userRole) {
        const batchDebtors = allDebtors.filter((d) => d.batch_id === batch.batch_id);
        const batchClaims = await backend.list("Claim", { debtor_id: { $in: batchDebtors.map((d) => d.id) } });

        const unreviewed = batchDebtors.filter((d) => d.status !== "APPROVED" && d.status !== "REVISION");
        const pendingClaims = (batchClaims || []).filter((c) => c.status !== "Paid" && c.status !== "Draft");

        if (unreviewed.length > 0 || pendingClaims.length > 0) {
            return { blocked: true, unreviewed: unreviewed.length, pendingClaims: pendingClaims.length };
        }

        await backend.update("Batch", batch.batch_id, { status: "Closed", operational_locked: true, closed_by: userEmail, closed_date: new Date().toISOString() });
        for (const debtor of batchDebtors) await backend.update("Debtor", debtor.id, { is_locked: true });
        await backend.create("AuditLog", { action: "BATCH_CLOSED", module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ status: "Closed", operational_locked: true }), user_email: userEmail, user_role: userRole, reason: "Batch closed successfully" });

        return { blocked: false };
    },

    async rejectBatch(batch, userEmail, userRole, remarks) {
        await backend.update("Batch", batch.batch_id, { status: "Revision", rejection_reason: remarks });
        await backend.create("Notification", { title: "Batch Sent for Revision", message: `Batch ${batch.batch_id} sent for revision: ${remarks}`, type: "WARNING", module: "DEBTOR", reference_id: batch.batch_id, target_role: "BRINS" });
        await backend.create("AuditLog", { action: "BATCH_REVISION", module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ status: "Revision", reason: remarks }), user_email: userEmail, user_role: userRole, reason: remarks });
    },

    async bulkAdvance(batchList, userEmail, userRole) {
        for (const batch of batchList) {
            const next = getNextStatus(batch.status);
            if (!next) continue;
            const { by, date } = getStatusField(next);
            await backend.update("Batch", batch.batch_id, { status: next, [by]: userEmail, [date]: new Date().toISOString() });
            await backend.create("AuditLog", { action: `BATCH_BULK_${next.toUpperCase().replace(" ", "_")}`, module: "DEBTOR", entity_type: "Batch", entity_id: batch.batch_id, old_value: JSON.stringify({ status: batch.status }), new_value: JSON.stringify({ status: next }), user_email: userEmail, user_role: userRole, reason: "Bulk operation" });
        }
    },
};
