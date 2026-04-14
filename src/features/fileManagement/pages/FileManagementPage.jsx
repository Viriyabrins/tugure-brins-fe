/**
 * File Management Page
 * 2-Level Hierarchy: All Files → Batch → Claim → Files
 */

import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, RefreshCw, Search, Download, Eye, Grid3X3, List, Files, Folder, FolderClosed, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/common/PageHeader';
import { backend } from '@/api/backendClient';
import { getDownloadUrl } from '@/services/storageService';
import fileManagerService from '../services/fileManagerService';
import { toast } from 'sonner';

/**
 * Builds 2-level tree: All Files → Batch → Claim
 * Each claim node represents a claim_no (CLM-XXXX)
 */
const buildClaimTree = async (claims) => {
  // Group by batch
  const byBatch = {};
  claims.forEach((claim) => {
    const batchId = claim.batch_id || 'Unknown';
    if (!byBatch[batchId]) {
      byBatch[batchId] = [];
    }
    byBatch[batchId].push(claim);
  });

  // Build tree structure: Batch → Claims (no debtor grouping)
  const tree = Object.entries(byBatch).map(([batchId, batchClaims]) => {
    return {
      id: `batch-${batchId}`,
      label: batchId,
      type: 'batch',
      batchId,
      children: batchClaims.map((claim) => ({
        id: `claim-${batchId}-${claim.nomor_peserta || claim.claim_no}`,
        label: claim.nomor_peserta || claim.claim_no,
        type: 'claim',
        batchId,
        claimId: claim.nomor_peserta || claim.claim_no,
        claim, // Store full claim object for reference
        children: [], // Will be populated with files on demand
        isLoaded: false,
        isLoading: false,
      })),
    };
  });

  return tree;
};

/**
 * Load files for a specific claim
 */
const loadFilesForClaim = async (batchId, claimId) => {
  try {
    const files = await fileManagerService.loadFilesForRecord(claimId, batchId);
    
    if (Array.isArray(files)) {
      return files.map((file) => ({
        ...file,
        participantNo: claimId,
        batchId,
      }));
    }
    return [];
  } catch (err) {
    console.error(`Failed to load files for claim ${claimId}:`, err);
    return [];
  }
};

/**
 * File Grid View
 */
