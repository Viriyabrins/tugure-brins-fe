import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ExportButton({ data, filename = 'export', format = 'excel', variant = "outline", className = "" }) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }

    if (format === 'excel' || format === 'csv') {
      // Convert data to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Handle values with commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      // For PDF, you might want to use a library like jsPDF
      alert('PDF export feature coming soon');
    }
  };

  return (
    <Button 
      variant={variant} 
      onClick={handleExport}
      className={className}
    >
      <Download className="w-4 h-4 mr-2" />
      Export {format.toUpperCase()}
    </Button>
  );
}