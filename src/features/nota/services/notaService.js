import { backend } from "@/api/backendClient";

export const notaService = {
    // ─── Read ─────────────────────────────────────────────────────────────────

    async listNotasPaginated(pageToLoad, pageSize, filters) {
        const query = { page: pageToLoad, limit: pageSize };
        if (filters) query.q = JSON.stringify(filters);
        return backend.listPaginated("Nota", query);
    },

    async listAll() {
        const ctx = await backend.getNotaContext();
        return {
            batches: Array.isArray(ctx?.batches) ? ctx.batches : [],
            contracts: Array.isArray(ctx?.contracts) ? ctx.contracts : [],
            payments: Array.isArray(ctx?.payments) ? ctx.payments : [],
            paymentIntents: Array.isArray(ctx?.paymentIntents) ? ctx.paymentIntents : [],
            dnCnRecords: Array.isArray(ctx?.dnCnRecords) ? ctx.dnCnRecords : [],
            debtors: Array.isArray(ctx?.debtors) ? ctx.debtors : [],
            subrogations: Array.isArray(ctx?.subrogations) ? ctx.subrogations : [],
        };
    },

    // ─── Nota actions ──────────────────────────────────────────────────────────

    async markNotaPaid(notaNumber, userEmail) {
        return backend.update("Nota", notaNumber, {
            status: "PAID",
            marked_paid_by: userEmail,
            marked_paid_date: new Date().toISOString(),
        });
    },

    async changeNotaStatus(notaNumber, status, userEmail) {
        return backend.update("Nota", notaNumber, {
            status,
            marked_paid_by: userEmail,
            marked_paid_date: new Date().toISOString(),
        });
    },

    async closeNota(notaNumber) {
        return backend.update("Nota", notaNumber, {
            status: "PAID",
            paid_date: new Date().toISOString(),
            payment_reference: "Marked PAID via Exception or MATCHED payment",
        });
    },

    async getMasterContract(contractId) {
        return backend.get("MasterContract", contractId);
    },

    // ─── Reconciliation ────────────────────────────────────────────────────────

    async recordPayment({ notaNumber, contractId, paidAmount, paymentDate, bankReference, matchStatus, exceptionType, reconStatus, newTotalPaid, userEmail }) {
        const result = await backend.recordNotaPayment(notaNumber, { contractId, paidAmount, paymentDate, bankReference, matchStatus, exceptionType, reconStatus, newTotalPaid, userEmail });
        return result?.payment_ref;
    },

    async markReconFinal(notaNumber) {
        return backend.update("Nota", notaNumber, { reconciliation_status: "FINAL" });
    },

    // ─── Debit/Credit Note ─────────────────────────────────────────────────────

    async createDnCn({ notaNumber, referenceId, contractId, noteType, adjustmentAmount, reasonCode, reasonDescription, createdBy }) {
        const noteNumber = `${noteType === "Debit Note" ? "DN" : "CN"}-${notaNumber}-${Date.now()}`;
        await backend.create("DebitCreditNote", {
            note_number: noteNumber,
            note_type: noteType,
            original_nota_id: notaNumber,
            batch_id: referenceId,
            contract_id: contractId,
            adjustment_amount: noteType === "Debit Note" ? Math.abs(adjustmentAmount) : -Math.abs(adjustmentAmount),
            reason_code: reasonCode,
            reason_description: reasonDescription,
            status: "UNPAID",
            created_by: createdBy,
            created_date: new Date().toISOString(),
            currency: "IDR",
        });
        return noteNumber;
    },

    async updateDnCn(noteNumber, updates) {
        return backend.update("DebitCreditNote", noteNumber, updates);
    },

    // ─── Audit & Notifications ─────────────────────────────────────────────────

    async _audit(action, module, entityType, entityId, oldVal, newVal, userEmail, userRole, reason) {
        return backend.create("AuditLog", {
            action, module, entity_type: entityType, entity_id: entityId,
            old_value: typeof oldVal === "string" ? oldVal : JSON.stringify(oldVal),
            new_value: typeof newVal === "string" ? newVal : JSON.stringify(newVal),
            user_email: userEmail, user_role: userRole, reason,
        }).catch((e) => console.warn("[notaService] audit error:", e));
    },

    async _notify(title, message, type, module, referenceId, targetRole) {
        return backend.create("Notification", {
            title, message, type, module, reference_id: referenceId, target_role: targetRole,
        }).catch((e) => console.warn("[notaService] notify error:", e));
    },
};
