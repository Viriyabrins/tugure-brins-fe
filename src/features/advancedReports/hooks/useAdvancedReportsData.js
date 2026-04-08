import { useState, useEffect } from "react";
import { advancedReportsService } from "../services/advancedReportsService";
import { DEFAULT_ADVANCED_FILTER, computeLossRatio, computePremiumByStatus, computeClaimPaid, computeOutstandingRecovery, computeSubrogation } from "../utils/advancedReportsConstants";

export function useAdvancedReportsData() {
    const [loading, setLoading] = useState(true);
    const [rawData, setRawData] = useState({ debtors: [], batches: [], claims: [], subrogations: [], contracts: [] });
    const [filters, setFilters] = useState(DEFAULT_ADVANCED_FILTER);

    const reload = async () => {
        setLoading(true);
        try {
            setRawData(await advancedReportsService.loadAll());
        } catch (e) { console.error("Failed to load advanced reports data:", e); }
        setLoading(false);
    };

    useEffect(() => { reload(); }, []);

    const { debtors, batches, claims, subrogations, contracts } = rawData;

    const filteredDebtors = debtors.filter((d) => {
        if (filters.batch !== "all" && d.batch_id !== filters.batch) return false;
        if (filters.period !== "all" && d.batch_year?.toString() !== filters.period) return false;
        if (filters.branch !== "all" && d.branch_code !== filters.branch) return false;
        if (filters.batchStatus !== "all" && d.batch_status !== filters.batchStatus) return false;
        if (filters.claimStatus !== "all" && d.claim_status !== filters.claimStatus) return false;
        if (filters.creditType !== "all" && contracts.find((c) => c.contract_id === d.contract_id)?.credit_type !== filters.creditType) return false;
        if (filters.plafonRange !== "all") {
            const p = parseFloat(d.plafon) || 0;
            if (filters.plafonRange === "<100M" && p >= 100_000_000) return false;
            if (filters.plafonRange === "100-500M" && (p < 100_000_000 || p >= 500_000_000)) return false;
            if (filters.plafonRange === "500M-1B" && (p < 500_000_000 || p >= 1_000_000_000)) return false;
            if (filters.plafonRange === ">1B" && p < 1_000_000_000) return false;
        }
        return true;
    });

    const filteredBatches = batches.filter((b) => {
        if (filters.batch !== "all" && b.batch_id !== filters.batch) return false;
        if (filters.batchStatus !== "all" && b.status !== filters.batchStatus) return false;
        return true;
    });

    const filteredClaims = claims.filter((c) => filters.claimStatus === "all" || c.claim_status === filters.claimStatus);
    const filteredSubrogations = subrogations.filter((s) => {
        const matchingClaim = claims.find((c) => c.id === s.claim_id);
        return filters.claimStatus === "all" || matchingClaim?.claim_status === filters.claimStatus;
    });

    const lossRatio = computeLossRatio(filteredBatches, filteredDebtors, filteredClaims, debtors, claims, contracts);
    const premiumStatus = computePremiumByStatus(filteredBatches, filteredDebtors);
    const claimPaid = computeClaimPaid(filteredClaims, debtors, contracts);
    const recovery = computeOutstandingRecovery(filteredClaims, filteredSubrogations, debtors, claims, contracts);
    const subrogation = computeSubrogation(filteredSubrogations, claims, debtors);

    const branches = [...new Set(debtors.map((d) => d.branch_code))].filter(Boolean);

    return { loading, filters, setFilters, reload, lossRatio, premiumStatus, claimPaid, recovery, subrogation, branches, rawData };
}
