import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DollarSign, FileText, Users, BarChart3, TrendingUp, CheckCircle2, XCircle } from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import FilterTab from "@/components/common/FilterTab";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import { MONTHS, DEFAULT_RECAP_FILTER, DEFAULT_TSI_FILTER, aggregateDebtorsByBatch } from "../utils/recapSummaryConstants";
import { useRecapSummaryData } from "../hooks/useRecapSummaryData";
import { ClaimTrendTab } from "@/features/claims/components/ClaimTrendTab";
import { useUserTenant } from "@/shared/hooks/useUserTenant";

function DebtorTsiSection({ title, gradient, debtors = [], loading }) {
    const totalCount = debtors.length;
    const totalPlafon = debtors.reduce((s, d) => s + (parseFloat(d.plafon) || 0), 0);
    const totalNominalPremi = debtors.reduce((s, d) => s + (parseFloat(d.nominal_premi) || 0), 0);
    const totalNetPremi = debtors.reduce((s, d) => s + (parseFloat(d.net_premi) || 0), 0);
    const totalKomisi = debtors.reduce((s, d) => s + (parseFloat(d.ric_amount) || 0), 0);
    const totalNominalKomisiBroker = debtors.reduce((s, d) => s + (parseFloat(d.bf_amount) || 0), 0);
    const batchRows = useMemo(() => aggregateDebtorsByBatch(debtors), [debtors]);
    const icon = title === "Active Debtors" ? CheckCircle2 : title === "Non-Active Debtors" ? XCircle : Users;

    return (
        <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className={`bg-gradient-to-r ${gradient} py-4 px-6`}>
                <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                    {React.createElement(icon, { className: "w-5 h-5" })}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                {["Batch ID", "Count", "Plafon", "Nominal Premi", "Net Premi", "Komisi", "Komisi Broker"].map((h) => (
                                    <th key={h} className={`px-4 py-3 font-semibold text-gray-600 whitespace-nowrap ${h === "Batch ID" ? "text-left" : "text-right"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(4)].map((_, i) => (
                                    <tr key={i} className="border-b border-gray-100">{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                                ))
                            ) : batchRows.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No debtors in this category</p></td></tr>
                            ) : (
                                <>
                                    {batchRows.map((row, i) => (
                                        <tr key={row.batch_id} className={`border-b border-gray-100 transition-colors hover:bg-indigo-50/40 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                                            <td className="px-4 py-3 font-medium text-indigo-700 whitespace-nowrap">{row.batch_id}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{row.count.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.plafon)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.nominal_premi)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.net_premi)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.komisi)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.nominal_komisi_broker)}</td>
                                        </tr>
                                    ))}
                                    <tr className={`bg-gradient-to-r ${gradient} text-white font-semibold`}>
                                        <td className="px-4 py-3.5 whitespace-nowrap">Grand Total</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{totalCount.toLocaleString()}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(totalPlafon)}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(totalNominalPremi)}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(totalNetPremi)}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(totalKomisi)}</td>
                                        <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(totalNominalKomisiBroker)}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

