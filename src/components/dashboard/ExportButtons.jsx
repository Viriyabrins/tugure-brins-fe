import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ExportButtons({ onExport }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport('excel')}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Export to Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('pdf')}>
          <FileText className="w-4 h-4 mr-2 text-red-600" />
          Export to PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}