import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

/**
 * Audit log viewer component displaying activity history
 */
export function AuditLogViewer({ logs, loading, pagination, onPageChange }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading audit log...</div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">No audit logs found</div>
      </div>
    );
  }

  const getActionBadgeColor = (action) => {
    const actionLower = String(action || '').toLowerCase();
    if (actionLower.includes('create')) return 'bg-green-100 text-green-800';
    if (actionLower.includes('update')) return 'bg-blue-100 text-blue-800';
    if (actionLower.includes('delete')) return 'bg-red-100 text-red-800';
    if (actionLower.includes('approve')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {logs.map((log) => (
          <div
            key={log.id}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <Badge className={getActionBadgeColor(log.action)}>
                  {log.action}
                </Badge>
                <Badge variant="outline">{log.module}</Badge>
                {log.entityType && (
                  <Badge variant="secondary">{log.entityType}</Badge>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {log.timestamp ? new Date(log.timestamp).toLocaleString('id-ID') : '-'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
              <div>
                <span className="text-gray-600">User:</span>
                <span className="font-mono text-gray-900 ml-2">{log.user || '-'}</span>
              </div>
              <div>
                <span className="text-gray-600">Role:</span>
                <span className="font-mono text-gray-900 ml-2">{log.role || '-'}</span>
              </div>
            </div>

            {log.entityId && (
              <div className="text-sm mb-2">
                <span className="text-gray-600">Entity ID:</span>
                <span className="font-mono text-gray-900 ml-2 break-all">{log.entityId}</span>
              </div>
            )}

            {log.reason && (
              <div className="text-sm bg-blue-50 border border-blue-100 rounded p-2 mb-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-blue-900">{log.reason}</span>
              </div>
            )}

            {(log.oldValue || log.newValue) && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                  View Changes
                </summary>
                <div className="mt-2 space-y-2 ml-4">
                  {log.oldValue && (
                    <div className="p-2 bg-red-50 border border-red-100 rounded font-mono text-xs">
                      <div className="text-red-600 font-semibold mb-1">Previous:</div>
                      <pre className="whitespace-pre-wrap text-red-700 overflow-x-auto">
                        {JSON.stringify(log.oldValue, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.newValue && (
                    <div className="p-2 bg-green-50 border border-green-100 rounded font-mono text-xs">
                      <div className="text-green-600 font-semibold mb-1">Current:</div>
                      <pre className="whitespace-pre-wrap text-green-700 overflow-x-auto">
                        {JSON.stringify(log.newValue, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)} (Total: {pagination.total})
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
