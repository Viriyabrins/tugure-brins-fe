import { backend } from "@/api/backendClient";

export const notaService = {
    // ─── Read ─────────────────────────────────────────────────────────────────

    async listNotasPaginated(pageToLoad, pageSize, filters) {
        const query = { page: pageToLoad, limit: pageSize };
        if (filters) query.q = JSON.stringify(filters);
        return backend.listPaginated("Nota", query);
    },

    async listAll() {
        const [
            batchData,
            contractData,
            paymentData,
            paymentIntentData,
            dnCnData,
            debtorData,
            subrogationData,
        ] = await Promise.all([
            backend.list("Batch"),
            backend.list("Contract"),
            backend.list("Payment"),
            backend.list("PaymentIntent"),
            backend.list("DebitCreditNote"),
            backend.list("Debtor"),
            backend.list("Subrogation"),
        ]);
        return {
            batches: Array.isArray(batchData) ? batchData : [],
            contracts: Array.isArray(contractData) ? contractData : [],
            payments: Array.isArray(paymentData) ? paymentData : [],
            paymentIntents: Array.isArray(paymentIntentData) ? paymentIntentData : [],
            dnCnRecords: Array.isArray(dnCnData) ? dnCnData : [],
            debtors: Array.isArray(debtorData) ? debtorData : [],
            subrogations: Array.isArray(subrogationData) ? subrogationData : [],
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
        const paymentRef = bankReference || `PAY-${notaNumber}-${Date.now()}`;
        const paymentDateISO = new Date(paymentDate).toISOString();

        await backend.create("Payment", {
            payment_ref: paymentRef,
            invoice_id: notaNumber,
            contract_id: contractId,
            amount: paidAmount,
            payment_date: paymentDateISO,
            bank_reference: bankReference,
            currency: "IDR",
            match_status: matchStatus,
            exception_type: exceptionType,
            matched_by: userEmail,
            matched_date: new Date().toISOString(),
            is_actual_payment: true,
        });

        await backend.update("Nota", notaNumber, {
            total_actual_paid: newTotalPaid,
            reconciliation_status: reconStatus,
        });

        if (reconStatus === "MATCHED") {
            await backend.update("Nota", notaNumber, {
                status: "PAID",
                paid_date: paymentDateISO,
                payment_reference: paymentRef,
            });
        }

        return paymentRef;
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
