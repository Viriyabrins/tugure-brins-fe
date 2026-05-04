import { useState, useEffect } from 'react';
import {
  fetchDashboardKPI,
  fetchTransactions,
  fetchAuditLog,
} from '../services/adminDashboardService';

/**
 * Hook to manage admin dashboard data loading
 */
export function useAdminDashboardData() {
  const [kpiData, setKpiData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [transactionFilters, setTransactionFilters] = useState({
    page: 1,
    limit: 50,
    entityType: null,
    userEmail: null,
    status: null,
    startDate: null,
    endDate: null,
  });

  const [auditFilters, setAuditFilters] = useState({
    page: 1,
    limit: 50,
    action: null,
    module: null,
    userEmail: null,
    startDate: null,
    endDate: null,
  });

  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });

  /**
   * Load KPI data
   */
  const loadKPI = async (start = null, end = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardKPI(start, end);
      setKpiData(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load KPI:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load transactions
   */
  const loadTransactions = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const finalFilters = { ...transactionFilters, ...filters };
      const data = await fetchTransactions(finalFilters);
      setTransactions(data.transactions || []);
      setTransactionFilters(finalFilters);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load audit log
   */
  const loadAuditLog = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const finalFilters = { ...auditFilters, ...filters };
      const data = await fetchAuditLog(finalFilters);
      setAuditLog(data.logs || []);
      setAuditFilters(finalFilters);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh all data
   */
  const refreshAll = async () => {
    const start = dateRange.startDate || undefined;
    const end = dateRange.endDate || undefined;
    await Promise.all([
      loadKPI(start, end),
      loadTransactions({ ...transactionFilters, startDate: start, endDate: end }),
      loadAuditLog({ ...auditFilters, startDate: start, endDate: end }),
    ]);
  };

  // Initial load
  useEffect(() => {
    refreshAll();
  }, []);

  return {
    // Data
    kpiData,
    transactions,
    auditLog,
    loading,
    error,

    // Filters
    transactionFilters,
    auditFilters,
    dateRange,
    setTransactionFilters,
    setAuditFilters,
    setDateRange,

    // Actions
    loadKPI,
    loadTransactions,
    loadAuditLog,
    refreshAll,
  };
}
