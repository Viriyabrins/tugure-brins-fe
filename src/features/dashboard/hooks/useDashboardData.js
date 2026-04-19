import { useState, useEffect, useMemo } from "react";
import { dashboardService } from "../services/dashboardService";
import { toNum, DASHBOARD_COLORS } from "../utils/dashboardConstants";

const EMPTY_STATS = { totalDebtors: 0, approvedDebtors: 0, submittedDebtors: 0, rejectedDebtors: 0, totalExposure: 0, totalPremium: 0, totalGrossPremi: 0, totalNetPremi: 0, totalClaims: 0, claimsPaid: 0, osRecovery: 0, lossRatio: 0, totalPayments: 0, issuedNotas: 0, paidNotas: 0, totalNotaPremium: 0, totalContracts: 0, submittedContracts: 0, approvedContracts: 0 };

export function useDashboardData() {
    const [period, setPeriod] = useState("2025-03");
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ batch: "all" });
    const [rawData, setRawData] = useState({ debtors: [], claims: [], borderos: [], notas: [], batches: [], subrogations: [], payments: [], contracts: [] });

    const reload = async () => {
        setLoading(true);
        try {
            const data = await dashboardService.loadAll();
            setRawData(data);
        } catch (e) {
            console.error("Failed to load dashboard data:", e);
            setRawData({ debtors: [], claims: [], borderos: [], notas: [], batches: [], subrogations: [], payments: [], contracts: [] });
        }
        setLoading(false);
    };

    useEffect(() => { reload(); }, [period]);

    // Chart data derived from rawData
    const { debtors, claims, borderos, notas, batches, subrogations, contracts, payments } = rawData;

    // Batch IDs whose period matches the selected period filter
    const periodBatchIds = useMemo(() => {
        if (!period) return null;
        const matching = batches
            .filter((b) => (b.period && b.period === period) || (b.batch_id && b.batch_id.includes(period)))
            .map((b) => b.batch_id);
        return matching.length > 0 ? new Set(matching) : null;
    }, [batches, period]);

    // Debtors after applying period + batch filters
    const filteredDebtors = useMemo(() => {
        let result = debtors;
        if (periodBatchIds) result = result.filter((d) => periodBatchIds.has(d.batch_id));
        if (filters.batch !== "all") result = result.filter((d) => d.batch_id === filters.batch);
        return result;
    }, [debtors, periodBatchIds, filters.batch]);

    // Stats recomputed whenever filtered debtors or other raw data changes
    const stats = useMemo(
        () => dashboardService.computeStats({ ...rawData, debtors: filteredDebtors }),
        [rawData, filteredDebtors]
    );

    const debtorStatusData = [
        { name: "Submitted", value: filteredDebtors.filter((d) => d.status === "SUBMITTED").length, color: "#3b82f6" },
        { name: "Approved", value: filteredDebtors.filter((d) => d.status === "APPROVED").length, color: "#10b981" },
        { name: "Checked Tugure", value: filteredDebtors.filter((d) => d.status === "CHECKED_TUGURE").length, color: "#0F766E" },
        { name: "Checked Brins", value: filteredDebtors.filter((d) => d.status === "CHECKED_BRINS").length, color: "#0E7490" },
        { name: "Approved Brins", value: filteredDebtors.filter((d) => d.status === "APPROVED_BRINS").length, color: "#4338CA" },
        { name: "Revision", value: filteredDebtors.filter((d) => d.status === "REVISION").length, color: "#C2410C" },
    ].filter((d) => d.value > 0);

    const contractStatusData = [
        { name: "Submitted", value: contracts.filter((c) => ["SUBMITTED", "Draft", "Active"].includes(c.contract_status)).length, color: "#3b82f6" },
        { name: "Approved", value: contracts.filter((c) => c.contract_status === "APPROVED").length, color: "#10b981" },
        { name: "Checked Tugure", value: contracts.filter((c) => c.contract_status === "CHECKED_TUGURE").length, color: "#0F766E" },
        { name: "Checked Brins", value: contracts.filter((c) => c.contract_status === "CHECKED_BRINS").length, color: "#0E7490" },
        { name: "Approved Brins", value: contracts.filter((c) => c.contract_status === "APPROVED_BRINS").length, color: "#4338CA" },
        { name: "Revision", value: contracts.filter((c) => c.contract_status === "REVISION").length, color: "#C2410C" },
    ].filter((c) => c.value > 0);

    const premiumBuckets = filteredDebtors.reduce((acc, d) => {
        const s = (d?.status || "").toUpperCase();
        const amt = toNum(d?.net_premi ?? d?.net_premium ?? d?.netPremi ?? 0);
        if (s === "APPROVED") acc.approved += amt;
        else if (["SUBMITTED", "CHECKED_TUGURE", "CHECKED_BRINS", "APPROVED_BRINS"].includes(s)) acc.submitted += amt;
        return acc;
    }, { approved: 0, submitted: 0 });

    const premiumByStatusData = [
        { name: "Approved", value: premiumBuckets.approved, color: "#10B981" },
        { name: "Submitted", value: premiumBuckets.submitted, color: "#3b82f6" },
    ].filter((d) => d.value > 0);

    const claimStatusData = [
        { name: "Draft", value: claims.filter((c) => c.status === "Draft").length },
        { name: "Checked", value: claims.filter((c) => c.status === "Checked").length },
        { name: "Doc Verified", value: claims.filter((c) => c.status === "Doc Verified").length },
        { name: "Invoiced", value: claims.filter((c) => c.status === "Invoiced").length },
        { name: "Paid", value: claims.filter((c) => c.status === "Paid").length },
    ].filter((d) => d.value > 0);

    const subrogationChartData = [
        { status: "Submitted", amount: subrogations.filter((s) => ["Draft", "Submitted"].includes(s.status)).reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0), count: subrogations.filter((s) => ["Draft", "Submitted"].includes(s.status)).length },
        { status: "In Progress", amount: subrogations.filter((s) => ["In Progress", "Processing"].includes(s.status)).reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0), count: subrogations.filter((s) => ["In Progress", "Processing"].includes(s.status)).length },
        { status: "Recovered", amount: subrogations.filter((s) => ["Recovered", "Completed"].includes(s.status)).reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0), count: subrogations.filter((s) => ["Recovered", "Completed"].includes(s.status)).length },
        { status: "Closed", amount: subrogations.filter((s) => s.status === "Closed").reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0), count: subrogations.filter((s) => s.status === "Closed").length },
    ].filter((d) => d.count > 0);

    const monthlyTrendData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, idx) => {
        const monthNum = idx + 1;
        const recapRows = batches.map((b) => {
            const batchClaims = claims.filter((c) => c.batch_id === b.batch_id);
            return {
                batch_month: b.batch_month,
                premium: parseFloat(b.total_premium) || parseFloat(b.final_premium_amount) || parseFloat(b.premium) || 0,
                komisi: parseFloat(b.commission) || 0,
                claimAmt: batchClaims.reduce((s, c) => s + (parseFloat(c.share_tugure_amount) || 0), 0),
            };
        });
        const monthly = recapRows.filter((r) => Number(r.batch_month) === monthNum);
        const recovery = subrogations.reduce((sum, s) => {
            if (!s.recovery_amount) return sum;
            let mNum = null;
            if (s.claim_id) {
                const rc = claims.find((c) => c.id === s.claim_id || c.claim_id === s.claim_id);
                if (rc) { const rb = batches.find((b) => b.batch_id === rc.batch_id); if (rb?.batch_month) mNum = Number(rb.batch_month); }
            }
            if (!mNum) { const d = new Date(s.created_at || s.createdAt || ""); if (!isNaN(d.getTime())) mNum = d.getMonth() + 1; }
            return mNum === monthNum ? sum + (parseFloat(s.recovery_amount) || 0) : sum;
        }, 0);
        const premium = monthly.reduce((s, r) => s + r.premium, 0);
        const komisi = monthly.reduce((s, r) => s + r.komisi, 0);
        const claimsAmt = monthly.reduce((s, r) => s + r.claimAmt, 0);
        return { month, premium, komisi, claims: claimsAmt, recovery, lossRatio: premium > 0 ? Number(((claimsAmt / premium) * 100).toFixed(1)) : 0 };
    });

    // Batch IDs available for the batch dropdown — scoped to the selected period
    const batchIds = useMemo(() => {
        const source = periodBatchIds ? debtors.filter((d) => periodBatchIds.has(d.batch_id)) : debtors;
        return [...new Set(source.map((d) => d.batch_id).filter(Boolean))];
    }, [debtors, periodBatchIds]);

    return { period, setPeriod, filters, setFilters, loading, stats, rawData, reload, debtorStatusData, contractStatusData, premiumByStatusData, claimStatusData, subrogationChartData, monthlyTrendData, batchIds };
}
