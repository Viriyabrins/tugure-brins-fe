import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, FileText, RefreshCw, Download, Clock, CreditCard, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { formatRupiahAdaptive } from "@/utils/currency";
import PageHeader from "@/components/common/PageHeader";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { DEFAULT_ADVANCED_FILTER, BATCH_STATUSES, CLAIM_STATUSES, CREDIT_TYPES } from "../utils/advancedReportsConstants";
import { useAdvancedReportsData } from "../hooks/useAdvancedReportsData";

const M = (v) => `Rp ${(v / 1000000).toFixed(2)}M`;

export default function AdvancedReports() {
    const [activeTab, setActiveTab] = useState("loss-ratio");
    const { loading, filters, setFilters, reload, lossRatio, premiumStatus, claimPaid, recovery, subrogation, branches } = useAdvancedReportsData();

    const exportToExcel = (data, filename) => {
        const csv = [Object.keys(data[0] || {}).join(","), ...data.map((row) => Object.values(row).join(","))].join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
    };

    const exportToPDF = async () => {
        const canvas = await html2canvas(document.getElementById("report-content"));
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, (canvas.height * 210) / canvas.width);
        pdf.save(`${activeTab}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    };

    const excelAction = { "loss-ratio": () => exportToExcel(lossRatio.trend, "loss-ratio"), "premium-status": () => exportToExcel(premiumStatus.byStatus, "premium-status"), "claim-paid": () => exportToExcel(claimPaid.statusData, "claim-paid"), subrogation: () => exportToExcel(subrogation.statusData, "subrogation") }[activeTab];

    const ChartCard = ({ title, gradient, from, to, children }) => (
        <Card className="shadow-2xl border-3">
            <CardHeader className={`bg-gradient-to-r ${gradient} text-white border-b-4 border-opacity-70`}><CardTitle className="text-white font-bold text-xl">{title}</CardTitle></CardHeader>
            <CardContent className="pt-6">{children}</CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Advanced Reports"
                subtitle="Executive summary and analytics dashboard"
                breadcrumbs={[{ label: "Dashboard", url: "Dashboard" }, { label: "Advanced Reports" }]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                        {excelAction && <Button variant="outline" onClick={excelAction}><Download className="mr-2 h-4 w-4" />Download Excel</Button>}
                        <Button variant="outline" onClick={exportToPDF}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {activeTab === "loss-ratio" && (<>
                    <GradientStatCard title="Premium Earned" value={formatRupiahAdaptive(lossRatio.premiumEarned)} subtitle="Batch Paid/Closed only" icon={DollarSign} gradient="from-blue-500 to-indigo-600" />
                    <GradientStatCard title="Claim Paid" value={formatRupiahAdaptive(lossRatio.claimPaid)} subtitle="Paid claims only" icon={FileText} gradient="from-red-500 to-red-600" />
                    <GradientStatCard title="Loss Ratio" value={`${lossRatio.lossRatio.toFixed(2)}%`} subtitle={lossRatio.lossRatio < 70 ? "Healthy" : lossRatio.lossRatio < 85 ? "Warning" : "Critical"} icon={lossRatio.lossRatio < 70 ? TrendingDown : TrendingUp} gradient={lossRatio.lossRatio < 70 ? "from-green-500 to-emerald-600" : lossRatio.lossRatio < 85 ? "from-yellow-500 to-orange-600" : "from-red-500 to-red-700"} />
                    <GradientStatCard title="Claim Payment Rate" value={`${lossRatio.claimPaymentRate.toFixed(1)}%`} subtitle="Claims paid vs invoiced" icon={TrendingUp} gradient="from-purple-500 to-purple-600" />
                </>)}
                {activeTab === "premium-status" && (<>
                    <GradientStatCard title="Total Gross Premium" value={formatRupiahAdaptive(premiumStatus.totalGrossPremium)} subtitle="All batches" icon={DollarSign} gradient="from-blue-500 to-indigo-600" />
                    <GradientStatCard title="Net Premium" value={formatRupiahAdaptive(premiumStatus.netPremium)} subtitle="After deductions" icon={CreditCard} gradient="from-green-500 to-emerald-600" />
                    <GradientStatCard title="Paid Premium" value={formatRupiahAdaptive(premiumStatus.paidPremium)} subtitle={`${premiumStatus.paidPercentage.toFixed(1)}% of Gross`} icon={CheckCircle} gradient="from-purple-500 to-purple-600" />
                    <GradientStatCard title="Outstanding Premium" value={formatRupiahAdaptive(premiumStatus.outstandingPremium)} subtitle={`${premiumStatus.outstandingPercentage.toFixed(1)}% of Gross`} icon={Clock} gradient="from-orange-500 to-red-600" />
                </>)}
                {activeTab === "claim-paid" && (<>
                    <GradientStatCard title="Total Claim Paid" value={formatRupiahAdaptive(claimPaid.totalPaid)} subtitle="All paid claims" icon={FileText} gradient="from-red-500 to-red-600" />
                    <GradientStatCard title="Number of Claims Paid" value={claimPaid.count} subtitle="Total paid claims" icon={CheckCircle} gradient="from-green-500 to-emerald-600" />
                    <GradientStatCard title="Claims In Progress" value={claimPaid.inProgress} subtitle="Draft/Checked/Doc Verified" icon={Clock} gradient="from-orange-500 to-orange-600" />
                    <GradientStatCard title="Avg. Settlement Time" value={`${claimPaid.avgSettlementDays} Days`} subtitle="For paid claims" icon={TrendingUp} gradient="from-indigo-500 to-indigo-600" />
                </>)}
                {activeTab === "outstanding-recovery" && (<>
                    <GradientStatCard title="Total Claim Paid" value={formatRupiahAdaptive(recovery.totalClaimPaid)} subtitle="All paid claims" icon={FileText} gradient="from-red-500 to-red-600" />
                    <GradientStatCard title="Total Recovered" value={formatRupiahAdaptive(recovery.totalRecovered)} subtitle="Via subrogation" icon={DollarSign} gradient="from-green-500 to-emerald-600" />
                    <GradientStatCard title="Outstanding Recovery" value={formatRupiahAdaptive(recovery.outstanding)} subtitle="Yet to be recovered" icon={Clock} gradient="from-orange-500 to-red-600" />
                    <GradientStatCard title="Recovery Rate" value={`${((recovery.totalRecovered / (recovery.totalClaimPaid || 1)) * 100).toFixed(1)}%`} subtitle="of claim paid" icon={TrendingUp} gradient="from-indigo-500 to-indigo-600" />
                </>)}
                {activeTab === "subrogation" && (<>
                    <GradientStatCard title="Total Subrogation Amount" value={formatRupiahAdaptive(subrogation.totalAmount)} subtitle="All subrogations" icon={FileText} gradient="from-blue-500 to-indigo-600" />
                    <GradientStatCard title="Total Recovered Amount" value={formatRupiahAdaptive(subrogation.recoveredAmount)} subtitle="Paid / Closed" icon={DollarSign} gradient="from-green-500 to-emerald-600" />
                    <GradientStatCard title="Pending Amount" value={formatRupiahAdaptive(subrogation.pendingAmount)} subtitle="Yet to be recovered" icon={Clock} gradient="from-orange-500 to-red-600" />
                    <GradientStatCard title="Recovery Rate" value={`${subrogation.recoveryRate.toFixed(1)}%`} subtitle="of subrogation amount" icon={TrendingUp} gradient="from-purple-500 to-purple-600" />
                </>)}
            </div>

            <FilterTab filters={filters} onFilterChange={setFilters} defaultFilters={DEFAULT_ADVANCED_FILTER}
                filterConfig={[
                    { key: "period", label: "Period", options: [{ value: "all", label: "All Periods" }, { value: "2024", label: "2024" }, { value: "2025", label: "2025" }, { value: "2026", label: "2026" }] },
                    ...((["loss-ratio", "premium-status"].includes(activeTab)) ? [{ key: "batchStatus", label: "Batch Status", options: [{ value: "all", label: "All Status" }, ...BATCH_STATUSES.map((s) => ({ value: s, label: s }))] }] : []),
                    ...((activeTab === "claim-paid") ? [{ key: "claimStatus", label: "Claim Status", options: [{ value: "all", label: "All Status" }, ...CLAIM_STATUSES.map((s) => ({ value: s, label: s }))] }] : []),
                    { key: "creditType", label: "Credit Type", options: [{ value: "all", label: "All Types" }, ...CREDIT_TYPES.map((t) => ({ value: t, label: t }))] },
                    { key: "branch", label: "Branch", options: [{ value: "all", label: "All Branches" }, ...branches.map((b) => ({ value: b, label: b }))] },
                ]}
            />

            <div id="report-content">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="loss-ratio">Loss Ratio</TabsTrigger>
                        <TabsTrigger value="premium-status">Premium by Status</TabsTrigger>
                        <TabsTrigger value="claim-paid">Claim Paid</TabsTrigger>
                        <TabsTrigger value="outstanding-recovery">Outstanding Recovery</TabsTrigger>
                        <TabsTrigger value="subrogation">Subrogation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="loss-ratio" className="space-y-6">
                        <Card className="shadow-lg"><CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white"><CardTitle className="text-white font-bold">📋 Process Health Summary</CardTitle></CardHeader><CardContent className="pt-4"><div className="grid grid-cols-2 gap-4"><div className="p-3 bg-green-50 rounded-lg border-2 border-green-200"><p className="text-sm text-gray-600">Closed Batches</p><p className="text-2xl font-bold text-green-700">{lossRatio.closedBatches}</p></div><div className="p-3 bg-orange-50 rounded-lg border-2 border-orange-200"><p className="text-sm text-gray-600">Outstanding Batches</p><p className="text-2xl font-bold text-orange-700">{lossRatio.outstandingBatches}</p></div></div></CardContent></Card>
                        <ChartCard title="📊 Claim Movement by Status Over Time" gradient="from-blue-500 to-indigo-600">
                            {loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={350}><AreaChart data={lossRatio.trend}><CartesianGrid strokeDasharray="5 5" stroke="#94A3B8" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip /><Legend /><Area type="monotone" dataKey="Draft" stackId="1" stroke="#94a3b8" fill="#94a3b8" /><Area type="monotone" dataKey="Checked" stackId="1" stroke="#60a5fa" fill="#60a5fa" /><Area type="monotone" dataKey="Doc Verified" stackId="1" stroke="#a78bfa" fill="#a78bfa" /><Area type="monotone" dataKey="Invoiced" stackId="1" stroke="#fbbf24" fill="#fbbf24" /><Area type="monotone" dataKey="Paid" stackId="1" stroke="#10b981" fill="#10b981" /></AreaChart></ResponsiveContainer>}
                        </ChartCard>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartCard title="📈 Loss Ratio by Credit Type" gradient="from-green-500 to-emerald-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={lossRatio.creditTypeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fontSize: 12, fontWeight: 700 }} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => `${v}%`} /><Bar dataKey="lossRatio" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                            <ChartCard title="🏢 Top 10 Loss Ratio by Branch" gradient="from-orange-500 to-red-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={lossRatio.branchData} layout="horizontal"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} /><YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} /><Tooltip formatter={(v) => `${v}%`} /><Bar dataKey="lossRatio" fill="#f59e0b" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                        </div>
                    </TabsContent>

                    <TabsContent value="premium-status" className="space-y-6">
                        <Card className="shadow-lg"><CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 text-white"><CardTitle className="text-white font-bold">⚠️ Bottleneck Analysis</CardTitle></CardHeader><CardContent className="pt-4"><div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200"><p className="text-sm text-gray-600 mb-2">Largest Outstanding Status:</p><p className="text-2xl font-bold text-orange-700">{premiumStatus.bottleneck.status || "N/A"}</p><p className="text-lg font-semibold text-orange-600">Rp {((premiumStatus.bottleneck.amount || 0) / 1000000).toFixed(1)}M</p></div></CardContent></Card>
                        <ChartCard title="📈 Premium by Batch Status Over Time" gradient="from-purple-500 to-pink-600">
                            {loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={350}><AreaChart data={premiumStatus.trend}><CartesianGrid strokeDasharray="5 5" /><XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Legend />{["Uploaded", "Validated", "Matched", "Approved", "Nota Issued", "Branch Confirmed", "Paid", "Closed"].map((k, i) => <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={["#94a3b8","#60a5fa","#818cf8","#a78bfa","#fbbf24","#34d399","#10b981","#059669"][i]} fill={["#94a3b8","#60a5fa","#818cf8","#a78bfa","#fbbf24","#34d399","#10b981","#059669"][i]} name={k} />)}</AreaChart></ResponsiveContainer>}
                        </ChartCard>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartCard title="📊 Premium by Status" gradient="from-indigo-500 to-blue-600">{loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={300}><BarChart data={premiumStatus.byStatus} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} /><YAxis type="category" dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} width={120} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="amount" fill="#6366f1" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                            <ChartCard title="🏢 Top 10 Premium by Branch" gradient="from-green-500 to-emerald-600">{loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={300}><BarChart data={premiumStatus.branchData} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} /><YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="paid" fill="#10b981" name="Paid" stackId="a" /><Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" stackId="a" /></BarChart></ResponsiveContainer>}</ChartCard>
                        </div>
                    </TabsContent>

                    <TabsContent value="claim-paid" className="space-y-6">
                        <ChartCard title="🔄 Claim Lifecycle Movement by Status" gradient="from-green-500 to-emerald-600">
                            {loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={300}><LineChart data={claimPaid.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="Draft" stroke="#94a3b8" strokeWidth={3} /><Line type="monotone" dataKey="Checked" stroke="#60a5fa" strokeWidth={3} /><Line type="monotone" dataKey="Doc Verified" stroke="#a78bfa" strokeWidth={3} /><Line type="monotone" dataKey="Invoiced" stroke="#fbbf24" strokeWidth={3} /><Line type="monotone" dataKey="Paid" stroke="#10b981" strokeWidth={3} /></LineChart></ResponsiveContainer>}
                        </ChartCard>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartCard title="📊 Claim Amount by Status" gradient="from-blue-500 to-indigo-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={claimPaid.statusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                            <ChartCard title="💰 Claim Paid by Product" gradient="from-green-500 to-emerald-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={claimPaid.productData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="product" tick={{ fontSize: 12, fontWeight: 700 }} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                        </div>
                    </TabsContent>

                    <TabsContent value="outstanding-recovery" className="space-y-6">
                        <ChartCard title="📈 Outstanding Recovery Trend Over Time" gradient="from-orange-500 to-red-600">
                            {loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={300}><LineChart data={recovery.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Legend /><Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={4} name="Outstanding" /></LineChart></ResponsiveContainer>}
                        </ChartCard>
                        <ChartCard title="🔄 Outstanding Recovery by Credit Type" gradient="from-red-500 to-pink-600">
                            {loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={recovery.typeData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" tick={{ fontSize: 12, fontWeight: 700 }} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="outstanding" fill="#ef4444" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}
                        </ChartCard>
                    </TabsContent>

                    <TabsContent value="subrogation" className="space-y-6">
                        <ChartCard title="📈 Subrogation Amount by Status Over Time" gradient="from-purple-500 to-indigo-600">
                            {loading ? <Skeleton className="h-80 w-full" /> : <ResponsiveContainer width="100%" height={300}><AreaChart data={subrogation.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Legend /><Area type="monotone" dataKey="Draft" stackId="1" stroke="#fbbf24" fill="#fbbf24" /><Area type="monotone" dataKey="Invoiced" stackId="1" stroke="#60a5fa" fill="#60a5fa" /><Area type="monotone" dataKey="Paid / Closed" stackId="1" stroke="#10b981" fill="#10b981" /></AreaChart></ResponsiveContainer>}
                        </ChartCard>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ChartCard title="⚖️ Subrogation by Status" gradient="from-indigo-500 to-purple-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={subrogation.statusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" tick={{ fontSize: 11, fontWeight: 700 }} angle={-15} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11, fontWeight: 700 }} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="amount" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                            <ChartCard title="🏢 Top 10 Subrogation by Branch" gradient="from-green-500 to-emerald-600">{loading ? <Skeleton className="h-64 w-full" /> : <ResponsiveContainer width="100%" height={250}><BarChart data={subrogation.branchData} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tick={{ fontSize: 11, fontWeight: 700 }} /><YAxis type="category" dataKey="branch" tick={{ fontSize: 10, fontWeight: 700 }} width={100} /><Tooltip formatter={(v) => M(v)} /><Bar dataKey="amount" fill="#10b981" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
