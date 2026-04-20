import { backend } from "@/api/backendClient";

export const debtorService = {
    // ─── Read ─────────────────────────────────────────────────────────────────

    async listPaginated(filters, page, pageSize, sortColumn, sortOrder) {
        const query = { page, limit: pageSize };
        if (filters) query.q = JSON.stringify(filters);
        if (sortColumn && sortOrder) {
            query.sortBy = sortColumn;
            query.sortOrder = sortOrder;
        }
        const useReviseLog =
            filters?.submitStatus === "REVISION" || filters?.status === "REVISION";
        const entityName = useReviseLog ? "ReviseLog" : "Debtor";
        return backend.listPaginated(entityName, query);
    },

    async listContracts() {
        return backend.list("MasterContract");
    },

    async listBatches() {
        return backend.list("Batch");
    },

    async listBorderos() {
        return backend.list("Bordero");
    },

    async getBatchSummary(batchId, contractId = null) {
        try {
            // Fetch full debtor rows for the batch and compute aggregates including grossPremi
            const filters = { batch_id: batchId };
            if (contractId) filters.contract_id = contractId;
            const rows = await backend.list('Debtor', { q: JSON.stringify(filters) });
            if (!Array.isArray(rows)) return null;
            const summary = rows.reduce(
                (acc, d) => {
                    acc.totalNetPremi += parseFloat(d.net_premi) || 0;
                    acc.totalKomisi += parseFloat(d.ric_amount) || 0;
                    acc.totalPlafon += parseFloat(d.plafon) || 0;
                    acc.totalNominalPremi += parseFloat(d.nominal_premi) || 0;
                    acc.grossPremi += parseFloat(d.premium_amount || d.premium) || 0;
                    acc.count += 1;
                    return acc;
                },
                { totalNetPremi: 0, totalKomisi: 0, totalPlafon: 0, totalNominalPremi: 0, grossPremi: 0, count: 0 }
            );
            summary.batchId = batchId;
            summary.contractId = rows[0]?.contract_id || contractId || '-';
            return summary;
        } catch (e) {
            console.warn('getBatchSummary failed:', e);
            return null;
        }
    },

    async getRevisionHistory(nomorPeserta) {
        return backend.listPaginated("DebtorRevise", {
            page: 1,
            limit: 100,
            q: JSON.stringify({ nomor_peserta: nomorPeserta }),
        });
    },

    // ─── Check duplicates ─────────────────────────────────────────────────────

    async checkUploadDuplicates(debtors) {
        return backend.checkUploadDuplicates({ debtors });
    },

    // ─── Upload ───────────────────────────────────────────────────────────────

    async createBatch(batchId, contractId, rowCount, totalExposure, totalPremium, sourceFilename) {
        return backend.create("Batch", {
            batch_id: batchId,
            batch_month: new Date().getMonth() + 1,
            batch_year: new Date().getFullYear(),
            contract_id: contractId,
            total_records: rowCount,
            total_exposure: totalExposure,
            total_premium: totalPremium,
            status: "Uploaded",
            source_filename: sourceFilename || null,
        });
    },

    async createBordero(borderoId, contractId, batchId, period) {
        return backend.create("Bordero", {
            bordero_id: borderoId,
            contract_id: contractId,
            batch_id: batchId,
            period: period,
            total_debtors: 0,
            currency: "IDR",
        });
    },

    async updateBorderoTotals(borderoId, totals) {
        return backend.update("Bordero", borderoId, totals);
    },

    async uploadDebtorsAtomic(uploadMode, selectedBatch, debtors) {
        return backend.uploadDebtorsAtomic({
            uploadMode,
            selectedDebtorForRevision: uploadMode === "revise" ? selectedBatch : null,
            debtors,
        });
    },

    async deleteBatch(batchId) {
        return backend.delete("Batch", batchId).catch(() => {});
    },

    async deleteBordero(borderoId) {
        return backend.delete("Bordero", borderoId).catch(() => {});
    },

    async deleteDebtor(id) {
        return backend.delete("Debtor", id).catch(() => {});
    },

    // ─── Status transitions ───────────────────────────────────────────────────

    async updateStatus(debtorId, status) {
        return backend.update("Debtor", debtorId, { status });
    },

    async requestRevision(debtorId, note) {
        return backend.update("Debtor", debtorId, {
            status: "CONDITIONAL",
            validation_remarks: note,
        });
    },

    // ─── Bulk whole-batch actions ─────────────────────────────────────────────

    async startBulkAction(action, batchId, contractId, initiatedBy) {
        return backend.startBulkDebtorAction({
            action,
            batch_id: batchId,
            contract_id: contractId,
            initiated_by: initiatedBy,
        });
    },

    async getJobStatus(jobId) {
        return backend.getDebtorJobStatus(jobId);
    },

    // ─── Audit & Notifications ────────────────────────────────────────────────

    async _audit(action, module, entityId, oldVal, newVal, userEmail, userRole, reason) {
        return backend.create("AuditLog", {
            action, module,
            entity_type: "Debtor",
            entity_id: entityId,
            old_value: typeof oldVal === "string" ? oldVal : JSON.stringify(oldVal),
            new_value: typeof newVal === "string" ? newVal : JSON.stringify(newVal),
            user_email: userEmail,
            user_role: userRole,
            reason,
        }).catch((e) => console.warn("[debtorService] audit error:", e));
    },

    async _notify(title, message, module, referenceId, targetRole) {
        return backend.create("Notification", {
            title, message,
            type: "INFO",
            module,
            reference_id: referenceId,
            target_role: targetRole,
        }).catch((e) => console.warn("[debtorService] notify error:", e));
    },

    async notifyUploadComplete(uploaded, batchId, userEmail, userRole) {
        const roles = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
        await Promise.all(roles.map((role) =>
            this._notify(
                "Batch Upload Completed",
                `${userRole} Successfully uploaded ${uploaded} debtors to batch ${batchId}`,
                "DEBTOR", batchId, role,
            ),
        ));
    },

    async notifyChecked(processedCount, batchId, userEmail, userRole) {
        const roles = ["maker-brins-role", "checker-brins-role", "approver-brins-role"];
        await Promise.all(roles.map((role) =>
            this._notify(
                "Debtors Checked by BRINS Checker",
                `${userRole} checked ${processedCount} debtor(s). Awaiting BRINS Approver approval.`,
                "DEBTOR", undefined, role,
            ),
        ));
    },

    async notifyApproved(processedCount, batchId, userEmail, userRole) {
        const roles = [
            "maker-brins-role", "checker-brins-role", "approver-brins-role",
            "tugure-checker-role", "tugure-approver-role",
        ];
        await Promise.all(roles.map((role) =>
            this._notify(
                "Debtors Approved by BRINS",
                `${userRole} approved ${processedCount} debtor(s). Now available for Tugure review.`,
                "DEBTOR", undefined, role,
            ),
        ));
    },
};
