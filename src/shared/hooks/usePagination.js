import { useState } from "react";

/**
 * Manages pagination state and exposes pre-computed props for DataTable.
 *
 * Usage:
 *   const { page, total, setTotal, pageSize, goToPage, reset, paginationProps } = usePagination();
 *   <DataTable pagination={paginationProps} onPageChange={goToPage} />
 */
export function usePagination({ pageSize = 10 } = {}) {
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const reset = () => setPage(1);
    const goToPage = (p) => setPage(p);

    const paginationProps = {
        from: total === 0 ? 0 : (page - 1) * pageSize + 1,
        to: Math.min(total, page * pageSize),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };

    return { page, total, setTotal, pageSize, reset, goToPage, paginationProps };
}
