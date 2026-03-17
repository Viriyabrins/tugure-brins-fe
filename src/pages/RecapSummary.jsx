import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    DollarSign,
    FileText,
    Users,
    BarChart3,
    TrendingUp,
} from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import { backend } from "@/api/backendClient";
import PageHeader from "../components/common/PageHeader";
import FilterTab from "@/components/common/FilterTab";
import GradientStatCard from "@/components/dashboard/GradientStatCard";

const MONTHS = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

const defaultFilter = { month: "all", batchId: "" };

export default function RecapSummary() {
    const [activeTab, setActiveTab] = useState("debtor-batch");
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState([]);
    const [claims, setClaims] = useState([]);
    const [filters, setFilters] = useState(defaultFilter);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [batchData, claimData] = await Promise.all([
                backend.list("Batch"),
                backend.list("Claim"),
            ]);
            setBatches(Array.isArray(batchData) ? batchData : []);
            setClaims(Array.isArray(claimData) ? claimData : []);
        } catch (error) {
            console.error("Failed to load recap data:", error);
        }
        setLoading(false);
    };

    // Aggregate recap data per batch
    const recapRows = useMemo(() => {
        return batches.map((b) => {
            const batchClaims = claims.filter((c) => c.batch_id === b.batch_id);
            const premium = parseFloat(b.total_premium) || 0;
            const comm = parseFloat(b.commission) || 0;
            const finalAmt = premium - comm || 0;
            const claimAmt = batchClaims.reduce(
                (s, c) => s + (parseFloat(c.share_tugure_amount) || 0),
                0,
            );
            return {
                id: b.batch_id,
                batch_id: b.batch_id,
                batch_month: b.batch_month,
                batch_year: b.batch_year,
                total_debtors: b.total_records || 0,
                premium_idr: premium,
                comm_idr: comm,
                total_idr: finalAmt,
                total_claim: batchClaims.length,
                claim_idr: claimAmt,
            };
        });
    }, [batches, claims]);

    // Apply filters (auto — no search button)
    const filteredRows = useMemo(() => {
        return recapRows.filter((row) => {
            if (
                filters.month !== "all" &&
                String(row.batch_month) !== String(filters.month)
            )
                return false;
            if (
                filters.batchId &&
                !row.batch_id
                    .toLowerCase()
                    .includes(filters.batchId.toLowerCase())
            )
                return false;
            return true;
        });
    }, [recapRows, filters]);

    // Summary KPI values (reactive to filtered data)
    const totalBatches = filteredRows.length;
    const totalDebtors = filteredRows.reduce((s, r) => s + r.total_debtors, 0);
    const totalPremium = filteredRows.reduce((s, r) => s + r.premium_idr, 0);
    const totalClaimAmt = filteredRows.reduce((s, r) => s + r.claim_idr, 0);
    const totalClaimsCount = filteredRows.reduce(
        (s, r) => s + r.total_claim,
        0,
    );

    // Grand total row
    const grandTotal = useMemo(
        () => ({
            total_debtors: filteredRows.reduce(
                (s, r) => s + r.total_debtors,
                0,
            ),
            premium_idr: filteredRows.reduce((s, r) => s + r.premium_idr, 0),
            comm_idr: filteredRows.reduce((s, r) => s + r.comm_idr, 0),
            total_idr: filteredRows.reduce((s, r) => s + r.total_idr, 0),
            total_claim: filteredRows.reduce((s, r) => s + r.total_claim, 0),
            claim_idr: filteredRows.reduce((s, r) => s + r.claim_idr, 0),
        }),
        [filteredRows],
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Recap Summary"
                subtitle="Aggregated recap report per batch"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Recap Summary" },
                ]}
            />

            {/* GradientStatCard — reactive to filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Total Batches"
                    value={totalBatches.toLocaleString()}
                    subtitle="Filtered batches"
                    icon={BarChart3}
                    gradient="from-blue-500 to-indigo-600"
                />
                <GradientStatCard
                    title="Total Debtors"
                    value={totalDebtors.toLocaleString()}
                    subtitle="Across all batches"
                    icon={Users}
                    gradient="from-emerald-500 to-green-600"
                />
                <GradientStatCard
                    title="Total Premium"
                    value={formatRupiahAdaptive(totalPremium)}
                    subtitle="Gross premium IDR"
                    icon={DollarSign}
                    gradient="from-purple-500 to-purple-600"
                />
                <GradientStatCard
                    title="Total Claim"
                    value={formatRupiahAdaptive(totalClaimAmt)}
                    subtitle={`${totalClaimsCount.toLocaleString()} claim records`}
                    icon={FileText}
                    gradient="from-orange-500 to-red-600"
                />
            </div>

            {/* Tab Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger
                        value="debtor-batch"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6"
                    >
                        Debtor Batch
                    </TabsTrigger>
                    <TabsTrigger
                        value="recap-tsi"
                        className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6"
                    >
                        Recap TSI
                    </TabsTrigger>
                </TabsList>

                {/* ── Debtor Batch Tab ── */}
                <TabsContent value="debtor-batch" className="space-y-4 mt-4">
                    <FilterTab
                        filters={filters}
                        onFilterChange={setFilters}
                        defaultFilters={defaultFilter}
                        columns={2}
                        filterConfig={[
                            {
                                key: "month",
                                label: "Month",
                                type: "select",
                                options: [
                                    { value: "all", label: "All Months" },
                                    ...MONTHS,
                                ],
                            },
                            {
                                key: "batchId",
                                label: "Batch ID",
                                type: "input",
                                inputType: "text",
                                placeholder: "Search Batch ID…",
                            },
                        ]}
                    />

                    {/* Rich Table */}
                    <Card className="shadow-sm overflow-hidden border-0">
                        <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 py-4 px-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    Debtor Batch Recap
                                </CardTitle>
                                {!loading && (
                                    <Badge className="bg-white/20 text-white border-0 text-xs">
                                        {filteredRows.length} batch
                                        {filteredRows.length !== 1 ? "es" : ""}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Batch ID
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Total Debtor
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Premium_IDR
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                COMM_IDR
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Total_IDR
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Total Claim
                                            </th>
                                            <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                                                Claim_IDR
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            [...Array(6)].map((_, i) => (
                                                <tr
                                                    key={i}
                                                    className="border-b border-gray-100"
                                                >
                                                    {[...Array(7)].map(
                                                        (_, j) => (
                                                            <td
                                                                key={j}
                                                                className="px-4 py-3"
                                                            >
                                                                <Skeleton className="h-4 w-full" />
                                                            </td>
                                                        ),
                                                    )}
                                                </tr>
                                            ))
                                        ) : filteredRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="text-center py-16 text-gray-400"
                                                >
                                                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm">
                                                        No recap data available
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map((row, i) => (
                                                <tr
                                                    key={row.id}
                                                    className={`border-b border-gray-100 transition-colors hover:bg-indigo-50/40 ${
                                                        i % 2 === 0
                                                            ? "bg-white"
                                                            : "bg-gray-50/60"
                                                    }`}
                                                >
                                                    <td className="px-4 py-3 font-medium text-indigo-700 whitespace-nowrap">
                                                        {row.batch_id}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                                        {row.total_debtors.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            row.premium_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            row.comm_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            row.total_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        <span
                                                            className={`inline-flex items-center justify-end gap-1 ${row.total_claim > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}
                                                        >
                                                            {row.total_claim >
                                                                0 && (
                                                                <TrendingUp className="w-3 h-3" />
                                                            )}
                                                            {row.total_claim.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums">
                                                        <span
                                                            className={
                                                                row.claim_idr >
                                                                0
                                                                    ? "text-red-600 font-medium"
                                                                    : "text-gray-400"
                                                            }
                                                        >
                                                            {formatRupiahAdaptive(
                                                                row.claim_idr,
                                                            )}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}

                                        {/* Grand Total row */}
                                        {!loading &&
                                            filteredRows.length > 0 && (
                                                <tr className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold">
                                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                                        Grand Total
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {grandTotal.total_debtors.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            grandTotal.premium_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            grandTotal.comm_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            grandTotal.total_idr,
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {grandTotal.total_claim.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">
                                                        {formatRupiahAdaptive(
                                                            grandTotal.claim_idr,
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Recap TSI Tab (placeholder) ── */}
                <TabsContent value="recap-tsi" className="mt-4">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="flex items-center justify-center py-24 text-gray-400">
                            <div className="text-center space-y-2">
                                <BarChart3 className="w-12 h-12 mx-auto opacity-40" />
                                <p className="text-lg font-medium text-gray-500">
                                    Recap TSI
                                </p>
                                <p className="text-sm text-gray-400">
                                    Content coming soon
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
