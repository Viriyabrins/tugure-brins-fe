import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

/**
 * Reusable KPI card component for displaying metrics
 */
export function AdminKPICard({ title, value, icon: Icon, trend, unit = '' }) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-blue-500" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString('id-ID') : value}
            </div>
            {unit && <p className="text-xs text-gray-500 mt-1">{unit}</p>}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
