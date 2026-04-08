export const DEFAULT_ADVANCED_FILTER = {
    batch: "all",
    period: "all",
    branch: "all",
    plafonRange: "all",
    batchStatus: "all",
    claimStatus: "all",
    creditType: "all",
};

export const BATCH_STATUSES = ["Uploaded", "Validated", "Matched", "Approved", "Nota Issued", "Branch Confirmed", "Paid", "Closed"];
export const CLAIM_STATUSES = ["Draft", "Checked", "Doc Verified", "Invoiced", "Paid"];
export const CREDIT_TYPES = ["Individual", "Corporate"];

export function computeLossRatio(filteredBatches, filteredDebtors, filteredClaims, debtors, claims, contracts) {
    const earnedBatches = filteredBatches.filter((b) => ["Paid", "Closed"].includes(b.status));
    const earnedBatchIds = earnedBatches.map((b) => b.batch_id);
    const earnedDebtors = filteredDebtors.filter((d) => earnedBatchIds.includes(d.batch_id));
    const premiumEarned = earnedDebtors.reduce((s, d) => s + (parseFloat(d.net_premi) || 0), 0);
    const paidClaims = filteredClaims.filter((c) => c.claim_status === "Paid");
    const claimPaid = paidClaims.reduce((s, c) => s + (c.share_tugure_amount || 0), 0);
    const lossRatio = premiumEarned > 0 ? (claimPaid / premiumEarned) * 100 : 0;
    const closedBatches = filteredBatches.filter((b) => b.status === "Closed").length;
    const outstandingBatches = filteredBatches.length - closedBatches;
    const claimPaymentRate = (() => { const inv = filteredClaims.filter((c) => ["Invoiced", "Paid"].includes(c.claim_status)).length; return inv > 0 ? (paidClaims.length / inv) * 100 : 0; })();
    const monthlyData = {};
    paidClaims.forEach((c) => {
        const key = (c.paid_date || c.created_date || "").substring(0, 7);
        if (!key) return;
        if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, Draft: 0, Checked: 0, "Doc Verified": 0, Invoiced: 0, Paid: 0 };
        monthlyData[key].claimPaid += parseFloat(c.share_tugure_amount) || 0;
    });
    filteredClaims.forEach((c) => {
        const key = (c.created_date || "").substring(0, 7);
        if (!key) return;
        if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, Draft: 0, Checked: 0, "Doc Verified": 0, Invoiced: 0, Paid: 0 };
        monthlyData[key][c.claim_status] = (monthlyData[key][c.claim_status] || 0) + 1;
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const byCreditType = {};
    earnedDebtors.forEach((d) => { const t = contracts.find((c) => c.contract_id === d.contract_id)?.credit_type || "Unknown"; if (!byCreditType[t]) byCreditType[t] = { premium: 0, claim: 0 }; byCreditType[t].premium += parseFloat(d.net_premi) || 0; });
    paidClaims.forEach((c) => { const d = debtors.find((x) => x.id === c.debtor_id); const t = contracts.find((ct) => ct.contract_id === d?.contract_id)?.credit_type || "Unknown"; if (!byCreditType[t]) byCreditType[t] = { premium: 0, claim: 0 }; byCreditType[t].claim += c.share_tugure_amount || 0; });
    const creditTypeData = Object.entries(byCreditType).map(([type, data]) => ({ type, lossRatio: data.premium > 0 ? ((data.claim / data.premium) * 100).toFixed(2) : 0, premium: data.premium, claim: data.claim }));
    const byBranch = {};
    earnedDebtors.forEach((d) => { const b = d.branch_desc || "Unknown"; if (!byBranch[b]) byBranch[b] = { premium: 0, claim: 0 }; byBranch[b].premium += parseFloat(d.net_premi) || 0; });
    paidClaims.forEach((c) => { const d = debtors.find((x) => x.id === c.debtor_id); const b = d?.branch_desc || "Unknown"; if (!byBranch[b]) byBranch[b] = { premium: 0, claim: 0 }; byBranch[b].claim += c.share_tugure_amount || 0; });
    const branchData = Object.entries(byBranch).map(([branch, data]) => ({ branch, lossRatio: data.premium > 0 ? ((data.claim / data.premium) * 100).toFixed(2) : 0 })).sort((a, b) => parseFloat(b.lossRatio) - parseFloat(a.lossRatio)).slice(0, 10);
    return { premiumEarned, claimPaid, lossRatio, closedBatches, outstandingBatches, claimPaymentRate, trend, creditTypeData, branchData };
}

