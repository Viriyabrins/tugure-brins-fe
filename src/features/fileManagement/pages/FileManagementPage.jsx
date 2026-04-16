/**
 * File Management Page
 * Folder-based hierarchy: Folder → Subfolder → [RecordId] → Files
 */

import React, { useState, useMemo } from 'react';
import { Loader2, RefreshCw, Search, Download, Eye, Grid3X3, List, Files, Folder, FolderClosed, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/common/PageHeader';
import { getDownloadUrl } from '@/services/storageService';
import { useFileManager } from '../hooks/useFileManager';
import { toast } from 'sonner';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

/**
 * File Grid View
 */
const FileGridView = ({ files, onDownload, onPreview }) => {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(88vh-300px)] text-gray-500">
        <p>No files found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {files.map((file, idx) => (
        <div
          key={file.key || idx}
          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow group"
        >
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-red-100 rounded flex items-center justify-center text-2xl">
              <Files className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm font-medium truncate text-center text-gray-900" title={file.fileName}>
            {file.fileName}
          </p>
          <p className="text-xs text-gray-500 text-center mt-1">
            {formatFileSize(file.size)}
          </p>
          <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => onPreview(file)} title="Preview">
              <Eye className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => onDownload(file)} title="Download">
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
const FileListView = ({ files, onDownload, onPreview }) => {
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
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Size</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file, idx) => (
              <tr key={file.key || idx} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-96" title={file.fileName}>
                  <Files className="w-5 h-5 inline-block mr-2" /> {file.fileName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatFileSize(file.size)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(file.lastModified)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => onPreview(file)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDownload(file)}>
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
 * Collect flat file list from the currently selected subfolder or record.
 */
function collectFiles(tree, expandedNodes) {
  const files = [];
  tree.forEach((folder) => {
    if (!expandedNodes.has(folder.id)) return;
    folder.children.forEach((sub) => {
      if (!expandedNodes.has(sub.id) || !sub.isLoaded) return;
      sub.children.forEach((item) => {
        if (item.type === 'record') {
          if (expandedNodes.has(item.id)) {
            files.push(...item.children);
          }
        } else if (item.fileName) {
          files.push(item);
        }
      });
    });
  });
  return files;
}

/**
 * Main Component
 */
export default function FileManagementPage() {
  const {
    tree,
    loading,
    expandedNodes,
    expandNode,
    toggleRecord,
    searchQuery,
    setSearchQuery,
    isSearching,
    displayTree,
  } = useFileManager();

  const [viewMode, setViewMode] = useState('grid');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');

  /**
   * Files to display in the content area
   */
  const visibleFiles = useMemo(() => {
    if (isSearching) {
      // displayTree is a flat search-result array when searching
      return Array.isArray(displayTree) ? displayTree : [];
    }
    return collectFiles(tree, expandedNodes);
  }, [tree, expandedNodes, isSearching, displayTree]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return visibleFiles;
    const q = searchQuery.toLowerCase();
    return visibleFiles.filter(
      (f) =>
        (f.fileName || '').toLowerCase().includes(q) ||
        (f.key || '').toLowerCase().includes(q)
    );
  }, [visibleFiles, searchQuery]);

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

  const handlePreviewFile = async (file) => {
    try {
      const url = await getDownloadUrl(file.key || file.id);
      setPreviewUrl(url);
      setPreviewFileName(file.fileName);
      setPreviewOpen(true);
    } catch (err) {
      toast.error('Failed to preview: ' + (err?.message || 'Unknown error'));
    }
  };

  /**
   * Build breadcrumb from expanded nodes
   */
  const breadcrumbItems = useMemo(() => {
    const items = ['All Files'];
    for (const folder of tree) {
      if (!expandedNodes.has(folder.id)) continue;
      items.push(folder.label);
      for (const sub of folder.children) {
        if (!expandedNodes.has(sub.id)) continue;
        items.push(sub.label);
        for (const item of sub.children) {
          if (item.type === 'record' && expandedNodes.has(item.id)) {
            items.push(item.label);
          }
        }
      }
    }
    return items;
  }, [tree, expandedNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Folder Tree */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-4 h-[calc(100vh-300px)] overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Folders</h3>
            <div className="space-y-1">
              {tree.map((folder) => (
                <div key={folder.id}>
                  {/* Folder level */}
                  <div
                    onClick={() => expandNode(folder.id)}
                    className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    {expandedNodes.has(folder.id) ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    )}
                    {expandedNodes.has(folder.id) ? (
                      <Folder className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <FolderClosed className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900">{folder.label}</span>
                    <span className="text-xs text-gray-500 ml-auto">({folder.children.length})</span>
                  </div>

                  {/* Subfolder level */}
                  {expandedNodes.has(folder.id) && (
                    <div className="ml-4 space-y-1">
                      {folder.children.map((sub) => (
                        <div key={sub.id}>
                          <div
                            onClick={() => expandNode(sub.id)}
                            className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                              expandedNodes.has(sub.id) ? 'bg-blue-50' : 'hover:bg-gray-100'
                            }`}
                          >
                            {sub.isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                            ) : expandedNodes.has(sub.id) ? (
                              <ChevronDown className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 flex-shrink-0" />
                            )}
                            <FolderClosed className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{sub.label}</span>
                            {sub.isLoaded && (
                              <span className="text-xs text-gray-500 ml-auto">
                                ({sub.children.length})
                              </span>
                            )}
                          </div>

                          {/* Record level (for attachment subfolders) */}
                          {expandedNodes.has(sub.id) && sub.isLoaded && sub.children.some((c) => c.type === 'record') && (
                            <div className="ml-4 space-y-1">
                              {sub.children.map((record) => (
                                <div
                                  key={record.id}
                                  onClick={() => toggleRecord(record.id)}
                                  className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                                    expandedNodes.has(record.id) ? 'bg-blue-50' : 'hover:bg-gray-100'
                                  }`}
                                >
                                  {expandedNodes.has(record.id) ? (
                                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                                  )}
                                  <span className="text-sm text-gray-700 truncate">{record.label}</span>
                                  <span className="text-xs text-gray-500 ml-auto">
                                    ({record.children.length})
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
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

          {filteredFiles.length > 0 && (
            <p className="text-sm text-gray-600">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </p>
          )}

          <div className="bg-white rounded-lg border p-4">
            {/* Breadcrumb */}
            <div className="mb-3">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                {breadcrumbItems.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <span
                      className={
                        idx === 0
                          ? 'text-gray-600 text-base font-semibold'
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
              />
            ) : (
              <FileListView
                files={filteredFiles}
                onDownload={handleDownloadFile}
                onPreview={handlePreviewFile}
              />
            )}
          </div>
        </div>
      </div>

      <DocumentPreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl('');
          setPreviewFileName('');
        }}
        url={previewUrl}
        fileName={previewFileName}
      />
    </div>
  );
}