export default function RecapSummary() {
    const [activeTab, setActiveTab] = useState("debtor-batch");
    const { loading, filters, setFilters, tsiFilters, setTsiFilters, filteredRows, grandTotal, tsiYearOptions, yearFilteredDebtors, activeDebtors, nonActiveDebtors, claims, batches } = useRecapSummaryData();
    const { isBrinsUser } = useUserTenant();

    const totalPremium = filteredRows.reduce((s, r) => s + r.premium_idr, 0);
    const totalClaimAmt = filteredRows.reduce((s, r) => s + r.claim_idr, 0);
    const totalClaimsCount = filteredRows.reduce((s, r) => s + r.total_claim, 0);

    return (
        <div className="space-y-6">
            <PageHeader title="Recap Summary" subtitle="Aggregated recap report per batch" breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Recap Summary" }]} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <GradientStatCard title="Total Batches" value={filteredRows.length.toLocaleString()} subtitle="Filtered batches" icon={BarChart3} gradient="from-blue-500 to-indigo-600" />
                <GradientStatCard title="Total Debtors" value={filteredRows.reduce((s, r) => s + r.total_debtors, 0).toLocaleString()} subtitle="Across all batches" icon={Users} gradient="from-emerald-500 to-green-600" />
                <GradientStatCard title="Total Premium" value={formatRupiahAdaptive(totalPremium)} subtitle="Gross premium IDR" icon={DollarSign} gradient="from-purple-500 to-purple-600" />
                <GradientStatCard title="Total Claim" value={formatRupiahAdaptive(totalClaimAmt)} subtitle={`${totalClaimsCount.toLocaleString()} claim records`} icon={FileText} gradient="from-orange-500 to-red-600" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-100 p-1 rounded-lg">
                    <TabsTrigger value="debtor-batch" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6">Debtor Batch</TabsTrigger>
                    <TabsTrigger value="recap-tsi" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6">Recap TSI</TabsTrigger>
                    <TabsTrigger value="claim-trend" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-6">
                        <TrendingUp className="w-4 h-4 mr-2" />Claim Trend
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="debtor-batch" className="space-y-4 mt-4">
                    <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_RECAP_FILTER} columns={2}
                        filterConfig={[
                            { key: "month", label: "Month", type: "select", options: [{ value: "all", label: "All Months" }, ...MONTHS] },
                            { key: "batchId", label: "Batch ID", type: "input", inputType: "text", placeholder: "Search Batch ID…" },
                        ]}
                    />
                    <Card className="shadow-sm overflow-hidden border-0">
                        <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 py-4 px-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white text-base font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5" />Debtor Batch Recap</CardTitle>
                                {!loading && <Badge className="bg-white/20 text-white border-0 text-xs">{filteredRows.length} batch{filteredRows.length !== 1 ? "es" : ""}</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            {["Batch ID", "Total Debtor", "Premium_IDR", "COMM_IDR", "Total_IDR", "Total Claim", "Claim_IDR"].map((h) => (
                                                <th key={h} className={`px-4 py-3 font-semibold text-gray-600 whitespace-nowrap ${h === "Batch ID" ? "text-left" : "text-right"}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            [...Array(6)].map((_, i) => <tr key={i} className="border-b border-gray-100">{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
                                        ) : filteredRows.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-16 text-gray-400"><BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No recap data available</p></td></tr>
                                        ) : (
                                            <>
                                                {filteredRows.map((row, i) => (
                                                    <tr key={row.id} className={`border-b border-gray-100 transition-colors hover:bg-indigo-50/40 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                                                        <td className="px-4 py-3 font-medium text-indigo-700 whitespace-nowrap">{row.batch_id}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{row.total_debtors.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.premium_idr)}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.comm_idr)}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{formatRupiahAdaptive(row.total_idr)}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums"><span className={`inline-flex items-center justify-end gap-1 ${row.total_claim > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>{row.total_claim > 0 && <TrendingUp className="w-3 h-3" />}{row.total_claim.toLocaleString()}</span></td>
                                                        <td className="px-4 py-3 text-right tabular-nums"><span className={row.claim_idr > 0 ? "text-red-600 font-medium" : "text-gray-400"}>{formatRupiahAdaptive(row.claim_idr)}</span></td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold">
                                                    <td className="px-4 py-3.5 whitespace-nowrap">Grand Total</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{grandTotal.total_debtors.toLocaleString()}</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(grandTotal.premium_idr)}</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(grandTotal.comm_idr)}</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(grandTotal.total_idr)}</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{grandTotal.total_claim.toLocaleString()}</td>
                                                    <td className="px-4 py-3.5 text-right tabular-nums">{formatRupiahAdaptive(grandTotal.claim_idr)}</td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="recap-tsi" className="space-y-6 mt-4">
                    <FilterTab filters={tsiFilters} onFilterChange={setTsiFilters} defaultFilters={DEFAULT_TSI_FILTER} columns={1}
                        filterConfig={[{ key: "year", label: "Year", type: "select", options: [{ value: "all", label: "All Years" }, ...tsiYearOptions] }]}
                    />
                    <DebtorTsiSection title="All Debtors" gradient="from-indigo-500 to-blue-600" debtors={yearFilteredDebtors} loading={loading} />
                    <DebtorTsiSection title="Active Debtors" gradient="from-emerald-500 to-green-600" debtors={activeDebtors} loading={loading} />
                    <DebtorTsiSection title="Non-Active Debtors" gradient="from-orange-500 to-red-600" debtors={nonActiveDebtors} loading={loading} />
                </TabsContent>

                <TabsContent value="claim-trend" className="mt-4">
                    <ClaimTrendTab
                        allClaimsForTrend={claims}
                        batches={batches}
                        isBrinsUser={isBrinsUser}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
