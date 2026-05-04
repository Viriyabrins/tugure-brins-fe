import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Transaction table component displaying all transactions
 */
export function TransactionTable({ transactions, loading, pagination, onPageChange }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">No transactions found</div>
      </div>
    );
  }

  const getStatusBadgeColor = (status) => {
    const statusLower = String(status || '').toLowerCase();
    if (statusLower.includes('approved')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('revision')) return 'bg-yellow-100 text-yellow-800';
    if (statusLower.includes('draft')) return 'bg-gray-100 text-gray-800';
    if (statusLower.includes('uploaded')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (value) => {
    if (!value) return 'Rp 0';
    const num = parseFloat(value);
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Type</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={`${tx.type}-${tx.id}`} className="hover:bg-gray-50">
                <TableCell className="font-medium text-sm">
                  <Badge variant="outline">{tx.type}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm truncate max-w-xs">{tx.id}</TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeColor(tx.status)}>
                    {tx.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {tx.type === 'Batch' && formatCurrency(tx.totalPremium)}
                  {tx.type === 'Debtor' && formatCurrency(tx.netPremi)}
                  {tx.type === 'Claim' && formatCurrency(tx.nilaiKlaim)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">{tx.user || '-'}</TableCell>
                <TableCell className="text-sm text-gray-500">
                  {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('id-ID') : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
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
