import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, className, gradient }) {
  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg ${className || ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl text-gray-900">{value}</h3>
              {trend && (
                <span className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'} flex items-center gap-1`}>
                  {trend > 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
            {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
          </div>
          {Icon && gradient && (
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${className} flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          )}
          {Icon && !gradient && (
            <Icon className="w-8 h-8 text-gray-400" />
          )}
        </div>
      </CardContent>
      {gradient && (
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${className}`} />
      )}
    </Card>
  );
}