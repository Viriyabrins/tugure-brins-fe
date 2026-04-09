/**
 * useFileManager Hook
 * Manages file tree state, lazy loading, search, and filters
 */

import { useState, useEffect, useCallback } from 'react';
import {
  buildFileTreeStructure,
  loadFilesForRecord,
  updateTreeNode,
  setNodeLoading,
  searchFilesInTree,
  filterTree,
  getTreeFileCount,
} from '../services/fileManagerService';

/**
 * Hook for managing file tree and operations
 * @param {Array} records - Claim/debtor records to build tree from
 * @returns {Object} {tree, expandNode, searchQuery, setSearchQuery, filters, setFilters, ...}
 */
export function useFileManager(records) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ batchId: '', status: '' });
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);

  // Build initial tree structure (no file loading)
  useEffect(() => {
    const initTree = async () => {
      setLoading(true);
      try {
        const newTree = await buildFileTreeStructure(records);
        setTree(newTree);
      } catch (err) {
        console.error('Error building file tree:', err);
      } finally {
        setLoading(false);
      }
    };

    initTree();
  }, [records]);

  /**
   * Expand a tree node and lazy-load its files
   * @param {string} nodeId - record-* node ID
   */
  const expandNode = useCallback(
    async (nodeId) => {
      if (expandedNodes.has(nodeId)) {
        // Already expanded, toggle collapse
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // Find the node and check if already loaded
      let isAlreadyLoaded = false;
      tree.forEach((batch) => {
        batch.children.forEach((record) => {
          if (record.id === nodeId && record.isLoaded) {
            isAlreadyLoaded = true;
          }
        });
      });

      // If already loaded, just expand it
      if (isAlreadyLoaded) {
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
        return;
      }

      // Otherwise, load files
      setTree((prev) => setNodeLoading(prev, nodeId, true));

      try {
        let recordData = null;
        tree.forEach((batch) => {
          batch.children.forEach((record) => {
            if (record.id === nodeId) {
              recordData = { batchId: batch.batchId, ...record };
            }
          });
        });

        if (recordData) {
          const files = await loadFilesForRecord(recordData.recordId, recordData.batchId);
          setTree((prev) => updateTreeNode(prev, nodeId, files));
          setExpandedNodes((prev) => new Set(prev).add(nodeId));
        }
      } catch (err) {
        console.error(`Error expanding node ${nodeId}:`, err);
      }
    },
    [tree, expandedNodes]
  );

  /**
   * Get filtered and searchable results
   */
  const displayTree = searchQuery
    ? searchFilesInTree(tree, searchQuery)
    : filterTree(tree, filters);

  /**
   * Get file count and stats
   */
  const stats = {
    totalFiles: getTreeFileCount(tree),
    totalBatches: tree.length,
    totalRecords: tree.reduce((sum, b) => sum + b.children.length, 0),
  };

  return {
    tree,
    displayTree,
    loading,
    expandedNodes,
    expandNode,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    selectedFile,
    setSelectedFile,
    stats,
    isSearching: searchQuery.length > 0,
  };
}

export default useFileManager;
