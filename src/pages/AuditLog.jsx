import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    Calendar as CalendarIcon,
    Filter,
    Download,
    RefreshCw,
    User,
    FileText,
    Eye,
    Search,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import GradientStatCard from "@/components/dashboard/GradientStatCard";
import FilterTab from "@/components/common/FilterTab";

const defaultFilter = {
    contract: "all",
    batch: "",
    submitStatus: "all",
    status: "all",
    startDate: "",
    endDate: "",
    module: "all",
};

export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(defaultFilter);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load AuditLog from backend API (database)
            let data = await backend.list("AuditLog");

            // Filter out any logs with sibernetik email
            if (data && data.length > 0) {
                data = data.filter(
                    (log) =>
                        !log.user_email?.includes("sibernetik") &&
                        !log.user_email?.includes("@system"),
                );
            }

            setLogs(data || []);
        } catch (error) {
            console.error("Failed to load audit logs:", error);
        }
        setLoading(false);
    };

    const handleExport = () => {
        const csv = [
            [
                "Reason",
                "User",
                "Role",
                "Module",
                "Action",
                "Entity Type",
                "Entity ID",
            ].join(","),
            ...filteredLogs.map((log) =>
                [
                    (log.reason || "").replace(/\n/g, " ").replace(/,/g, " "),
                    log.user_email,
                    log.user_role,
                    log.module,
                    log.action,
                    log.entity_type,
                    log.entity_id,
                ].join(","),
            ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
    };

    const filteredLogs = logs.filter((log) => {
        if (filters.module !== "all" && log.module !== filters.module)
            return false;
        if (
            filters.user &&
            !log.user_email?.toLowerCase().includes(filters.user.toLowerCase())
        )
            return false;
        if (
            filters.action &&
            !log.action?.toLowerCase().includes(filters.action.toLowerCase())
        )
            return false;
        // AuditLog does not have reliable timestamps in this schema, skip date filtering
        return true;
    });

    // Pagination state
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const total = filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    const pageData = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

    // Keep page within bounds when filtered set changes
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages]);

    // Reset to first page when filters change
    useEffect(() => {
        setPage(1);
    }, [filters.module, filters.user, filters.action]);

    // Detail dialog state
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedLogId, setSelectedLogId] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);

    const openDetail = async (id) => {
        setSelectedLogId(id);
        setShowDetailDialog(true);
        setDetailLoading(true);
        try {
            const record = await backend.get("AuditLog", id);
            console.debug("AuditLog fetched detail", id, record);
            setSelectedLog(record || null);
        } catch (e) {
            console.error("Failed to load audit log detail", e);
            setSelectedLog(null);
        }
        setDetailLoading(false);
    };

    const getActionColor = (action) => {
        if (action?.includes("CREATE") || action?.includes("SUBMIT"))
            return "bg-blue-100 text-blue-700 border-blue-200";
        if (action?.includes("APPROVE") || action?.includes("SUCCESS"))
            return "bg-green-100 text-green-700 border-green-200";
        if (action?.includes("DEBTOR_REVISION"))
            return "bg-yellow-100 text-yellow-700 border-yellow-200";
        if (action?.includes("REJECT") || action?.includes("DELETE"))
            return "bg-red-100 text-red-700 border-red-200";
        if (action?.includes("UPDATE") || action?.includes("MATCH"))
            return "bg-orange-100 text-orange-700 border-orange-200";
        return "bg-gray-100 text-gray-700 border-gray-200";
    };

    const columns = [
        {
            header: "Reason",
            cell: (row) => (
                <div className="text-sm max-w-[36rem]">
                    <p
                        className="font-medium text-ellipsis overflow-hidden whitespace-nowrap"
                        title={row.reason}
                    >
                        {(row.reason || "").slice(0, 120)}
                        {(row.reason || "").length > 120 ? "…" : ""}
                    </p>
                </div>
            ),
            width: "40%",
        },
        {
            header: "User",
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                        <p className="font-medium text-sm">{row.user_email}</p>
                        <Badge variant="outline" className="text-xs">
                            {row.user_role}
                        </Badge>
                    </div>
                </div>
            ),
        },
        {
            header: "Module",
            cell: (row) => <Badge variant="outline">{row.module}</Badge>,
        },
        {
            header: "Action",
            cell: (row) => (
                <Badge variant="outline" className={getActionColor(row.action)}>
                    {row.action}
                </Badge>
            ),
        },
        {
            header: "Entity",
            cell: (row) => (
                <div className="text-sm">
                    <p className="font-medium">{row.entity_type}</p>
                    <p className="text-gray-500 text-xs font-mono">
                        {row.entity_id?.slice(0, 12)}
                    </p>
                </div>
            ),
        },
        {
            header: "Changes",
            cell: (row) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        openDetail(row.id);
                    }}
                >
                    <Eye className="w-4 h-4" />
                </Button>
            ),
            width: "80px",
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Audit Log"
                subtitle="System activity and change tracking"
                breadcrumbs={[
                    { label: "Dashboard", url: "Dashboard" },
                    { label: "Audit Log" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={loadData}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                }
            />

            {/* Gradient Stat Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GradientStatCard
                    title="Total Logs"
                    value={logs.length}
                    subtitle="All recorded activities"
                    icon={Shield}
                    gradient="from-blue-500 to-blue-600"
                />
                <GradientStatCard
                    title="Filtered Results"
                    value={filteredLogs.length}
                    subtitle="Filtered audit logs count"
                    icon={Filter}
                    gradient="from-green-500 to-green-600"
                />
                <GradientStatCard
                    title="Unique Users"
                    value={new Set(logs.map((l) => l.user_email)).size}
                    subtitle="Number of unique users"
                    icon={User}
                    gradient="from-purple-500 to-purple-600"
                />
                <GradientStatCard
                    title="Page Count"
                    value={pageData.length}
                    subtitle="Rows on current page"
                    icon={FileText}
                    gradient="from-orange-500 to-orange-600"
                />
            </div>

            {/* Filters */}
            <FilterTab
                filters={filters}
                onFilterChange={setFilters}
                defaultFilters={defaultFilter}
                filterConfig={[
                    {
                        key: "user",
                        placeholder: "Search user...",
                        label: "User",
                        icon: Search,
                        type: "input",
                    },
                    {
                        key: "module",
                        label: "Module",
                        icon: Filter,
                        options: [
                            { value: "all", label: "All Modules" },
                            { value: "AUTH", label: "Authentication" },
                            { value: "DEBTOR", label: "Debtor" },
                            { value: "BORDERO", label: "Bordero" },
                            { value: "PAYMENT", label: "Payment" },
                            {
                                value: "RECONCILIATION",
                                label: "Reconciliation",
                            },
                            { value: "CLAIM", label: "Claim" },
                            { value: "CONFIG", label: "Configuration" },
                        ],
                    },
                    {
                        key: "startDate",
                        placeholder: "Start Date",
                        label: "Start Date",
                        type: "date",
                    },
                    {
                        key: "endDate",
                        placeholder: "End Date",
                        label: "End Date",
                        type: "date",
                    },
                ]}
            />

            {/* Audit Log Table */}
            <DataTable
                columns={columns}
                data={pageData}
                isLoading={loading}
                emptyMessage="No audit logs found"
                pagination={{ from, to, total, page, totalPages }}
                onPageChange={(p) => {
                    setPage(p);
                }}
            />

            <Dialog
                open={showDetailDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowDetailDialog(false);
                        setSelectedLog(null);
                        setSelectedLogId(null);
                    }
                }}
            >
                <DialogContent className="max-w-3xl p-8">
                    <DialogHeader className="mb-2">
                        <DialogTitle>Audit Log Detail</DialogTitle>
                        <DialogDescription>
                            Details for audit record {selectedLogId}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        {detailLoading ? (
                            <p>Loading...</p>
                        ) : selectedLog ? (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <strong>Action:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">{selectedLog.action || "-"}</pre>
                                </div>
                                <div>
                                    <strong>Module:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">{selectedLog.module || "-"}</pre>
                                </div>

                                <div>
                                    <strong>Entity Type:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">{selectedLog.entity_type || "-"}</pre>
                                </div>
                                <div>
                                    <strong>Entity ID:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">{selectedLog.entity_id || "-"}</pre>
                                </div>

                                <div>
                                    <strong>User:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">{(selectedLog.user_email ? `${selectedLog.user_email}${selectedLog.user_role ? ` (${selectedLog.user_role})` : ''}` : '-')}</pre>
                                </div>

                                <div className="col-span-1">
                                    <strong>Old Value:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">
                                        {selectedLog.old_value || "-"}
                                    </pre>
                                </div>
                                <div className="col-span-1">
                                    <strong>New Value:</strong>
                                    <pre className="whitespace-pre-wrap break-words bg-gray-100 p-3 mt-1 text-sm rounded-lg">
                                        {selectedLog.new_value || "-"}
                                    </pre>
                                </div>

                                <div className="col-span-2 mt-4">
                                    <strong className="block text-sm mb-2">
                                        Reason:
                                    </strong>
                                    <div className="bg-gray-100 p-4 text-lg leading-relaxed whitespace-pre-wrap break-words rounded-lg">
                                        {selectedLog.reason || "-"}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No details available
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setShowDetailDialog(false);
                                setSelectedLog(null);
                                setSelectedLogId(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
