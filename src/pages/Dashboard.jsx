import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    FileText,
    DollarSign,
    AlertTriangle,
    TrendingUp,
    Clock,
    BarChart3,
    PieChart,
    Download,
    RefreshCw
} from "lucide-react";
import {
    PieChart as RePieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    Legend,
    Area,
    AreaChart,
} from "recharts";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { formatRupiahAdaptive } from "@/utils/currency";

const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [period, setPeriod] = useState("2025-03");
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        batch: "all",
        submitStatus: "all",
        reconStatus: "all",
        claimStatus: "all",
        subrogationStatus: "all",
    });
    const [stats, setStats] = useState({
        totalDebtors: 0,
        approvedDebtors: 0,
        pendingDebtors: 0,
        rejectedDebtors: 0,
        totalExposure: 0,
        totalPremium: 0,
        totalClaims: 0,
        claimsPaid: 0,
        osRecovery: 0,
        lossRatio: 0,
        totalPayments: 0,
        issuedNotas: 0,
        paidNotas: 0,
        totalNotaPremium: 0,
    });

    const [debtors, setDebtors] = useState([]);
    const [claims, setClaims] = useState([]);
    const [borderos, setBorderos] = useState([]);
    const [notas, setNotas] = useState([]);
    const [batches, setBatches] = useState([]);
    const [subrogations, setSubrogations] = useState([]);
    const [payments, setPayments] = useState([]);
    const [contracts, setContracts] = useState([]);

    const { bypassAuth } = useAuth();
    const useBackendApi = import.meta.env.VITE_USE_BACKEND_API === "true";

    useEffect(() => {
        loadUser();
        loadDashboardData();
    }, [period]);

    const loadUser = async () => {
        try {
            const demoUserStr = localStorage.getItem("demo_user");
            if (demoUserStr) {
                setUser(JSON.parse(demoUserStr));
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        }
    };

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Load all data using backend client
            const [
                debtorData,
                claimData,
                borderoData,
                notaData,
                batchData,
                subrogationData,
                paymentData,
                contractData,
            ] = await Promise.all([
                backend.list("Debtor"),
                backend.list("Claim"),
                backend.list("Bordero"),
                backend.list("Nota"),
                backend.list("Batch"),
                backend.list("Subrogation"),
                backend.list("Payment"),
                backend.list("Contract"),
            ]);

            // Ensure data is always an array
            const nextDebtors = Array.isArray(debtorData) ? debtorData : [];
            const nextClaims = Array.isArray(claimData) ? claimData : [];
            const nextBorderos = Array.isArray(borderoData) ? borderoData : [];
            const nextNotas = Array.isArray(notaData) ? notaData : [];
            const nextBatches = Array.isArray(batchData) ? batchData : [];
            const nextSubrogations = Array.isArray(subrogationData)
                ? subrogationData
                : [];
            const nextPayments = Array.isArray(paymentData) ? paymentData : [];
            const nextContracts = Array.isArray(contractData)
                ? contractData
                : [];

            setDebtors(nextDebtors);
            setClaims(nextClaims);
            setBorderos(nextBorderos);
            setNotas(nextNotas);
            setBatches(nextBatches);
            setSubrogations(nextSubrogations);
            setPayments(nextPayments);
            setContracts(nextContracts);

            // Calculate stats
            const approved = nextDebtors.filter(
                (d) => d.status === "APPROVED",
            ).length;
            const pending = nextDebtors.filter(
                (d) => d.status === "SUBMITTED" || d.status === "DRAFT",
            ).length;
            const rejected = nextDebtors.filter(
                (d) => d.status === "REJECTED",
            ).length;

            const totalExposure = nextDebtors.reduce(
                (sum, d) => sum + (parseFloat(d.plafon) || 0),
                0,
            );
            const approvedDebtorsList = nextDebtors.filter(
                (d) => (d?.status || "").toUpperCase() === "APPROVED",
            );

            const totalApprovedPremium = approvedDebtorsList.reduce(
                (sum, d) =>
                    sum +
                    toNumber(
                        d?.net_premi ?? d?.net_premium ?? d?.netPremi ?? 0,
                    ),
                0,
            );

            // Calculate total premium from approved batches
            const totalBatchPremium = nextBatches
                .filter((b) => b.status === "Approved")
                .reduce(
                    (sum, b) => sum + (parseFloat(b.final_premium_amount) || 0),
                    0,
                );

            const totalClaimValue = nextClaims.reduce(
                (sum, c) => sum + (parseFloat(c.nilai_klaim) || 0),
                0,
            );
            const claimsPaid = nextClaims
                .filter((c) => c.status === "Paid")
                .reduce((sum, c) => sum + (parseFloat(c.nilai_klaim) || 0), 0);

            // Calculate total payments from payments table
            const totalPayments = nextPayments
                .filter((p) => p.is_actual_payment)
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            const lossRatio =
                totalApprovedPremium > 0
                    ? (claimsPaid / totalApprovedPremium) * 100
                    : 0;

            // Calculate outstanding recovery from subrogations
            const osRecovery = nextSubrogations
                .filter((s) => s.status !== "Closed")
                .reduce(
                    (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                    0,
                );

            // Count notas by status
            const issuedNotas = nextNotas.filter(
                (n) => n.status === "Issued",
            ).length;
            const paidNotas = nextNotas.filter(
                (n) => n.status === "Paid",
            ).length;

            // Calculate total premium from issued notas
            const totalNotaPremium = nextNotas
                .filter((n) => n.status === "Issued" || n.status === "Paid")
                .reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);

            setStats({
                totalDebtors: nextDebtors.length,
                approvedDebtors: approved,
                pendingDebtors: pending,
                rejectedDebtors: rejected,
                totalExposure,
                totalPremium: totalApprovedPremium,
                totalClaims: nextClaims.length,
                claimsPaid,
                osRecovery,
                lossRatio: Number(lossRatio.toFixed(1)),
                totalPayments,
                issuedNotas,
                paidNotas,
                totalNotaPremium,
            });
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
            setDebtors([]);
            setClaims([]);
            setBorderos([]);
            setNotas([]);
            setBatches([]);
            setSubrogations([]);
            setPayments([]);
            setContracts([]);
        }
        setLoading(false);
    };

    // Chart data - ensure debtors is always an array
    const debtorsArray = Array.isArray(debtors) ? debtors : [];
    const claimsArray = Array.isArray(claims) ? claims : [];
    const subrogationsArray = Array.isArray(subrogations) ? subrogations : [];
    const batchesArray = Array.isArray(batches) ? batches : [];
    const notasArray = Array.isArray(notas) ? notas : [];

    const debtorStatusData = [
        {
            name: "Submitted",
            value: debtorsArray.filter((d) => d.status === "SUBMITTED").length,
            color: "#3b82f6",
        },
        {
            name: "Approved",
            value: debtorsArray.filter((d) => d.status === "APPROVED").length,
            color: "#10b981",
        },
        {
            name: "Rejected",
            value: debtorsArray.filter((d) => d.status === "REJECTED").length,
            color: "#ef4444",
        },
        {
            name: "Draft",
            value: debtorsArray.filter((d) => d.status === "DRAFT").length,
            color: "#f59e0b",
        },
    ].filter((d) => d.value > 0);

    const generateMonthlyTrendData = () => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

        // Calculate premium per month from batches
        const monthlyPremium = months.map((month, index) => {
            const monthBatches = batchesArray.filter((b) => {
                const batchDate = b.createdAt || b.approved_date;
                if (!batchDate) return false;
                const date = new Date(batchDate);
                return date.getMonth() === index;
            });

            const premium = monthBatches.reduce(
                (sum, b) => sum + (parseFloat(b.final_premium_amount) || 0),
                0,
            );

            const claimsForMonth = claimsArray.filter((c) => {
                const claimDate = c.dol || c.createdAt;
                if (!claimDate) return false;
                const date = new Date(claimDate);
                return date.getMonth() === index;
            });

            const claims = claimsForMonth.reduce(
                (sum, c) => sum + (parseFloat(c.nilai_klaim) || 0),
                0,
            );

            const recoveryForMonth = subrogationsArray.filter((s) => {
                const recoveryDate = s.recovery_date || s.createdAt;
                if (!recoveryDate) return false;
                const date = new Date(recoveryDate);
                return date.getMonth() === index;
            });

            const recovery = recoveryForMonth.reduce(
                (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                0,
            );

            const lossRatio = premium > 0 ? (claims / premium) * 100 : 0;

            return {
                month,
                premium: premium || 0,
                claims: claims || 0,
                lossRatio: Number(lossRatio.toFixed(1)),
                recovery: recovery || 0,
            };
        });

        return monthlyPremium;
    };

    const monthlyTrendData = generateMonthlyTrendData();

    const normalizeBatchStatus = (status) =>
        (status ?? "").toString().trim().toLowerCase();

    const getBatchPremiumAmount = (batch) => {
        const finalPremium = Number(batch?.final_premium_amount);
        if (!Number.isNaN(finalPremium) && finalPremium) return finalPremium;
        const totalPremium = Number(batch?.total_premium);
        if (!Number.isNaN(totalPremium) && totalPremium) return totalPremium;
        return 0;
    };

    // Note: Batch workflow statuses include "Matched", "Nota Issued", "Branch Confirmed", "Paid", "Closed".
    // Previously, the chart only counted "Approved" and a non-existent "Submitted", which often resulted in empty data.
    const premiumByStatusBuckets = batchesArray.reduce(
        (acc, batch) => {
            const status = normalizeBatchStatus(batch?.status);
            const amount = getBatchPremiumAmount(batch);

            const approvedStatuses = [
                "approved",
                "nota issued",
                "branch confirmed",
                "paid",
                "closed",
            ];
            const pendingStatuses = [
                "uploaded",
                "validated",
                "matched",
                "reopen requested",
                "reopened",
            ];

            if (approvedStatuses.includes(status)) acc.approved += amount;
            else if (status === "rejected") acc.rejected += amount;
            else if (pendingStatuses.includes(status)) acc.pending += amount;
            else acc.other += amount;

            return acc;
        },
        { approved: 0, pending: 0, rejected: 0, other: 0 },
    );

    const premiumByStatusData = [
        {
            name: "Approved",
            value: premiumByStatusBuckets.approved,
            color: "#10B981",
        },
        {
            name: "Pending",
            value: premiumByStatusBuckets.pending,
            color: "#F59E0B",
        },
        {
            name: "Rejected",
            value: premiumByStatusBuckets.rejected,
            color: "#EF4444",
        },
        {
            name: "Other",
            value: premiumByStatusBuckets.other,
            color: "#6B7280",
        },
    ].filter((d) => d.value > 0);

    // Subrogation data from actual subrogations
    const subrogationData = [
        {
            status: "Pending",
            amount: subrogationsArray
                .filter((s) => s.status === "Draft" || s.status === "Submitted")
                .reduce(
                    (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                    0,
                ),
            count: subrogationsArray.filter(
                (s) => s.status === "Draft" || s.status === "Submitted",
            ).length,
        },
        {
            status: "In Progress",
            amount: subrogationsArray
                .filter(
                    (s) =>
                        s.status === "In Progress" || s.status === "Processing",
                )
                .reduce(
                    (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                    0,
                ),
            count: subrogationsArray.filter(
                (s) => s.status === "In Progress" || s.status === "Processing",
            ).length,
        },
        {
            status: "Recovered",
            amount: subrogationsArray
                .filter(
                    (s) => s.status === "Recovered" || s.status === "Completed",
                )
                .reduce(
                    (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                    0,
                ),
            count: subrogationsArray.filter(
                (s) => s.status === "Recovered" || s.status === "Completed",
            ).length,
        },
        {
            status: "Closed",
            amount: subrogationsArray
                .filter((s) => s.status === "Closed")
                .reduce(
                    (sum, s) => sum + (parseFloat(s.recovery_amount) || 0),
                    0,
                ),
            count: subrogationsArray.filter((s) => s.status === "Closed")
                .length,
        },
    ].filter((d) => d.count > 0);

    // Claim status data
    const claimStatusData = [
        {
            name: "Draft",
            value: claimsArray.filter((c) => c.status === "Draft").length,
        },
        {
            name: "Checked",
            value: claimsArray.filter((c) => c.status === "Checked").length,
        },
        {
            name: "Doc Verified",
            value: claimsArray.filter((c) => c.status === "Doc Verified")
                .length,
        },
        {
            name: "Invoiced",
            value: claimsArray.filter((c) => c.status === "Invoiced").length,
        },
        {
            name: "Paid",
            value: claimsArray.filter((c) => c.status === "Paid").length,
        },
    ].filter((d) => d.value > 0);

    // Batch status data
    const batchStatusData = [
        {
            name: "Uploaded",
            value: batchesArray.filter((b) => b.status === "Uploaded").length,
        },
        {
            name: "Validated",
            value: batchesArray.filter((b) => b.status === "Validated").length,
        },
        {
            name: "Submitted",
            value: batchesArray.filter((b) => b.status === "Submitted").length,
        },
        {
            name: "Approved",
            value: batchesArray.filter((b) => b.status === "Approved").length,
        },
        {
            name: "Rejected",
            value: batchesArray.filter((b) => b.status === "Rejected").length,
        },
    ].filter((d) => d.value > 0);

    // Nota status data
    const notaStatusData = [
        {
            name: "Draft",
            value: notasArray.filter((n) => n.status === "Draft").length,
        },
        {
            name: "Issued",
            value: notasArray.filter((n) => n.status === "Issued").length,
        },
        {
            name: "Confirmed",
            value: notasArray.filter((n) => n.status === "Confirmed").length,
        },
        {
            name: "Paid",
            value: notasArray.filter((n) => n.status === "Paid").length,
        },
    ].filter((d) => d.value > 0);

    const formatCurrency = (value) => {
        const numValue = parseFloat(value) || 0;
        if (numValue >= 1000000000)
            return `${(numValue / 1000000000).toFixed(1)}B`;
        if (numValue >= 1000000) return `${(numValue / 1000000).toFixed(1)}M`;
        if (numValue >= 1000) return `${(numValue / 1000).toFixed(1)}K`;
        return numValue.toLocaleString();
    };

    const getFilteredData = () => {
        return debtorsArray.filter((d) => {
            if (filters.batch !== "all" && d.batch_id !== filters.batch)
                return false;
            if (
                filters.submitStatus !== "all" &&
                d.status !== filters.submitStatus
            )
                return false;
            return true;
        });
    };

    const handleExportData = () => {
        const data = getFilteredData();
        const csv = [
            [
                "ID",
                "Nama Peserta",
                "Batch ID",
                "Plafond",
                "Net Premium",
                "Status",
            ].join(","),
            ...data.map((d) =>
                [
                    d.id,
                    d.nama_peserta,
                    d.batch_id,
                    d.plafon || 0,
                    d.net_premi || 0,
                    d.status,
                ].join(","),
            ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Dashboard Analytics
                    </h1>
                    <p className="text-gray-500">Credit Reinsurance Overview</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025-03">March 2025</SelectItem>
                            <SelectItem value="2025-02">
                                February 2025
                            </SelectItem>
                            <SelectItem value="2025-01">
                                January 2025
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.batch}
                        onValueChange={(v) =>
                            setFilters({ ...filters, batch: v })
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Batches" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Batches</SelectItem>
                            {[...new Set(debtorsArray.map((d) => d.batch_id))]
                                .filter(Boolean)
                                .map((batch) => (
                                    <SelectItem key={batch} value={batch}>
                                        {batch.slice(0, 20)}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        onClick={loadDashboardData}
                        disabled={loading}
                    >
                        <RefreshCw
                            className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleExportData}
                        disabled={debtorsArray.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ModernKPI
                    title="Total Exposure"
                    value={formatRupiahAdaptive(stats.totalExposure)}
                    subtitle={`${stats.approvedDebtors} approved debtors`}
                    icon={TrendingUp}
                    color="blue"
                />
                <ModernKPI
                    title="Total Premium"
                    value={formatRupiahAdaptive(stats.totalPremium)}
                    subtitle="Net premium collected"
                    icon={DollarSign}
                    color="green"
                />
                <ModernKPI
                    title="Claims Paid"
                    value={formatRupiahAdaptive(stats.claimsPaid)}
                    subtitle={`${claimsArray.filter((c) => c.status === "Paid").length} claims settled`}
                    icon={FileText}
                    color="orange"
                />
                <ModernKPI
                    title="Loss Ratio"
                    value={`${stats.lossRatio}%`}
                    subtitle="Claims vs Premium"
                    icon={BarChart3}
                    color="purple"
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ModernKPI
                    title="Total Debtors"
                    value={stats.totalDebtors}
                    icon={Users}
                    color="blue"
                />
                <ModernKPI
                    title="Pending Approval"
                    value={stats.pendingDebtors}
                    subtitle="Awaiting review"
                    icon={Clock}
                    color="orange"
                />
                <ModernKPI
                    title="OS Recovery"
                    value={formatRupiahAdaptive(stats.osRecovery)}
                    icon={AlertTriangle}
                    color="red"
                />
                <ModernKPI
                    title="Total Claims"
                    value={stats.totalClaims}
                    icon={FileText}
                    color="purple"
                />
            </div>

            {/* Charts Row 1 - Debtor & Premium Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Debtor Status Pie Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-gray-500" />
                            Debtor Status Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={debtorStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, value }) =>
                                            `${name}: ${value}`
                                        }
                                    >
                                        {debtorStatusData.map(
                                            (entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                />
                                            ),
                                        )}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 mt-4">
                            {debtorStatusData.map((entry, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm text-gray-600">
                                        {entry.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Premium by Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-gray-500" />
                            Premium by Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            {premiumByStatusData.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <p className="text-sm text-gray-500 text-center">
                                        No premium data to display for the selected
                                        period.
                                    </p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={premiumByStatusData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={({ value }) =>
                                                `${formatRupiahAdaptive(value)}`
                                            }
                                        >
                                            {premiumByStatusData.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.color}
                                                    />
                                                ),
                                            )}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value) =>
                                                `${formatRupiahAdaptive(value)}`
                                            }
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 mt-4">
                            {premiumByStatusData.map((entry, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2"
                                >
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm text-gray-600">
                                        {entry.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 - Loss Ratio & Claims Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Loss Ratio Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-gray-500" />
                            Loss Ratio Trend (%)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyTrendData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        domain={[0, 30]}
                                    />
                                    <Tooltip
                                        formatter={(value) => `${value}%`}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="lossRatio"
                                        stroke="#8B5CF6"
                                        strokeWidth={3}
                                        name="Loss Ratio %"
                                        dot={{ fill: "#8B5CF6", r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                                <span className="font-semibold text-purple-700">
                                    Current Loss Ratio: {stats.lossRatio}%
                                </span>
                                <span className="text-gray-500 ml-2">
                                    (Industry average: ~20-25%)
                                </span>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Premium vs Claims Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-gray-500" />
                            Premium vs Claims Paid
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyTrendData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        tickFormatter={formatRupiahAdaptive}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            `${formatRupiahAdaptive(value)}`
                                        }
                                    />
                                    <Legend />
                                    <Bar
                                        dataKey="premium"
                                        fill="#3B82F6"
                                        name="Premium"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="claims"
                                        fill="#EF4444"
                                        name="Claims Paid"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 3 - Recovery & Subrogation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Outstanding Recovery Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-gray-500" />
                            Outstanding Recovery Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrendData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        tickFormatter={formatRupiahAdaptive}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            formatRupiahAdaptive(value)
                                        }
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="recovery"
                                        stroke="#F59E0B"
                                        fill="#F59E0B"
                                        fillOpacity={0.4}
                                        name="Recovery Amount"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                            <p className="text-sm">
                                <span className="font-semibold text-orange-700">
                                    Total OS Recovery: {formatRupiahAdaptive(stats.osRecovery)}
                                </span>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Subrogation Status */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-gray-500" />
                            Subrogation by Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={subrogationData}
                                    layout="horizontal"
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        type="category"
                                        dataKey="status"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        type="number"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        tickFormatter={formatRupiahAdaptive}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            `${formatRupiahAdaptive(value)}`
                                        }
                                    />
                                    <Bar
                                        dataKey="amount"
                                        fill="#10B981"
                                        name="Recovery Amount"
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {subrogationData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    COLORS[
                                                        index % COLORS.length
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {subrogationData.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="p-2 bg-gray-50 rounded-lg"
                                >
                                    <p className="text-xs text-gray-500">
                                        {item.status}
                                    </p>
                                    <p className="text-sm font-semibold">
                                        {item.count} cases
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Claims Status Summary Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" />
                        Claims Summary by Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {claimStatusData.map((status, idx) => (
                            <div
                                key={idx}
                                className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{
                                            backgroundColor:
                                                COLORS[idx % COLORS.length],
                                        }}
                                    />
                                    <span className="text-2xl font-bold">
                                        {status.value}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {status.name}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {(
                                        (status.value /
                                            (claimsArray.length || 1)) *
                                        100
                                    ).toFixed(1)}
                                    % of total
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6">
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={claimStatusData}
                                    layout="vertical"
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        type="number"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        width={100}
                                    />
                                    <Tooltip />
                                    <Bar
                                        dataKey="value"
                                        fill="#3B82F6"
                                        radius={[0, 4, 4, 0]}
                                    >
                                        {claimStatusData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={
                                                    COLORS[
                                                        index % COLORS.length
                                                    ]
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
