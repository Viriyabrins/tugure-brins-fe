import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatRupiahAdaptive } from "@/utils/currency";

/**
 * Trend analysis chart extracted from ClaimSubmit.
 *
 * Props:
 *   allClaimsForTrend {Array}   — all Claim records (unfiltered)
 *   batches           {Array}   — Batch records (for month/year labels)
 *   isBrinsUser       {boolean}
 */
export function ClaimTrendTab({ allClaimsForTrend, batches, isBrinsUser }) {
    const batchMap = {};
    if (Array.isArray(batches)) {
        batches.forEach((b) => {
            batchMap[b.batch_id] = {
                batch_month: b.batch_month,
                batch_year: b.batch_year,
            };
        });
    }

    const monthNames = [
        "Jan","Feb","Mar","Apr","May","Jun",
        "Jul","Aug","Sep","Oct","Nov","Dec",
    ];

    const monthMap = {};
    if (Array.isArray(allClaimsForTrend)) {
        allClaimsForTrend.forEach((claim) => {
            const bInfo = batchMap[claim.batch_id];
            if (!bInfo || !bInfo.batch_month || !bInfo.batch_year) return;
            const key = `${bInfo.batch_year}-${String(bInfo.batch_month).padStart(2, "0")}`;
            if (!monthMap[key]) {
                monthMap[key] = {
                    sortKey: key,
                    label: `${monthNames[(bInfo.batch_month - 1) % 12]} ${bInfo.batch_year}`,
                    nilai_klaim: 0,
                    share_tugure_amount: 0,
                };
            }
            monthMap[key].nilai_klaim += Number(claim.nilai_klaim) || 0;
            monthMap[key].share_tugure_amount +=
                Number(claim.share_tugure_amount) || 0;
        });
    }

    const trendData = Object.values(monthMap).sort((a, b) =>
        a.sortKey.localeCompare(b.sortKey),
    );

    const toB = (v) => (v / 1_000_000_000).toFixed(2);

    const totalKlaim = Array.isArray(allClaimsForTrend)
        ? allClaimsForTrend.reduce(
              (s, c) => s + (Number(c.nilai_klaim) || 0),
              0,
          )
        : 0;

    const totalShare = Array.isArray(allClaimsForTrend)
        ? allClaimsForTrend.reduce(
              (s, c) => s + (Number(c.share_tugure_amount) || 0),
              0,
          )
        : 0;

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length) return null;
        return (
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                <p className="font-semibold text-gray-700 mb-1">{label}</p>
                {payload.map((entry) => (
                    <p key={entry.dataKey} style={{ color: entry.color }}>
                        {entry.name}:{" "}
                        <span className="font-medium">
                            {formatRupiahAdaptive(
                                entry.value * 1_000_000_000,
                            )}
                        </span>
                    </p>
                ))}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    Trend Analysis
                </CardTitle>
                <p className="text-sm text-gray-500">
                    {isBrinsUser ? "Recovery" : "Claim"} value trend by batch
                    period
                </p>
            </CardHeader>
            <CardContent>
                {trendData.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                        No data available for trend analysis
                    </div>
                ) : (
                    <>
                        <div className="flex gap-6 mb-4 flex-wrap">
                            <div
                                style={{ backgroundColor: "#1D4E32" }}
                                className="rounded-lg px-4 py-2"
                            >
                                <p className="text-xs text-green-100">
                                    Total{" "}
                                    {isBrinsUser ? "Recovery" : "Claim"} Value
                                </p>
                                <p className="text-lg font-semibold text-white">
                                    {formatRupiahAdaptive(totalKlaim)}
                                </p>
                            </div>
                            <div
                                style={{ backgroundColor: "#0D9488" }}
                                className="rounded-lg px-4 py-2"
                            >
                                <p className="text-xs text-teal-100">
                                    Total Share Tugure Amount
                                </p>
                                <p className="text-lg font-semibold text-white">
                                    {formatRupiahAdaptive(totalShare)}
                                </p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                                <p className="text-xs text-gray-500">
                                    Periods
                                </p>
                                <p className="text-lg font-semibold text-gray-700">
                                    {trendData.length}
                                </p>
                            </div>
                        </div>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={trendData.map((d) => ({
                                        ...d,
                                        nilai_klaim_b: parseFloat(
                                            toB(d.nilai_klaim),
                                        ),
                                        share_tugure_b: parseFloat(
                                            toB(d.share_tugure_amount),
                                        ),
                                    }))}
                                    margin={{
                                        top: 10,
                                        right: 30,
                                        left: 10,
                                        bottom: 10,
                                    }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#E5E7EB"
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        stroke="#6B7280"
                                        tickFormatter={(v) =>
                                            formatRupiahAdaptive(
                                                v * 1_000_000_000,
                                            )
                                        }
                                        label={{
                                            value: "IDR",
                                            angle: -90,
                                            position: "insideLeft",
                                            offset: 10,
                                            style: {
                                                fontSize: 11,
                                                fill: "#6B7280",
                                            },
                                        }}
                                    />
                                    <Tooltip content={CustomTooltip} />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="nilai_klaim_b"
                                        stroke="#1D4E32"
                                        strokeWidth={3}
                                        name={
                                            isBrinsUser
                                                ? "Recovery Value (Annual)"
                                                : "Nilai Klaim (Annual)"
                                        }
                                        dot={{ fill: "#1D4E32", r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="share_tugure_b"
                                        stroke="#0D9488"
                                        strokeWidth={3}
                                        name="Share Tugure Amount (Annual)"
                                        dot={{ fill: "#0D9488", r: 5 }}
                                        activeDot={{ r: 7 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
