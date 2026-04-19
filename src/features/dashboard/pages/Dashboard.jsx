import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, FileText, DollarSign, AlertTriangle, TrendingUp, Clock, BarChart3, PieChart, Download, RefreshCw } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, CartesianGrid } from "recharts";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import { formatRupiahAdaptive } from "@/utils/currency";
import { DASHBOARD_COLORS, formatCurrencyShort } from "../utils/dashboardConstants";
import { useDashboardData } from "../hooks/useDashboardData";

export default function Dashboard() {
    const { period, setPeriod, filters, setFilters, loading, stats, rawData, reload, debtorStatusData, contractStatusData, premiumByStatusData, claimStatusData, subrogationChartData, monthlyTrendData, batchIds } = useDashboardData();
    const { debtors, claims } = rawData;

    const handleExport = () => {
        const filtered = debtors.filter((d) => filters.batch === "all" || d.batch_id === filters.batch);
        const csv = [["ID", "Nama Peserta", "Batch ID", "Plafond", "Net Premium", "Status"].join(","), ...filtered.map((d) => [d.id, d.nama_peserta, d.batch_id, d.plafon || 0, d.net_premi || 0, d.status].join(","))].join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = `dashboard-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
                    <p className="text-gray-500">Credit Reinsurance Overview</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2025-03">March 2025</SelectItem>
                            <SelectItem value="2025-02">February 2025</SelectItem>
                            <SelectItem value="2025-01">January 2025</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filters.batch} onValueChange={(v) => setFilters({ ...filters, batch: v })}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="All Batches" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Batches</SelectItem>
                            {batchIds.map((b) => <SelectItem key={b} value={b}>{b.slice(0, 20)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={reload} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
                    <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleExport} disabled={debtors.length === 0}><Download className="w-4 h-4 mr-2" />Export</Button>
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <GradientStatCard title="Total Exposure" value={formatRupiahAdaptive(stats.totalExposure)} subtitle={`${stats.approvedDebtors} approved debtors`} icon={TrendingUp} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Total Gross Premi" value={formatRupiahAdaptive(stats.totalGrossPremi)} subtitle="Sum of PREMIUM (all debtors)" icon={DollarSign} gradient="from-yellow-500 to-yellow-600" />
                <GradientStatCard title="Total Net Premi" value={formatRupiahAdaptive(stats.totalNetPremi)} subtitle="Sum of NET_PREMI (all debtors)" icon={DollarSign} gradient="from-green-500 to-green-600" />
                <GradientStatCard title="Total Premium" value={formatRupiahAdaptive(stats.totalPremium)} subtitle="Net premium (approved debtors)" icon={BarChart3} gradient="from-purple-500 to-purple-600" />
                <GradientStatCard title="Premi Share Tugure" value={formatRupiahAdaptive(stats.totalNetPremi)} subtitle="Sum of NET_PREMI (all debtors)" icon={DollarSign} gradient="from-teal-500 to-teal-600" />
                <GradientStatCard title="Komisi Reas" value={formatRupiahAdaptive(stats.totalKomisiReas)} subtitle="Sum of RIC_AMOUNT (all debtors)" icon={TrendingUp} gradient="from-pink-500 to-pink-600" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard title="Total Debtors" value={stats.totalDebtors} icon={Users} gradient="from-blue-500 to-blue-600" />
                <GradientStatCard title="Debtor Submitted Approval" value={stats.submittedDebtors} subtitle="Awaiting review" icon={Clock} gradient="from-orange-500 to-orange-600" />
                <GradientStatCard title="OS Recovery" value={formatRupiahAdaptive(stats.osRecovery)} icon={AlertTriangle} gradient="from-red-500 to-red-600" />
                <GradientStatCard title="Total Claims" value={stats.totalClaims} icon={FileText} gradient="from-purple-500 to-purple-600" />
            </div>

            {/* Debtor & Premium Pies */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PieChartCard title="Debtor Status Distribution" icon={PieChart} data={debtorStatusData} labelSuffix="Debtors" />
                <PieChartCard title="Premium by Status" icon={DollarSign} data={premiumByStatusData} labelSuffix="" isCurrency formatLabel={formatRupiahAdaptive} />
            </div>

            {/* Contract Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PieChartCard title="Master Contract Status Distribution" icon={PieChart} data={contractStatusData} labelSuffix="Contracts" />
            </div>

            {/* Recovery & Subrogation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-gray-500" />Outstanding Recovery Trend</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                                    <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatRupiahAdaptive} />
                                    <Tooltip formatter={(v) => formatRupiahAdaptive(v)} />
                                    <Legend />
                                    <Area type="monotone" dataKey="recovery" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} name="Recovery Amount" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 p-3 bg-orange-50 rounded-lg"><p className="text-sm font-semibold text-orange-700">Total OS Recovery: {formatRupiahAdaptive(stats.osRecovery)}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-gray-500" />Subrogation by Status</CardTitle></CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={subrogationChartData} layout="horizontal">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis type="category" dataKey="status" tick={{ fontSize: 12 }} stroke="#6B7280" />
                                    <YAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatRupiahAdaptive} />
                                    <Tooltip formatter={(v) => formatRupiahAdaptive(v)} />
                                    <Bar dataKey="amount" fill="#10B981" name="Recovery Amount" radius={[4, 4, 0, 0]}>
                                        {subrogationChartData.map((_, i) => <Cell key={i} fill={DASHBOARD_COLORS[i % DASHBOARD_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {subrogationChartData.map((item, i) => <div key={i} className="p-2 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">{item.status}</p><p className="text-sm font-semibold">{item.count} cases</p></div>)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Trend */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-gray-500" />Monthly Trend Analysis (Premi Reas, Komisi, Claim)</CardTitle></CardHeader>
                <CardContent>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatRupiahAdaptive} />
                                <Tooltip formatter={(v) => formatRupiahAdaptive(v)} />
                                <Legend />
                                <Area type="monotone" dataKey="premium" name="Premi Reas" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.4} />
                                <Area type="monotone" dataKey="komisi" name="Komisi" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} />
                                <Area type="monotone" dataKey="claims" name="Claim" stroke="#EF4444" fill="#EF4444" fillOpacity={0.4} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Claims Summary */}
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-gray-500" />Claims Summary by Status</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {claimStatusData.map((s, i) => (
                            <div key={i} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: DASHBOARD_COLORS[i % DASHBOARD_COLORS.length] }} /><span className="text-2xl font-bold">{s.value}</span></div>
                                <p className="text-sm text-gray-600">{s.name}</p>
                                <p className="text-xs text-gray-400 mt-1">{((s.value / (claims.length || 1)) * 100).toFixed(1)}% of total</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={claimStatusData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#6B7280" width={100} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                                    {claimStatusData.map((_, i) => <Cell key={i} fill={DASHBOARD_COLORS[i % DASHBOARD_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function PieChartCard({ title, icon: Icon, data, labelSuffix, isCurrency = false, formatLabel }) {
    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-gray-500" />{title}</CardTitle></CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="h-56 flex items-center justify-center"><p className="text-sm text-gray-500">No data to display</p></div>
                ) : (
                    <div className="flex flex-row-reverse items-center justify-between gap-4">
                        <div className="h-56 flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={isCurrency ? undefined : undefined}>
                                        {data.map((_, i) => <Cell key={i} fill={_.color || DASHBOARD_COLORS[i % DASHBOARD_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={isCurrency && formatLabel ? (v) => formatLabel(v) : undefined} />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-3 min-w-[140px] border-r pr-4">
                            {data.map((entry, i) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || DASHBOARD_COLORS[i % DASHBOARD_COLORS.length] }} /><span className="text-xs font-semibold text-gray-700 uppercase tracking-tight">{entry.name}</span></div>
                                    <span className="text-sm text-gray-500 pl-4">{isCurrency && formatLabel ? formatLabel(entry.value) : `${entry.value} ${labelSuffix}`}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