export function computePremiumByStatus(filteredBatches, filteredDebtors) {
    const totalGrossPremium = filteredBatches.reduce((s, b) => s + (parseFloat(b.total_premium) || 0), 0);
    const netPremium = filteredDebtors.reduce((s, d) => s + (parseFloat(d.net_premi) || 0), 0);
    const paidPremium = filteredBatches.filter((b) => ["Paid", "Closed"].includes(b.status)).reduce((s, b) => s + (parseFloat(b.total_premium) || 0), 0);
    const outstandingPremium = totalGrossPremium - paidPremium;
    const statusData = {};
    filteredBatches.forEach((b) => { const s = b.status || "UNKNOWN"; statusData[s] = (statusData[s] || 0) + (parseFloat(b.total_premium) || 0); });
    const byStatus = Object.entries(statusData).map(([status, amount]) => ({ status, amount })).sort((a, b) => b.amount - a.amount);
    const monthlyData = {};
    filteredBatches.forEach((b) => {
        const key = (b.created_date || "").substring(0, 7);
        if (!key) return;
        if (!monthlyData[key]) monthlyData[key] = { month: key, Uploaded: 0, Validated: 0, Matched: 0, Approved: 0, "Nota Issued": 0, "Branch Confirmed": 0, Paid: 0, Closed: 0 };
        const s = b.status || "UNKNOWN";
        monthlyData[key][s] = (monthlyData[key][s] || 0) + (parseFloat(b.total_premium) || 0);
    });
    const trend = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const byBranch = {};
    filteredDebtors.forEach((d) => { const b = d.branch_desc || "Unknown"; const s = d.batch_status || "UNKNOWN"; if (!byBranch[b]) byBranch[b] = { paid: 0, outstanding: 0 }; if (["Paid", "Closed"].includes(s)) byBranch[b].paid += parseFloat(d.net_premi) || 0; else byBranch[b].outstanding += parseFloat(d.net_premi) || 0; });
    const branchData = Object.entries(byBranch).map(([branch, data]) => ({ branch, ...data })).sort((a, b) => b.paid + b.outstanding - (a.paid + a.outstanding)).slice(0, 10);
    const bottleneck = byStatus.find((s) => !["Paid", "Closed"].includes(s.status)) || {};
    return { totalGrossPremium, netPremium, paidPremium, paidPercentage: totalGrossPremium > 0 ? (paidPremium / totalGrossPremium) * 100 : 0, outstandingPremium, outstandingPercentage: totalGrossPremium > 0 ? (outstandingPremium / totalGrossPremium) * 100 : 0, byStatus, trend, branchData, bottleneck };
}

export function computeClaimPaid(filteredClaims, debtors, contracts) {
    const paidClaims = filteredClaims.filter((c) => c.claim_status === "Paid");
    const totalPaid = paidClaims.reduce((s, c) => s + (parseFloat(c.share_tugure_amount) || 0), 0);
    const inProgress = filteredClaims.filter((c) => ["Draft", "Checked", "Doc Verified"].includes(c.claim_status)).length;
    const invoicedNotPaid = filteredClaims.filter((c) => c.claim_status === "Invoiced").length;
    let totalDays = 0, settledCount = 0;
    paidClaims.forEach((c) => { if (c.created_date && c.paid_date) { const days = Math.floor((new Date(c.paid_date) - new Date(c.created_date)) / 86400000); if (days >= 0) { totalDays += days; settledCount++; } } });
    const avgSettlementDays = settledCount > 0 ? Math.round(totalDays / settledCount) : 0;
    const monthlyData = {};
    filteredClaims.forEach((c) => { const key = (c.created_date || "").substring(0, 7); if (!key) return; if (!monthlyData[key]) monthlyData[key] = { month: key, Draft: 0, Checked: 0, "Doc Verified": 0, Invoiced: 0, Paid: 0 }; monthlyData[key][c.claim_status] = (monthlyData[key][c.claim_status] || 0) + 1; });
    const byStatus = {};
    filteredClaims.forEach((c) => { const s = c.claim_status || "UNKNOWN"; byStatus[s] = (byStatus[s] || 0) + (parseFloat(c.share_tugure_amount) || 0); });
    const byProduct = {};
    paidClaims.forEach((c) => { const d = debtors.find((x) => x.id === c.debtor_id); const p = contracts.find((ct) => ct.contract_id === d?.contract_id)?.credit_type || "Unknown"; byProduct[p] = (byProduct[p] || 0) + (parseFloat(c.share_tugure_amount) || 0); });
    return { totalPaid, count: paidClaims.length, inProgress, invoicedNotPaid, avgSettlementDays, trend: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)), statusData: Object.entries(byStatus).map(([status, amount]) => ({ status, amount })), productData: Object.entries(byProduct).map(([product, amount]) => ({ product, amount })) };
}

