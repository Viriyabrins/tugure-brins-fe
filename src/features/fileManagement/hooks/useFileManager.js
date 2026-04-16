/**
 * useFileManager Hook
 * Manages folder-based file tree: Folder → Subfolder → [RecordId] → Files
 */

import { useState, useEffect, useCallback } from 'react';
import {
  buildFolderTree,
  loadSubfolderContents,
  updateSubfolderNode,
  setSubfolderLoading,
  searchFilesInTree,
  getTreeFileCount,
} from '../services/fileManagerService';

/**
 * Hook for managing folder-based file tree
 * @returns {Object} {tree, expandNode, searchQuery, setSearchQuery, ...}
 */
export function useFileManager() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);

  // Build initial folder structure (no MinIO calls)
  useEffect(() => {
    setLoading(true);
    const folderTree = buildFolderTree();
    setTree(folderTree);
    setLoading(false);
  }, []);

  /**
   * Toggle a folder or subfolder node.
   * When expanding a subfolder that hasn't been loaded, fetch its files.
   */
  const expandNode = useCallback(
    async (nodeId) => {
      if (expandedNodes.has(nodeId)) {
        // Collapse
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
        return;
      }

      // If it's a folder-level node, just toggle expand
      if (nodeId.startsWith('folder-')) {
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
        return;
      }

      // If it's a subfolder, check if already loaded
      let subNode = null;
      for (const folder of tree) {
        for (const sub of folder.children) {
          if (sub.id === nodeId) {
            subNode = sub;
            break;
          }
        }
        if (subNode) break;
      }

      if (subNode?.isLoaded) {
        setExpandedNodes((prev) => new Set(prev).add(nodeId));
        return;
      }

      // Load files for this subfolder
      if (subNode) {
        setTree((prev) => setSubfolderLoading(prev, nodeId, true));
        try {
          const contents = await loadSubfolderContents(subNode.folder, subNode.subfolder);
          setTree((prev) => updateSubfolderNode(prev, nodeId, contents));
          setExpandedNodes((prev) => new Set(prev).add(nodeId));
        } catch (err) {
          console.error(`Error expanding ${nodeId}:`, err);
          setTree((prev) => setSubfolderLoading(prev, nodeId, false));
        }
      }
    },
    [tree, expandedNodes]
  );

  /**
   * Toggle a record node (inside attachment subfolders)
   */
  const toggleRecord = useCallback(
    (recordId) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(recordId)) {
          next.delete(recordId);
        } else {
          next.add(recordId);
        }
        return next;
      });
    },
    []
  );

  /**
   * Get search results or the full tree
   */
  const displayTree = searchQuery
    ? searchFilesInTree(tree, searchQuery)
    : tree;

  const stats = {
    totalFiles: getTreeFileCount(tree),
    totalFolders: tree.length,
  };

  return {
    tree,
    displayTree,
    loading,
    expandedNodes,
    expandNode,
    toggleRecord,
    searchQuery,
    setSearchQuery,
    selectedFile,
    setSelectedFile,
    stats,
    isSearching: searchQuery.length > 0,
  };
}

export default useFileManager;
