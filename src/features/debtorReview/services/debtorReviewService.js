import { backend } from "@/api/backendClient";
import { sendNotificationEmail } from "@/components/utils/emailTemplateHelper";
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
        const statuses = ["APPROVED_BRINS", "CHECKED_TUGURE", "APPROVED", "REVISION"];
        const results = await Promise.all(
            statuses.map((s) =>
                backend.listPaginated("Debtor", { page: 1, limit: 1, q: JSON.stringify({ submitStatus: s }) })
            )
        );
        const counts = results.map((r) => Number(r.pagination?.total) || 0);

        let totalPlafond = 0;
        try {
            const sample = await backend.listPaginated("Debtor", {
                page: 1, limit: 100, q: JSON.stringify({ submitStatus: "APPROVED" }),
            });
            totalPlafond = (Array.isArray(sample.data) ? sample.data : [])
                .reduce((s, d) => s + (parseFloat(d.plafon) || 0), 0);
        } catch (e) {
            console.warn("Failed to load plafon sample:", e);
        }

        return {
            pending: counts[0],       // APPROVED_BRINS
            checkedTugure: counts[1], // CHECKED_TUGURE
            approved: counts[2],      // APPROVED
            revision: counts[3],      // REVISION
            totalPlafond,
        };
    },

    async checkDebtors(debtors, user, auditActor) {
        let count = 0;
        for (const d of debtors) {
            if (!d?.id || d.status !== "APPROVED_BRINS") continue;
            await backend.update("Debtor", d.id, { status: "CHECKED_TUGURE" });
            count++;
            await _audit(
                "DEBTOR_CHECKED_TUGURE", d.id,
                { status: d.status },
                { status: "CHECKED_TUGURE", remarks: "" },
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                `Tugure Checker checked debtor ${d.nama_peserta || d.debtor_name}`,
            );
        }
        if (count > 0) {
            await _notify(
                "Debtors Checked by Tugure",
                `${auditActor?.user_email || user?.email} checked ${count} debtor(s).`,
                "INFO",
                debtors[0]?.batch_id,
            );
            sendNotificationEmail({
                targetGroup: "tugure-approver",
                objectType: "Record",
                statusTo: "CHECKED_TUGURE",
                recipientRole: "TUGURE",
                variables: { debtor_count: String(count), action_by: auditActor?.user_email || user?.email },
                fallbackSubject: "Debtor Checked - Awaiting Approval",
                fallbackBody: `${count} debtor(s) checked by ${auditActor?.user_email || user?.email} and awaiting your approval.`,
            }).catch((e) => console.warn("Email failed:", e));
        }
        return count;
    },

    async approveDebtors(debtors, remarks, user, auditActor) {
        let count = 0, totalPlafon = 0, totalNetPremi = 0;
        const batchId = debtors[0]?.batch_id;
        const contractId = debtors[0]?.contract_id;

        for (const d of debtors) {
            if (!d?.id || d.status !== "CHECKED_TUGURE") continue;
            await backend.update("Debtor", d.id, { status: "APPROVED", revision_reason: null, validation_remarks: null });
            await backend.create("Record", {
                batch_id: d.batch_id, debtor_id: d.id,
                record_status: "Accepted",
                exposure_amount: parseFloat(d.plafon) || 0,
                premium_amount: parseFloat(d.net_premi) || 0,
                revision_count: 0,
                accepted_by: user?.email,
                accepted_date: new Date().toISOString(),
            });
            count++;
            totalPlafon += parseFloat(d.plafon) || 0;
            totalNetPremi += parseFloat(d.net_premi) || 0;
            await _audit(
                "DEBTOR_APPROVED", d.id,
                { status: d.status },
                { status: "APPROVED", remarks },
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                remarks,
            );
        }

        // Generate Nota
        if (count > 0 && contractId) {
            try {
                let batchData = null;
                try { batchData = await backend.get("Batch", batchId); } catch (e) { /* skip */ }
                await backend.create("Nota", {
                    nota_number: `NOTA-${contractId}-${Date.now()}`,
                    nota_type: "Batch",
                    reference_id: batchId,
                    contract_id: contractId,
                    amount: totalNetPremi,
                    currency: "IDR",
                    status: "UNPAID",
                    issued_by: auditActor?.user_email || user?.email,
                    issued_date: new Date().toISOString(),
                    total_actual_paid: 0,
                    reconciliation_status: "PENDING",
                    premium: parseFloat(batchData?.premium) || 0,
                    commission: parseFloat(batchData?.commission) || 0,
                    claim: parseFloat(batchData?.claim) || 0,
                    total: parseFloat(batchData?.total) || 0,
                    net_due: parseFloat(batchData?.net_due) || 0,
                });
            } catch (e) {
                console.warn("Nota generation failed:", e);
            }
            await _notify(
                "Debtors Approved (Final)",
                `${auditActor?.user_email || user?.email} approved ${count} debtor(s).`,
                "INFO", batchId,
            );
        }
        return count;
    },

    async reviseDebtors(debtors, remarks, user, auditActor) {
        let count = 0;
        for (const d of debtors) {
            if (!d?.id || d.status !== "CHECKED_TUGURE") continue;
            await backend.update("Debtor", d.id, {
                status: "REVISION",
                revision_reason: remarks,
                validation_remarks: remarks,
            });
            count++;
            await _audit(
                "DEBTOR_REVISION", d.id,
                { status: d.status },
                { status: "REVISION", remarks },
                auditActor?.user_email || user?.email,
                auditActor?.user_role || user?.role,
                remarks,
            );
        }
        if (count > 0) {
            await _notify(
                "Debtors Marked for Revision",
                `${auditActor?.user_email || user?.email} marked ${count} debtor(s) for revision.`,
                "WARNING", debtors[0]?.batch_id,
            );
        }
        return count;
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
