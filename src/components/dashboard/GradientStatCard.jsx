import React from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function GradientStatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  gradient, 
  textColor = "text-white",
  subtitleColor = "text-white/80"
}) {
  return (
    <Card className={`bg-gradient-to-br ${gradient} text-white overflow-hidden relative border-none shadow-md transition-all hover:shadow-lg hover:scale-[1.01]`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="z-10 relative">
            <p className={`${subtitleColor} text-sm font-medium mb-1`}>{title}</p>
            <h3 className="text-xl font-bold">{value}</h3>
            {subtitle && (
              <p className={`${subtitleColor} text-xs mt-2`}>{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center z-10 relative backdrop-blur-sm">
              <Icon className={`w-6 h-6 ${textColor}`} />
            </div>
          )}
        </div>
      </CardContent>
      {/* Decorative shape */}
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-tl-full pointer-events-none"></div>
    </Card>
  );
}