export function computeOutstandingRecovery(filteredClaims, filteredSubrogations, debtors, claims, contracts) {
    const paidClaims = filteredClaims.filter((c) => c.claim_status === "Paid");
    const totalClaimPaid = paidClaims.reduce((s, c) => s + (parseFloat(c.share_tugure_amount) || 0), 0);
    const paidSubrogations = filteredSubrogations.filter((s) => s.status === "Paid / Closed");
    const totalRecovered = paidSubrogations.reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0);
    const monthlyData = {};
    paidClaims.forEach((c) => { const key = (c.paid_date || c.created_date || "").substring(0, 7); if (!key) return; if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, recovered: 0, outstanding: 0 }; monthlyData[key].claimPaid += parseFloat(c.share_tugure_amount) || 0; });
    paidSubrogations.forEach((s) => { const key = (s.closed_date || s.created_date || "").substring(0, 7); if (!key) return; if (!monthlyData[key]) monthlyData[key] = { month: key, claimPaid: 0, recovered: 0, outstanding: 0 }; monthlyData[key].recovered += parseFloat(s.recovery_amount) || 0; });
    Object.values(monthlyData).forEach((m) => { m.outstanding = m.claimPaid - m.recovered; });
    const byType = {};
    paidClaims.forEach((c) => { const d = debtors.find((x) => x.id === c.debtor_id); const t = contracts.find((ct) => ct.contract_id === d?.contract_id)?.credit_type || "Unknown"; if (!byType[t]) byType[t] = { claimPaid: 0, recovered: 0 }; byType[t].claimPaid += parseFloat(c.share_tugure_amount) || 0; });
    paidSubrogations.forEach((s) => { const clm = claims.find((c) => c.id === s.claim_id); const d = debtors.find((x) => x.id === clm?.debtor_id); const t = contracts.find((ct) => ct.contract_id === d?.contract_id)?.credit_type || "Unknown"; if (!byType[t]) byType[t] = { claimPaid: 0, recovered: 0 }; byType[t].recovered += parseFloat(s.recovery_amount) || 0; });
    return { totalClaimPaid, totalRecovered, outstanding: totalClaimPaid - totalRecovered, trend: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)), typeData: Object.entries(byType).map(([type, data]) => ({ type, outstanding: data.claimPaid - data.recovered })) };
}

export function computeSubrogation(filteredSubrogations, claims, debtors) {
    const totalAmount = filteredSubrogations.reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0);
    const recovered = filteredSubrogations.filter((s) => s.status === "Paid / Closed");
    const recoveredAmount = recovered.reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0);
    const pendingAmount = filteredSubrogations.filter((s) => s.status !== "Paid / Closed").reduce((s, x) => s + (parseFloat(x.recovery_amount) || 0), 0);
    const monthlyData = {};
    filteredSubrogations.forEach((s) => { const key = (s.created_date || "").substring(0, 7); if (!key) return; if (!monthlyData[key]) monthlyData[key] = { month: key, Draft: 0, Invoiced: 0, "Paid / Closed": 0 }; monthlyData[key][s.status] = (monthlyData[key][s.status] || 0) + (parseFloat(s.recovery_amount) || 0); });
    const byStatus = {};
    filteredSubrogations.forEach((s) => { const st = s.status || "UNKNOWN"; byStatus[st] = (byStatus[st] || 0) + (parseFloat(s.recovery_amount) || 0); });
    const byBranch = {};
    recovered.forEach((s) => { const clm = claims.find((c) => c.id === s.claim_id); const d = debtors.find((x) => x.id === clm?.debtor_id); const b = d?.branch_desc || "Unknown"; byBranch[b] = (byBranch[b] || 0) + (parseFloat(s.recovery_amount) || 0); });
    return { totalAmount, recoveredAmount, pendingAmount, recoveryRate: totalAmount > 0 ? (recoveredAmount / totalAmount) * 100 : 0, trend: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)), statusData: Object.entries(byStatus).map(([status, amount]) => ({ status, amount })), branchData: Object.entries(byBranch).map(([branch, amount]) => ({ branch, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10) };
}
