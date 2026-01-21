import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Filter, X, Download, FileSpreadsheet, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FilterPanel({ 
  filters, 
  onFilterChange, 
  onClear, 
  onExport,
  contracts = [],
  showExport = true 
}) {
  const activeFilters = Object.entries(filters).filter(([_, v]) => v && v !== 'all').length;

  return (
    <div className="bg-white rounded-xl border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700">Filters</span>
          {activeFilters > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {activeFilters} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          {showExport && onExport && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onExport('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onExport('csv')}>
                  <FileText className="w-4 h-4 mr-2" />
                  CSV
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onExport('pdf')}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {contracts.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Contract</label>
            <Select 
              value={filters.contract || 'all'} 
              onValueChange={(v) => onFilterChange('contract', v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Contracts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Batch</label>
          <Input 
            placeholder="Batch ID" 
            className="h-9"
            value={filters.batch || ''} 
            onChange={(e) => onFilterChange('batch', e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-9 justify-start text-left font-normal",
                  !filters.startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? new Date(filters.startDate).toLocaleDateString() : 'Select'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.startDate ? new Date(filters.startDate) : undefined}
                onSelect={(d) => onFilterChange('startDate', d?.toISOString().split('T')[0])}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-9 justify-start text-left font-normal",
                  !filters.endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? new Date(filters.endDate).toLocaleDateString() : 'Select'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={filters.endDate ? new Date(filters.endDate) : undefined}
                onSelect={(d) => onFilterChange('endDate', d?.toISOString().split('T')[0])}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Submit Status</label>
          <Select 
            value={filters.submitStatus || 'all'} 
            onValueChange={(v) => onFilterChange('submitStatus', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Recon Status</label>
          <Select 
            value={filters.reconStatus || 'all'} 
            onValueChange={(v) => onFilterChange('reconStatus', v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="EXCEPTION">Exception</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}