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

      // If it's a folder-level node, collapse all other folders and their children
      if (nodeId.startsWith('folder-')) {
        const siblingFolderIds = tree.map((f) => f.id).filter((id) => id !== nodeId);
        const siblingChildIds = tree
          .filter((f) => f.id !== nodeId)
          .flatMap((f) => f.children.map((c) => c.id));
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          siblingFolderIds.forEach((id) => next.delete(id));
          siblingChildIds.forEach((id) => next.delete(id));
          next.add(nodeId);
          return next;
        });
        return;
      }

      // Find the subfolder node and collect sibling IDs
      let subNode = null;
      let siblingIds = [];
      for (const folder of tree) {
        for (const sub of folder.children) {
          if (sub.id === nodeId) {
            subNode = sub;
            siblingIds = folder.children.map((s) => s.id).filter((id) => id !== nodeId);
            break;
          }
        }
        if (subNode) break;
      }

      // Helper to expand this node and collapse siblings
      const expandAndCollapseSiblings = (prev) => {
        const next = new Set(prev);
        siblingIds.forEach((id) => next.delete(id));
        next.add(nodeId);
        return next;
      };

      if (subNode?.isLoaded) {
        setExpandedNodes(expandAndCollapseSiblings);
        return;
      }

      // Load files for this subfolder
      if (subNode) {
        setTree((prev) => setSubfolderLoading(prev, nodeId, true));
        try {
          const contents = await loadSubfolderContents(subNode.folder, subNode.subfolder);
          setTree((prev) => updateSubfolderNode(prev, nodeId, contents));
          setExpandedNodes(expandAndCollapseSiblings);
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
   * When expanding a record, collapse all sibling records in the same subfolder
   */
  const toggleRecord = useCallback(
    (recordNodeId) => {
      if (expandedNodes.has(recordNodeId)) {
        // Collapse
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.delete(recordNodeId);
          return next;
        });
        return;
      }

      // Parse the record node ID to find its parent subfolder
      // Format: record-{folder}-{subfolder}-{recordId}
      const parts = recordNodeId.split('-');
      if (parts.length < 4) {
        // Invalid record ID format, just add it
        setExpandedNodes((prev) => new Set(prev).add(recordNodeId));
        return;
      }

      const folder = parts[1];
      const subfolder = parts[2];
      const subfolderNodeId = `subfolder-${folder}-${subfolder}`;

      // Find all sibling record IDs in the same subfolder
      let siblingRecordIds = [];
      for (const folderNode of tree) {
        for (const subNode of folderNode.children) {
          if (subNode.id === subfolderNodeId && subNode.children) {
            siblingRecordIds = subNode.children
              .filter((record) => record.id !== recordNodeId)
              .map((record) => record.id);
            break;
          }
        }
        if (siblingRecordIds.length > 0) break;
      }

      // Expand this record and collapse its siblings
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        siblingRecordIds.forEach((id) => next.delete(id));
        next.add(recordNodeId);
        return next;
      });
    },
    [tree, expandedNodes]
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
