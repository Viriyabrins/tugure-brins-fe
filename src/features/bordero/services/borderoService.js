import { backend } from "@/api/backendClient";
import { BORDERO_PAGE_SIZE, getNextBorderoStatus } from "../utils/borderoConstants";

export const borderoService = {
    async loadDebtors(page, filters) {
        const query = { page, limit: BORDERO_PAGE_SIZE };
        if (filters) query.q = JSON.stringify(filters);
        const result = await backend.listPaginated("Debtor", query);
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadBorderos(page, filters) {
        const query = { page, limit: BORDERO_PAGE_SIZE };
        if (filters?.period) query.q = JSON.stringify({ period: filters.period });
        const result = await backend.listPaginated("Bordero", query);
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadClaims(page, filters) {
        const query = { page, limit: BORDERO_PAGE_SIZE };
        if (filters) query.q = JSON.stringify({ claimStatus: filters.claimStatus, startDate: filters.startDate, endDate: filters.endDate });
        const result = await backend.listPaginated("Claim", query);
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadContracts(page) {
        const result = await backend.listPaginated("Contract", { page, limit: BORDERO_PAGE_SIZE });
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async loadSubrogations() {
        const data = await backend.list("Subrogation");
        return Array.isArray(data) ? data : [];
    },

    async loadBorderoDebtors(borderoId, page) {
        const query = { page, limit: BORDERO_PAGE_SIZE, q: JSON.stringify({ bordero_id: borderoId }) };
        const result = await backend.listPaginated("Debtor", query);
        return { data: Array.isArray(result.data) ? result.data : [], total: Number(result.pagination?.total) || 0 };
    },

    async exportAll(filters) {
        const debtorQuery = { page: 1, limit: 10000 };
        if (filters) debtorQuery.q = JSON.stringify(filters);

        const borderoQuery = { page: 1, limit: 10000 };
        if (filters?.period) borderoQuery.q = JSON.stringify({ period: filters.period });

        const claimQuery = { page: 1, limit: 10000 };
        if (filters) claimQuery.q = JSON.stringify({ claimStatus: filters.claimStatus, startDate: filters.startDate, endDate: filters.endDate });

        const [debtorRes, borderoRes, claimRes, subrogationData] = await Promise.all([
            backend.listPaginated("Debtor", debtorQuery),
            backend.listPaginated("Bordero", borderoQuery),
            backend.listPaginated("Claim", claimQuery),
            backend.list("Subrogation"),
        ]);

        return {
            debtors: Array.isArray(debtorRes.data) ? debtorRes.data : [],
            borderos: Array.isArray(borderoRes.data) ? borderoRes.data : [],
            claims: Array.isArray(claimRes.data) ? claimRes.data : [],
            subrogations: Array.isArray(subrogationData) ? subrogationData : [],
        };
    },

    async advanceBorderoStatus(bordero, userEmail) {
        const nextStatus = getNextBorderoStatus(bordero.status);
        if (!nextStatus) throw new Error("No next status available");
        const updateData = {
            status: nextStatus,
            [nextStatus === "UNDER_REVIEW" ? "reviewed_by" : "finalized_by"]: userEmail,
            [nextStatus === "UNDER_REVIEW" ? "reviewed_date" : "finalized_date"]: new Date().toISOString().split("T")[0],
        };
        await backend.update("Bordero", bordero.id, updateData);
        return nextStatus;
    },
};
