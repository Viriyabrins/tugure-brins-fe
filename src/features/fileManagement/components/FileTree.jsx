/**
 * FileTree Component
 * Displays expandable tree of batches and records with lazy-loaded files
 */

import React from 'react';
import { ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * FileTree - Hierarchical tree view with lazy loading
 * 
 * Props:
 *   tree {Array} - Tree structure from fileManagerService
 *   expandedNodes {Set} - Set of expanded node IDs
 *   onExpandNode {(nodeId: string) => void} - Called when node expand/collapse clicked
 *   selectedFile {string} - Selected file ID (for highlighting)
 *   onFileSelect {(file: object) => void} - Called when file clicked
 *   isLoading {boolean} - Show loading spinner
 */
export default function FileTree({
  tree,
  expandedNodes,
  onExpandNode,
  selectedFile,
  onFileSelect,
  isLoading,
}) {
  const renderBatch = (batch) => {
    const isExpanded = expandedNodes.has(batch.id);

    return (
      <div key={batch.id} className="mb-1">
        {/* Batch header */}
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer group">
          <button
            onClick={() => onExpandNode(batch.id)}
            className="p-0 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <span className="text-sm font-semibold text-gray-700 flex-1">
            📁 {batch.label}
          </span>
          <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
            {batch.children.length}
          </span>
        </div>

        {/* Records (visible when batch expanded) */}
        {isExpanded && (
          <div className="ml-4 mt-1">
            {batch.children.map((record) => renderRecord(batch, record))}
          </div>
        )}
      </div>
    );
  };

  const renderRecord = (batch, record) => {
    const isExpanded = expandedNodes.has(record.id);
    const isLoading = record.isLoading;

    return (
      <div key={record.id} className="mb-1">
        {/* Record header */}
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-blue-50 rounded cursor-pointer group">
          <button
            onClick={() => onExpandNode(record.id)}
            disabled={isLoading}
            className="p-0 hover:bg-gray-200 rounded transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <span className="text-sm text-gray-600 flex-1 truncate">
            👤 {record.label}
          </span>
          {record.children.length > 0 && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {record.children.length}
            </span>
          )}
        </div>

        {/* Files (visible when record expanded) */}
        {isExpanded && record.isLoaded && (
          <div className="ml-4 mt-1">
            {record.children.length > 0 ? (
              record.children.map((file) => renderFile(file))
            ) : (
              <div className="px-2 py-1 text-xs text-gray-400 italic">
                No files
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFile = (file) => {
    const isSelected = selectedFile === file.id;

    return (
      <div
        key={file.id}
        onClick={() => onFileSelect(file)}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded cursor-pointer truncate transition-colors',
          isSelected
            ? 'bg-blue-200 text-blue-900'
            : 'hover:bg-gray-100 text-gray-600'
        )}
        title={file.fileName}
      >
        <span className="text-base flex-shrink-0">{file.icon}</span>
        <span className="text-sm truncate flex-1">{file.fileName}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatFileSize(file.size)}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No files found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((batch) => renderBatch(batch))}
    </div>
  );
}

/**
 * Format file size for display
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (!bytes) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
