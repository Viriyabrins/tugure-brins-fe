/**
 * File Manager Service
 * Handles file tree structure, lazy loading, and caching
 * Optimized to minimize MinIO calls - only loads files when node is expanded
 */

import { getFilesForRecord } from '@/services/storageService';

/**
 * Build file tree structure WITHOUT loading individual files (optimization)
 * Creates tree: Batch → Record (with empty children, loaded on demand)
 * 
 * @param {Array} records - Array of claim/debtor records
 * @returns {Array} Tree structure [{id, label, type, batchId, recordId, children: [], isLoaded: false}, ...]
 */
export async function buildFileTreeStructure(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  // Group records by batch_id
  const byBatch = {};
  records.forEach((record) => {
    const batchId = record.batch_id || 'Unknown';
    if (!byBatch[batchId]) {
      byBatch[batchId] = [];
    }
    byBatch[batchId].push(record);
  });

  // Build tree: Batch → Record (files loaded lazily)
  const tree = Object.entries(byBatch).map(([batchId, batchRecords]) => ({
    id: `batch-${batchId}`,
    label: batchId,
    type: 'batch',
    batchId,
    children: batchRecords.map((record) => ({
      id: `record-${record.id || record.claim_id || record.claim_no}`,
      label: record.nama_tertanggung || record.nama_peserta || record.claim_no || record.nomor_peserta || record.id,
      type: 'record',
      batchId,
      recordId: record.id || record.claim_id || record.claim_no,
      recordName: record.claim_no || record.nomor_peserta || record.id,
      status: record.status,
      children: [], // Will be populated on expand
      isLoaded: false, // Track if files have been loaded
      isLoading: false, // Track loading state
    })),
  }));

  return tree;
}

/**
 * Load files for a specific record (LAZY LOADING)
 * Called when user expands a record node
 * 
 * @param {string} recordId - Record ID (claim_no, debtor ID, etc)
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} File objects {id, key, fileName, size, lastModified, bucket, icon}
 */
export async function loadFilesForRecord(recordId, batchId) {
  try {
    const files = await getFilesForRecord(recordId, batchId);
    return files.map((file) => ({
      ...file,
      id: file.key, // Use key as unique ID
      icon: getFileIconFromName(file.fileName),
    }));
  } catch (err) {
    console.error(`Error loading files for record ${recordId}:`, err);
    return [];
  }
}

/**
 * Get file icon based on file extension
 * @param {string} fileName
 * @returns {string} Icon emoji
 */
function getFileIconFromName(fileName) {
  if (!fileName) return '📎';
  
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap = {
    pdf: '📄',
    xlsx: '📊',
    xls: '📊',
    csv: '📊',
    docx: '📝',
    doc: '📝',
    pptx: '🎯',
    ppt: '🎯',
    txt: '📃',
  };
  return iconMap[ext] || '📎';
}

/**
 * Update tree node's children after lazy loading
 * 
 * @param {Array} tree - Current tree
 * @param {string} nodeId - Node ID to update (record-*)
 * @param {Array} children - Files to set as children
 * @returns {Array} Updated tree (immutable)
 */
export function updateTreeNode(tree, nodeId, children) {
  return tree.map((batch) => ({
    ...batch,
    children: batch.children.map((record) => {
      if (record.id === nodeId) {
        return {
          ...record,
          children,
          isLoaded: true,
          isLoading: false,
        };
      }
      return record;
    }),
  }));
}

/**
 * Mark node as loading
 * @param {Array} tree
 * @param {string} nodeId
 * @returns {Array} Updated tree
 */
export function setNodeLoading(tree, nodeId, isLoading) {
  return tree.map((batch) => ({
    ...batch,
    children: batch.children.map((record) => 
      record.id === nodeId 
        ? { ...record, isLoading }
        : record
    ),
  }));
}

/**
 * Search files across all records in tree
 * 
 * @param {Array} tree - File tree
 * @param {string} query - Search query
 * @returns {Array} Matching files with parent info {id, fileName, size, parentRecord, parentBatch}
 */
export function searchFilesInTree(tree, query) {
  const results = [];
  const lowerQuery = query.toLowerCase();

  tree.forEach((batch) => {
    batch.children.forEach((record) => {
      record.children.forEach((file) => {
        if (
          file.fileName?.toLowerCase().includes(lowerQuery) ||
          file.key?.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            ...file,
            parentRecord: record.label,
            parentRecordId: record.recordId,
            parentBatch: batch.label,
          });
        }
      });
    });
  });

  return results;
}

/**
 * Filter tree by batch and/or status
 * 
 * @param {Array} tree - File tree
 * @param {Object} filters - {batchId, status}
 * @returns {Array} Filtered tree (removes empty batches)
 */
export function filterTree(tree, filters) {
  if (!filters.batchId && !filters.status) {
    return tree;
  }

  return tree
    .filter((batch) => !filters.batchId || batch.batchId === filters.batchId)
    .map((batch) => ({
      ...batch,
      children: batch.children.filter((record) => {
        if (filters.status && record.status !== filters.status) {
          return false;
        }
        return true;
      }),
    }))
    .filter((batch) => batch.children.length > 0); // Remove empty batches
}

/**
 * Get total file count in tree
 * @param {Array} tree
 * @returns {number} Total files
 */
export function getTreeFileCount(tree) {
  return tree.reduce((sum, batch) => 
    sum + batch.children.reduce((recordSum, record) => 
      recordSum + record.children.length, 0), 0);
}

/**
 * Get total file size in tree
 * @param {Array} tree
 * @returns {number} Total size in bytes
 */
export function getTreeTotalSize(tree) {
  return tree.reduce((sum, batch) => 
    sum + batch.children.reduce((recordSum, record) => 
      recordSum + record.children.reduce((fileSum, file) => 
        fileSum + (file.size || 0), 0), 0), 0);
}

export default {
  buildFileTreeStructure,
  loadFilesForRecord,
  updateTreeNode,
  setNodeLoading,
  searchFilesInTree,
  filterTree,
  getTreeFileCount,
  getTreeTotalSize,
};
