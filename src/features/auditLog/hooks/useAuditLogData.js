import { useState, useEffect, useMemo } from "react";
import { DEFAULT_AUDIT_FILTER } from "../utils/auditLogConstants";
import { loadData as loadAuditLogs } from "../services/auditLogService";

const PAGE_SIZE = 5;

export function useAuditLogData() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_AUDIT_FILTER);
    const [page, setPage] = useState(1);

    const refresh = async () => {
        setLoading(true);
        try {
            const data = await loadAuditLogs();
            setLogs(data);
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        refresh();
    }, []);

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (filters.module !== "all" && log.module !== filters.module)
                return false;
            if (
                filters.user &&
                !log.user_email
                    ?.toLowerCase()
                    .includes(filters.user.toLowerCase())
            )
                return false;
            if (
                filters.action &&
                !log.action
                    ?.toLowerCase()
                    .includes(filters.action.toLowerCase())
            )
                return false;
            return true;
        });
    }, [logs, filters]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [filters.module, filters.user, filters.action]);

    const total = filteredLogs.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, safePage * PAGE_SIZE);
    const pageData = filteredLogs.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE,
    );

    return {
        logs,
        loading,
        filters,
        setFilters,
        filteredLogs,
        page: safePage,
        setPage,
        totalPages,
        from,
        to,
        total,
        pageData,
        refresh,
    };
}
