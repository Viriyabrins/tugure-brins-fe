import { useState, useEffect } from "react";
import { DEFAULT_BATCH_FILTER } from "../utils/batchProcessingConstants";
import { batchProcessingService } from "../services/batchProcessingService";

export function useBatchProcessingData() {
    const [batches, setBatches] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(DEFAULT_BATCH_FILTER);
    const [selectedBatches, setSelectedBatches] = useState([]);

    useEffect(() => {
        reload();
    }, []);

    const reload = async () => {
        setLoading(true);
        try {
            const data = await batchProcessingService.loadData();
            setBatches(data.batches);
            setContracts(data.contracts);
            setDebtors(data.debtors);
        } catch {
            setBatches([]);
            setContracts([]);
            setDebtors([]);
        }
        setLoading(false);
    };

    const filteredBatches = batches.filter((b) => {
        if (filters.contract !== "all" && b.contract_id !== filters.contract) return false;
        if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
        if (filters.status !== "all" && b.status !== filters.status) return false;
        if (filters.startDate && b.created_date < filters.startDate) return false;
        if (filters.endDate && b.created_date > filters.endDate) return false;
        return true;
    });

    const toggleBatchSelection = (batchId) => {
        setSelectedBatches((prev) =>
            prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
        );
    };

    const toggleAllSelection = (checked) => {
        setSelectedBatches(checked ? filteredBatches.map((b) => b.batch_id) : []);
    };

    return {
        batches,
        contracts,
        debtors,
        loading,
        filters,
        setFilters,
        filteredBatches,
        selectedBatches,
        setSelectedBatches,
        toggleBatchSelection,
        toggleAllSelection,
        reload,
    };
}
