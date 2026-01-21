import React from 'react';
import { Card } from "@/components/ui/card";
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ModernKPI({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'blue',
  className 
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-emerald-500 to-teal-600',
    orange: 'from-orange-500 to-amber-600',
    purple: 'from-purple-500 to-fuchsia-600',
    red: 'from-red-500 to-rose-600',
    teal: 'from-teal-500 to-cyan-600',
    pink: 'from-pink-500 to-rose-600'
  };

  const iconBgClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    teal: 'bg-teal-100 text-teal-600',
    pink: 'bg-pink-100 text-pink-600'
  };

  return (
    <Card className={cn("overflow-hidden relative", className)}>
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", colorClasses[color])} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-3 rounded-xl", iconBgClasses[color])}>
              <Icon className="w-6 h-6" />
            </div>
          )}
        </div>
        
        {trend && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            {trend > 0 ? (
              <>
                <div className="flex items-center gap-1 text-emerald-600">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-semibold">{Math.abs(trend)}%</span>
                </div>
                <span className="text-xs text-gray-500">vs last period</span>
              </>
            ) : trend < 0 ? (
              <>
                <div className="flex items-center gap-1 text-red-600">
                  <ArrowDown className="w-4 h-4" />
                  <span className="text-sm font-semibold">{Math.abs(trend)}%</span>
                </div>
                <span className="text-xs text-gray-500">vs last period</span>
              </>
            ) : (
              <span className="text-xs text-gray-500">No change</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}