import keycloakService from '@/services/keycloakService';

const API_BASE = '';

/**
 * Fetch dashboard KPI data
 */
export async function fetchDashboardKPI(startDate = null, endDate = null) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const url = `${API_BASE}/api/admin/dashboard-kpi${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${keycloakService.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch KPI: ${response.status}`);
    }

    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error('Error fetching dashboard KPI:', error);
    throw error;
  }
}

/**
 * Fetch transactions with filtering
 */
export async function fetchTransactions(filters = {}) {
  try {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 50,
    });

    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.userEmail) params.append('userEmail', filters.userEmail);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `${API_BASE}/api/admin/transactions?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${keycloakService.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.status}`);
    }

    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Fetch audit log with filtering
 */
export async function fetchAuditLog(filters = {}) {
  try {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 50,
    });

    if (filters.action) params.append('action', filters.action);
    if (filters.module) params.append('module', filters.module);
    if (filters.userEmail) params.append('userEmail', filters.userEmail);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const url = `${API_BASE}/api/admin/audit-log?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${keycloakService.getToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audit log: ${response.status}`);
    }

    const result = await response.json();
    return result.data || {};
  } catch (error) {
    console.error('Error fetching audit log:', error);
    throw error;
  }
}
