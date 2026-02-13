import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * FilterTab - A reusable filter bar component.
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter state object, e.g. { status: "all", contract: "all" }
 * @param {Function} props.onFilterChange - Callback receiving the updated filters object
 * @param {Object} props.defaultFilters - Default/reset values for all filters, e.g. { status: "all", contract: "all" }
 * @param {Array} props.filterConfig - Array of filter definitions, each with:
 *   - key: string        — the key in the filters object
 *   - placeholder: string — placeholder text for the select/input trigger
 *   - type: "select" | "input" (default: "select")
 *   - options: Array<{ value: string, label: string }> — for select type
 *   - inputType: string  — for input type, e.g. "text", "date" (default: "text")
 * @param {number} [props.columns] - Number of grid columns (default: filterConfig.length)
 * @param {string} [props.className] - Additional className for the outer Card
 */
export default function FilterTab({
  filters,
  onFilterChange,
  defaultFilters,
  filterConfig = [],
  columns,
  className = "",
}) {
  const gridCols = columns || filterConfig.length;
  
  // Calculate active filters count
  const activeFilters = Object.entries(filters).filter(([_, v]) => v && v !== 'all').length;

  const handleSelectChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleInputChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  const handleDateRangeChange = (key, field, value) => {
    const current = filters[key] || {};
    onFilterChange({
      ...filters,
      [key]: { ...current, [field]: value}
    });
  };

  const handleDateChange = (key, date) => {
    onFilterChange({ ...filters, [key]: date ? date.toISOString().split('T')[0] : "" });
  };

  const handleClear = () => {
    if (defaultFilters) {
      onFilterChange(defaultFilters);
    }
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {/* Header Section with Badge and Clear Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-700">Filters</span>
            {activeFilters > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">
                {activeFilters} active
              </Badge>
            )}
          </div>
          {activeFilters > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClear}
              className="h-8 px-2 text-gray-500 hover:text-gray-900"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Filter Grid */}
        <div
          className={`grid grid-cols-1 gap-4`}
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          }}
        >
          {filterConfig.map((filter) => {
            // Enhanced Date Picker (Calendar Popover)
            if (filter.type === 'date' || filter.inputType === 'date') {
              const dateValue = filters[filter.key];
              return (
                <div key={filter.key}>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">{filter.placeholder}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !dateValue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateValue ? new Date(dateValue).toLocaleDateString() : filter.placeholder || 'Select Date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateValue ? new Date(dateValue) : undefined}
                        onSelect={(d) => handleDateChange(filter.key, d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              );
            }

            // Input type (Text or legacy inputs)
            if (filter.type === "input") {
              return (
                <div key={filter.key}>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">{filter.placeholder}</label>
                  <Input
                    type={filter.inputType || "text"}
                    placeholder={filter.placeholder}
                    value={filters[filter.key] || ""}
                    onChange={(e) =>
                      handleInputChange(filter.key, e.target.value)
                    }
                    className="h-9"
                  />
                </div>
              );
            }

            // Date Range Type (Keep existing)
            if (filter.type === "dateRange") {
              return (
                <div key={filter.key} className="flex gap-2">
                  <div className="flex-1">
                     <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
                     <Input
                      type="date"
                      value={filters[filter.key]?.from || ""}
                      onChange={(e) =>
                        handleDateRangeChange(filter.key, "from", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
                    <Input
                      type="date"
                      value={filters[filter.key]?.to || ""}
                      onChange={(e) =>
                        handleDateRangeChange(filter.key, "to", e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              );
            }

            // Default: Select
            return (
              <div key={filter.key}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">{filter.placeholder}</label>
                <Select
                  value={filters[filter.key]}
                  onValueChange={(val) => handleSelectChange(filter.key, val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={filter.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {(filter.options || []).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
