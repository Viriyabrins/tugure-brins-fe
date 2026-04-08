import { backend } from "@/api/backendClient";

export const advancedReportsService = {
    async loadAll() {
        const [debtors, batches, claims, subrogations, contracts] = await Promise.all([
            backend.list("Debtor"),
            backend.list("Batch"),
            backend.list("Claim"),
            backend.list("Subrogation"),
            backend.list("Contract"),
        ]);
        return {
            debtors: Array.isArray(debtors) ? debtors : [],
            batches: Array.isArray(batches) ? batches : [],
            claims: Array.isArray(claims) ? claims : [],
            subrogations: Array.isArray(subrogations) ? subrogations : [],
            contracts: Array.isArray(contracts) ? contracts : [],
        };
    },
};
