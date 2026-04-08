import { backend } from "@/api/backendClient";

export const recapSummaryService = {
    async loadData() {
        const [batchData, claimData, debtorData] = await Promise.all([
            backend.list("Batch"),
            backend.list("Claim"),
            backend.list("Debtor"),
        ]);
        return {
            batches: Array.isArray(batchData) ? batchData : [],
            claims: Array.isArray(claimData) ? claimData : [],
            debtors: Array.isArray(debtorData) ? debtorData : [],
        };
    },
};