const FileGridView = ({ files, onDownload, onPreview, isLoading }) => {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(88vh-300px)] max text-gray-500">
        <p>No files found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {files.map((file, idx) => (
        <div
          key={idx}
          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow group"
        >
          {/* File Icon */}
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center text-2xl">
              <Files className="w-6 h-6 text-red-600" />
            </div>
          </div>

          {/* Filename */}
          <p className="text-sm font-medium truncate text-center text-gray-900" title={file.fileName}>
            {file.fileName}
          </p>

          {/* File Size */}
          <p className="text-xs text-gray-500 text-center mt-1">
            {formatFileSize(file.size)}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-8"
              onClick={() => onPreview(file)}
              title="Preview"
            >
              <Eye className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 h-8"
              onClick={() => onDownload(file)}
              title="Download"
            >
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * File List View (Table)
 */
const FileListView = ({ files, onDownload, onPreview, isLoading }) => {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(88vh-300px)] text-gray-500">
        <p>No files found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Filename</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Nomor Peserta</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Size</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-96" title={file.fileName}>
                  <Files className="w-5 h-5 inline-block mr-2" /> {file.fileName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{file.participantNo}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatFileSize(file.size)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDate(file.lastModified)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onPreview(file)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDownload(file)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Utility Functions
 */
const formatFileSize = (bytes) => {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('id-ID');
  } catch {
    return dateString;
  }
};

/**
 * Main Component
 */
export default function FileManagementPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [tree, setTree] = useState([]);
  const [selectedDebtorFiles, setSelectedDebtorFiles] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [loadingNodeId, setLoadingNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // Load claims on mount
  useEffect(() => {
    const loadClaims = async () => {
      setInitialLoading(true);
      setError('');
      try {
        const res = await backend.listPaginated('Claim', {
          page: 1,
          limit: 1000,
        });
        const claims = res.data || [];
        const newTree = await buildClaimTree(claims);
        setTree(newTree);
      } catch (err) {
        setError(`Failed to load claims: ${err?.message || 'Unknown error'}`);
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadClaims();
  }, []);

  /**
   * Handle tree node expansion - load files for claim
   */
  const handleExpandNode = async (nodeId) => {
    if (expandedNodes.has(nodeId)) {
      // Collapse
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
      setSelectedDebtorFiles([]);
      return;
    }

    // Expand - find the claim node and load files
    setLoadingNodeId(nodeId);
    try {
      let claimNode = null;
      
      for (const batch of tree) {
        for (const claim of batch.children) {
          if (claim.id === nodeId) {
            claimNode = claim;
            break;
          }
        }
      }

      if (claimNode) {
        const files = await loadFilesForClaim(claimNode.batchId, claimNode.claimId);
        setSelectedDebtorFiles(files);
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
      }
    } catch (err) {
      console.error('Failed to expand node:', err);
      toast.error('Failed to load files');
    } finally {
      setLoadingNodeId(null);
    }
  };

  /**
   * Handle file download
   */
  const handleDownloadFile = async (file) => {
    try {
      const url = await getDownloadUrl(file.key || file.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName || 'file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Downloaded: ' + file.fileName);
    } catch (err) {
      toast.error('Failed to download: ' + (err?.message || 'Unknown error'));
    }
  };

  /**
   * Handle file preview
   */
  const handlePreviewFile = async (file) => {
    try {
      const url = await getDownloadUrl(file.key || file.id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to preview: ' + (err?.message || 'Unknown error'));
    }
  };

  /**
   * Handle batch toggle - collapse/expand
   * When collapsing: clear expanded claims and their files to keep state in sync
   * When expanding a different batch: clear previous batch's expanded claims and files
   */
  const handleToggleBatch = (batchId) => {
    const isCurrentlySelected = selectedBatchId === batchId;

    if (isCurrentlySelected) {
      // Collapsing - clear all state for this batch
      setSelectedBatchId('');
      
      // Remove all claim nodes from this batch from expandedNodes
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        const batch = tree.find((b) => b.batchId === batchId);
        if (batch) {
          batch.children.forEach((claim) => {
            next.delete(claim.id);
          });
        }
        return next;
      });
      
      // Clear selected claim files
      setSelectedDebtorFiles([]);
    } else {
      // Expanding a different batch - select new batch and clear previous state
      setSelectedBatchId(batchId);
      
      // Clear all expanded claims (from any batch)
      setExpandedNodes(new Set());
      
      // Clear selected claim files
      setSelectedDebtorFiles([]);
    }
  };

  /**
   * Filter files based on search query
   */
  const filteredFiles = useMemo(() => {
    return selectedDebtorFiles.filter((file) => {
      const query = searchQuery.toLowerCase();
      return (
        (file.fileName || '').toLowerCase().includes(query) ||
        (file.participantNo || '').toLowerCase().includes(query)
      );
    });
  }, [selectedDebtorFiles, searchQuery]);

  // Build breadcrumb items for the right-hand content header
  const breadcrumbItems = useMemo(() => {
    const items = ['All Files'];

    if (selectedBatchId) {
      const batch = tree.find((b) => b.batchId === selectedBatchId);
      if (batch) items.push(batch.label);
    }

    // Try to find an expanded claim label
    let claimLabel = '';
    for (const batch of tree) {
      const found = batch.children.find((c) => expandedNodes.has(c.id));
      if (found) {
        claimLabel = found.label;
        break;
      }
    }

    if (!claimLabel && selectedDebtorFiles.length > 0) {
      claimLabel = selectedDebtorFiles[0].participantNo || '';
    }

    if (claimLabel) items.push(claimLabel);
    return items;
  }, [tree, selectedBatchId, expandedNodes, selectedDebtorFiles]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="File Manager"
        subtitle="Browse and manage all attached files"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'File Manager' },
        ]}
        actions={
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Tree */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-4 h-[calc(100vh-300px)] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Folders</h3>
            <div className="space-y-1">
              {tree.map((batch) => (
                <div key={batch.id}>
                  {/* Batch */}
                  <div
                    onClick={() => handleToggleBatch(batch.batchId)}
                    className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <span className="text-lg">
                      {selectedBatchId === batch.batchId ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </span>
                    {selectedBatchId === batch.batchId ? (
                      <Folder className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <FolderClosed className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900">{batch.label}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      ({batch.children.length})
                    </span>
                  </div>

                  {/* Claims */}
                  {selectedBatchId === batch.batchId && (
                    <div className="ml-4 space-y-1">
                      {batch.children.map((claim) => (
                        <div
                          key={claim.id}
                          onClick={() => handleExpandNode(claim.id)}
                          className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                            expandedNodes.has(claim.id)
                              ? 'bg-blue-50'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-lg">
                            {expandedNodes.has(claim.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <span className="text-sm text-gray-700 truncate">
                            {claim.label}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {loadingNodeId === claim.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              selectedDebtorFiles.length || '0'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content - Files */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and View Toggle */}
          <div className="flex gap-2">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
              icon={<Search className="w-4 h-4" />}
            />
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* File Count */}
          {filteredFiles.length > 0 && (
            <p className="text-sm text-gray-600">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Files Display */}
          <div className="bg-white rounded-lg border p-4">
            {/* Breadcrumb placed inside the boxed section */}
            <div className="mb-3">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                {breadcrumbItems.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <span
                      className={
                        idx === 0
                          ? 'text-gray-600 text-base font-semibold' // style only for "All Files"
                          : 'text-gray-700 text-sm'
                      }
                    >
                      {item}
                    </span>
                    {idx < breadcrumbItems.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {viewMode === 'grid' ? (
              <FileGridView
                files={filteredFiles}
                onDownload={handleDownloadFile}
                onPreview={handlePreviewFile}
                isLoading={loadingNodeId !== null}
              />
            ) : (
              <FileListView
                files={filteredFiles}
                onDownload={handleDownloadFile}
                onPreview={handlePreviewFile}
                isLoading={loadingNodeId !== null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
