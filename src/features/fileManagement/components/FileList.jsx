/**
 * FileList Component
 * Displays list view of files with download, metadata, and actions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Trash2, ExternalLink } from 'lucide-react';
import { formatFileSize, getFileIcon } from '@/utils/fileValidation';
import { getDownloadUrl } from '@/services/storageService';

/**
 * FileList - Detailed file listing with actions
 * 
 * Props:
 *   file {object} - Selected file to display details
 *   onDownload {(file: object) => void} - Called when download clicked
 *   onDelete {(fileKey: string) => void} - Called when delete clicked
 *   isLoading {boolean} - Show loading state
 */
export default function FileList({
  file,
  onDownload,
  onDelete,
  isLoading,
  canDelete = false,
}) {
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-base">Select a file to view details</p>
      </div>
    );
  }

  const lastModified = file.lastModified
    ? new Date(file.lastModified).toLocaleString('id-ID')
    : '-';

  const parentInfo = file.parentRecord && file.parentBatch
    ? `${file.parentBatch} → ${file.parentRecord}`
    : 'Unknown location';

  return (
    <div className="space-y-4">
      {/* File Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-5xl">{file.icon || getFileIcon(file.fileName)}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {file.fileName || file.name}
            </h3>
            <p className="text-sm text-gray-600 truncate">{parentInfo}</p>
          </div>
        </div>
      </div>

      {/* File Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase font-semibold">File Size</p>
          <p className="text-lg font-medium text-gray-900 mt-1">
            {formatFileSize(file.size)}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase font-semibold">Modified</p>
          <p className="text-sm font-medium text-gray-900 mt-1">{lastModified}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg col-span-2">
          <p className="text-xs text-gray-500 uppercase font-semibold">Storage Key</p>
          <p className="text-xs font-mono text-gray-700 mt-1 break-all truncate">
            {file.key || file.id}
          </p>
        </div>
      </div>

      {/* File Preview/Details */}
      <div className="p-4 bg-white border rounded-lg space-y-3">
        <h4 className="font-semibold text-gray-900">File Information</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Type:</dt>
            <dd className="font-medium text-gray-900">
              {getFileExtension(file.fileName)?.toUpperCase() || 'Unknown'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Bucket:</dt>
            <dd className="font-medium text-gray-900">{file.bucket || 'brins'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Uploaded:</dt>
            <dd className="font-medium text-gray-900">{lastModified}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onDownload(file)}
          disabled={isLoading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        {canDelete && (
          <Button
            onClick={() => onDelete(file.key || file.id)}
            disabled={isLoading}
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Open in new tab for preview */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={async () => {
          try {
            const url = await getDownloadUrl(file.key || file.id);
            window.open(url, '_blank');
          } catch (err) {
            console.error('Error opening file:', err);
          }
        }}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Preview in Browser
      </Button>
    </div>
  );
}

/**
 * Get file extension from filename
 * @param {string} fileName
 * @returns {string}
 */
function getFileExtension(fileName) {
  if (!fileName) return '';
  return fileName.split('.').pop() || '';
}
