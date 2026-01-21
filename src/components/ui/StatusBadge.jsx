import React from 'react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors = {
  // Debtor Status
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  CONDITIONAL: 'bg-orange-100 text-orange-700 border-orange-200',
  TERMINATED: 'bg-gray-200 text-gray-600 border-gray-300',
  
  // Admin Status
  COMPLETE: 'bg-green-100 text-green-700 border-green-200',
  INCOMPLETE: 'bg-red-100 text-red-700 border-red-200',
  EXPIRED: 'bg-orange-100 text-orange-700 border-orange-200',
  WAIVED: 'bg-blue-100 text-blue-700 border-blue-200',
  
  // Exposure Status
  ACTIVE: 'bg-green-100 text-green-700 border-green-200',
  HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  ADJUSTED: 'bg-blue-100 text-blue-700 border-blue-200',
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  
  // Bordero Status
  GENERATED: 'bg-blue-100 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  FINAL: 'bg-green-100 text-green-700 border-green-200',
  
  // Invoice Status
  ISSUED: 'bg-blue-100 text-blue-700 border-blue-200',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-700 border-orange-200',
  PAID: 'bg-green-100 text-green-700 border-green-200',
  OVERDUE: 'bg-red-100 text-red-700 border-red-200',
  
  // Payment Status
  RECEIVED: 'bg-blue-100 text-blue-700 border-blue-200',
  MATCHED: 'bg-green-100 text-green-700 border-green-200',
  PARTIALLY_MATCHED: 'bg-orange-100 text-orange-700 border-orange-200',
  UNMATCHED: 'bg-red-100 text-red-700 border-red-200',
  
  // Reconciliation Status
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  EXCEPTION: 'bg-orange-100 text-orange-700 border-orange-200',
  READY_TO_CLOSE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CLOSED: 'bg-green-100 text-green-700 border-green-200',
  
  // Claim Status
  ON_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  PARTIALLY_APPROVED: 'bg-teal-100 text-teal-700 border-teal-200',
  SETTLED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  
  // Eligibility Status
  ELIGIBLE: 'bg-green-100 text-green-700 border-green-200',
  NOT_ELIGIBLE: 'bg-red-100 text-red-700 border-red-200',
  
  // Payment Intent
  CANCELLED: 'bg-gray-200 text-gray-600 border-gray-300',
  
  // General
  SUCCESS: 'bg-green-100 text-green-700 border-green-200',
  ERROR: 'bg-red-100 text-red-700 border-red-200',
  WARNING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  INFO: 'bg-blue-100 text-blue-700 border-blue-200'
};

export default function StatusBadge({ status, className }) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const displayText = status?.replace(/_/g, ' ') || 'Unknown';
  
  return (
    <Badge 
      variant="outline" 
      className={cn('font-medium border', colorClass, className)}
    >
      {displayText}
    </Badge>
  );
}