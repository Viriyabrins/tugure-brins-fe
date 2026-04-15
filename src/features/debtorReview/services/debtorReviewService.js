import { backend } from "@/api/backendClient";
import { ALL_ROLES } from "../utils/debtorReviewConstants";

async function _audit(action, entityId, oldVal, newVal, userEmail, userRole, reason) {
    try {
        await backend.create("AuditLog", {
            action,
            module: "DEBTOR",
            entity_type: "Debtor",
            entity_id: entityId,
            old_value: JSON.stringify(oldVal),
            new_value: JSON.stringify(newVal),
            user_email: userEmail,
            user_role: userRole,
            reason,
        });
    } catch (e) {
        console.warn("Audit log failed:", e);
    }
}

async function _notify(title, message, type, referenceId) {
    for (const role of ALL_ROLES) {
        try {
            await backend.create("Notification", {
                title,
                message,
                type,
                module: "DEBTOR",
                reference_id: referenceId,
                target_role: role,
            });
        } catch (e) {
            console.warn("Notification failed:", e);
        }
    }
}


export const debtorReviewService = {
    async listDebtors(filters, page, pageSize, sortColumn, sortOrder) {
        const query = { page, limit: pageSize };
        const reviewFilters = { ...filters, excludeStatuses: "SUBMITTED,CHECKED_BRINS,DRAFT" };
        query.q = JSON.stringify(reviewFilters);
        if (sortColumn && sortOrder) { query.sortBy = sortColumn; query.sortOrder = sortOrder; }
        const useReviseLog = filters?.submitStatus === "REVISION" || filters?.status === "REVISION";
        const entityName = useReviseLog ? "ReviseLog" : "Debtor";
        const result = await backend.listPaginated(entityName, query);
        return {
            data: Array.isArray(result.data) ? result.data : [],
            total: Number(result.pagination?.total) || 0,
        };
    },

    async listContracts() {
        const data = await backend.list("MasterContract");
        return Array.isArray(data) ? data : [];
    },

    async loadStatusCounts() {
        const counts = await backend.getDebtorStatusCounts();
        return counts ?? { pending: 0, checkedTugure: 0, approved: 0, revision: 0, totalPlafond: 0 };
    },

    async checkDebtors(debtors, user, auditActor) {
        const debtorIds = debtors.filter((d) => d?.id && d.status === "APPROVED_BRINS").map((d) => d.id);
        if (!debtorIds.length) return 0;
        const result = await backend.batchDebtorWorkflowAction({ action: "check", debtorIds });
        return result?.processedCount ?? 0;
    },

    async approveDebtors(debtors, remarks, user, auditActor) {
        const debtorIds = debtors.filter((d) => d?.id && d.status === "CHECKED_TUGURE").map((d) => d.id);
        if (!debtorIds.length) return 0;
        const result = await backend.batchDebtorWorkflowAction({ action: "approve", debtorIds, remarks });
        return result?.processedCount ?? 0;
    },

    async reviseDebtors(debtors, remarks, user, auditActor) {
        const debtorIds = debtors.filter((d) => d?.id && d.status === "CHECKED_TUGURE").map((d) => d.id);
        if (!debtorIds.length) return 0;
        const result = await backend.batchDebtorWorkflowAction({ action: "revise", debtorIds, remarks });
        return result?.processedCount ?? 0;
    },

    async startBulkAction(action, batchId, filters, remarks, contractId) {
        return backend.startBulkDebtorAction({
            action,
            filters: { batch_id: batchId, ...filters },
            remarks,
            batchId,
            contract_id: contractId,
        });
    },

    async getBatchSummary(batchId, filters = {}) {
        try {
            const queryFilters = { batch_id: batchId, ...filters };
            // Remove the 'batch' key so it doesn't override the exact batch_id match
            delete queryFilters.batch;
            const rows = await backend.list('Debtor', { q: JSON.stringify(queryFilters) });
            if (!Array.isArray(rows)) return null;
            const summary = rows.reduce(
                (acc, d) => {
                    acc.totalNetPremi += parseFloat(d.net_premi) || 0;
                    acc.totalKomisi += parseFloat(d.ric_amount) || 0;
                    acc.totalPlafon += parseFloat(d.plafon) || 0;
                    acc.totalNominalPremi += parseFloat(d.nominal_premi) || 0;
                    acc.count += 1;
                    return acc;
                },
                { totalNetPremi: 0, totalKomisi: 0, totalPlafon: 0, totalNominalPremi: 0, count: 0 }
            );
            summary.batchId = batchId;
            summary.contractId = rows[0]?.contract_id || "-";
            return summary;
        } catch (e) {
            console.warn('getBatchSummary failed:', e);
            return null;
        }
    },

    getJobStatus(jobId) {
        return backend.getDebtorJobStatus(jobId);
    },

    async loadRevisionDiffs(nomor_peserta, currentDebtor) {
        const res = await backend.listPaginated("DebtorRevise", {
            page: 1, limit: 100, q: JSON.stringify({ nomor_peserta }),
        });
        if (!Array.isArray(res?.data) || !res.data.length) return [];
        const prev = res.data[0];
        const excluded = new Set(["id", "created_at", "updated_at", "archived_at"]);
        return Object.keys(currentDebtor)
            .filter((k) => !excluded.has(k))
            .reduce((acc, k) => {
                const oldStr = prev[k] == null ? "" : String(prev[k]);
                const newStr = currentDebtor[k] == null ? "" : String(currentDebtor[k]);
                if (oldStr !== newStr) acc.push({ key: k, old: oldStr || "-", new: newStr || "-" });
                return acc;
            }, []);
    },
};
