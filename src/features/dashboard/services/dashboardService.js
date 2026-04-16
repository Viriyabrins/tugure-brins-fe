import { backend } from "@/api/backendClient";
import { toNum } from "../utils/dashboardConstants";

export const dashboardService = {
    async loadAll() {
        const [debtors, claims, borderos, notas, batches, subrogations, payments, contracts] = await Promise.all([
            backend.list("Debtor"),
            backend.list("Claim"),
            backend.list("Bordero"),
            backend.list("Nota"),
            backend.list("Batch"),
            backend.list("Subrogation"),
            backend.list("Payment"),
            backend.list("MasterContract"),
        ]);
        return {
            debtors: Array.isArray(debtors) ? debtors : [],
            claims: Array.isArray(claims) ? claims : [],
            borderos: Array.isArray(borderos) ? borderos : [],
            notas: Array.isArray(notas) ? notas : [],
            batches: Array.isArray(batches) ? batches : [],
            subrogations: Array.isArray(subrogations) ? subrogations : [],
            payments: Array.isArray(payments) ? payments : [],
            contracts: Array.isArray(contracts) ? contracts : [],
        };
    },

    computeStats(data) {
        const { debtors, claims, notas, subrogations, payments, contracts } = data;
        const approved = debtors.filter((d) => d.status === "APPROVED").length;
        const submitted = debtors.filter((d) => ["SUBMITTED", "DRAFT", "APPROVED_BRINS", "CHECKED_BRINS", "CHECKED_TUGURE"].includes(d.status)).length;
        const rejected = debtors.filter((d) => d.status === "REJECTED").length;
        const totalExposure = debtors.reduce((s, d) => s + (parseFloat(d.plafon) || 0), 0);
        const approvedDebtors = debtors.filter((d) => (d?.status || "").toUpperCase() === "APPROVED");
        const totalPremium = approvedDebtors.reduce((s, d) => s + toNum(d?.net_premi ?? d?.net_premium ?? d?.netPremi ?? 0), 0);
        // Total gross premi aggregated from `premium_amount` or `premium` across all debtors
        const totalGrossPremi = debtors.reduce((s, d) => s + toNum(d?.premium_amount ?? d?.premium ?? 0), 0);
        // Total net premi aggregated from `net_premi` (or variants) across all debtors
        const totalNetPremi = debtors.reduce((s, d) => s + toNum(d?.net_premi ?? d?.net_premium ?? d?.netPremi ?? 0), 0);
        const contractsApproved = contracts.filter((c) => c.contract_status === "APPROVED").length;
        const contractsSubmitted = contracts.filter((c) => ["Active", "Draft", "APPROVED_BRINS", "CHECKED_BRINS", "CHECKED_TUGURE"].includes(c.contract_status)).length;
        const claimsPaid = claims.filter((c) => c.status === "Paid").reduce((s, c) => s + (parseFloat(c.nilai_klaim) || 0), 0);
        const totalPayments = payments.filter((p) => p.is_actual_payment).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const lossRatio = totalPremium > 0 ? (claimsPaid / totalPremium) * 100 : 0;
        const osRecovery = subrogations.filter((s) => s.status !== "Closed").reduce((s, sub) => s + (parseFloat(sub.recovery_amount) || 0), 0);
        const issuedNotas = notas.filter((n) => n.status === "Issued").length;
        const paidNotas = notas.filter((n) => n.status === "Paid").length;
        const totalNotaPremium = notas.filter((n) => ["Issued", "Paid"].includes(n.status)).reduce((s, n) => s + (parseFloat(n.amount) || 0), 0);
        return {
            totalDebtors: debtors.length, approvedDebtors: approved, submittedDebtors: submitted, rejectedDebtors: rejected,
            totalExposure, totalPremium, totalGrossPremi, totalNetPremi, totalClaims: claims.length, claimsPaid, osRecovery,
            lossRatio: Number(lossRatio.toFixed(1)), totalPayments, issuedNotas, paidNotas, totalNotaPremium,
            totalContracts: contracts.length, approvedContracts: contractsApproved, submittedContracts: contractsSubmitted,
        };
    },
};
