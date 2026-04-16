/**
 * File Manager Service
 * Handles folder-based file tree: Folder → Subfolder → [RecordId] → Files
 * Optimized to minimize MinIO calls - only loads files when node is expanded
 */

import { getFilesByPath } from '@/services/storageService';

/**
 * Folder definitions for the file tree.
 * Maps to MinIO path structure: {folder}/{subfolder}/[recordId/]{file}
 */
const FOLDER_STRUCTURE = {
  'master-contract': { label: 'Master Contract', subfolders: ['excel'] },
  'claim':           { label: 'Claim',           subfolders: ['excel', 'attachment'] },
  'batch':           { label: 'Batch',           subfolders: ['excel'] },
  'subrogation':     { label: 'Subrogation',     subfolders: ['excel', 'attachment'] },
};

/**
 * Build the static folder tree (no MinIO calls).
 * Returns Folder → Subfolder nodes. Files loaded lazily on expand.
 */
export function buildFolderTree() {
  return Object.entries(FOLDER_STRUCTURE).map(([folder, { label, subfolders }]) => ({
    id: `folder-${folder}`,
    label,
    type: 'folder',
    folder,
    children: subfolders.map((sub) => ({
      id: `subfolder-${folder}-${sub}`,
      label: sub.charAt(0).toUpperCase() + sub.slice(1),
      type: 'subfolder',
      folder,
      subfolder: sub,
      children: [],
      isLoaded: false,
      isLoading: false,
    })),
  }));
}

/**
 * Load files for a subfolder and organise into record groups when applicable.
 *
 * For "attachment" subfolders the MinIO keys have a recordId segment:
 *   claim/attachment/{recordId}/{file}
 * We group them into intermediate record nodes.
 *
 * For "excel" subfolders files sit directly under the prefix:
 *   master-contract/excel/{file}
 * Returned as flat file nodes.
 */
export async function loadSubfolderContents(folder, subfolder) {
  try {
    const files = await getFilesByPath(folder, subfolder);
    const decorated = (files || []).map((f) => ({
      ...f,
      id: f.key,
      icon: getFileIconFromName(f.fileName),
    }));

    if (subfolder === 'attachment') {
      // Group by recordId extracted from key: {folder}/{subfolder}/{recordId}/{file}
      const byRecord = {};
      decorated.forEach((file) => {
        const parts = (file.key || '').split('/');
        // parts: [folder, subfolder, recordId, filename]
        const recordId = parts.length >= 4 ? parts[2] : 'unknown';
        if (!byRecord[recordId]) byRecord[recordId] = [];
        byRecord[recordId].push(file);
      });

      return Object.entries(byRecord).map(([recordId, recordFiles]) => ({
        id: `record-${folder}-${subfolder}-${recordId}`,
        label: recordId,
        type: 'record',
        folder,
        subfolder,
        recordId,
        children: recordFiles,
      }));
    }

    // For excel-type subfolders, return flat file list
    return decorated;
  } catch (err) {
    console.error(`Error loading ${folder}/${subfolder}:`, err);
    return [];
  }
}

/**
 * Get file icon based on file extension
 */
function getFileIconFromName(fileName) {
  if (!fileName) return '📎';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap = {
    pdf: '📄', xlsx: '📊', xls: '📊', csv: '📊',
    docx: '📝', doc: '📝', pptx: '🎯', ppt: '🎯', txt: '📃',
  };
  return iconMap[ext] || '📎';
}

/**
 * Update a subfolder node's children after lazy loading (immutable).
 */
export function updateSubfolderNode(tree, nodeId, children) {
  return tree.map((folder) => ({
    ...folder,
    children: folder.children.map((sub) =>
      sub.id === nodeId
        ? { ...sub, children, isLoaded: true, isLoading: false }
        : sub
    ),
  }));
}

/**
 * Mark a subfolder node as loading (immutable).
 */
export function setSubfolderLoading(tree, nodeId, isLoading) {
  return tree.map((folder) => ({
    ...folder,
    children: folder.children.map((sub) =>
      sub.id === nodeId ? { ...sub, isLoading } : sub
    ),
  }));
}

/**
 * Collect every file across all loaded subfolders matching a search query.
 */
export function searchFilesInTree(tree, query) {
  const results = [];
  const q = query.toLowerCase();

  tree.forEach((folder) => {
    folder.children.forEach((sub) => {
      const collectFiles = (items, parentLabel) => {
        items.forEach((item) => {
          if (item.type === 'record') {
            collectFiles(item.children, item.label);
          } else if (item.fileName) {
            if (
              item.fileName.toLowerCase().includes(q) ||
              (item.key || '').toLowerCase().includes(q)
            ) {
              results.push({
                ...item,
                parentFolder: folder.label,
                parentSubfolder: sub.label,
                parentRecord: parentLabel || '',
              });
            }
          }
        });
      };
      collectFiles(sub.children, null);
    });
  });

  return results;
}

/**
 * Count total files across the whole tree.
 */
export function getTreeFileCount(tree) {
  let count = 0;
  tree.forEach((folder) => {
    folder.children.forEach((sub) => {
      sub.children.forEach((item) => {
        if (item.type === 'record') {
          count += item.children.length;
        } else if (item.fileName) {
          count += 1;
        }
      });
    });
  });
  return count;
}

export default {
  buildFolderTree,
  loadSubfolderContents,
  updateSubfolderNode,
  setSubfolderLoading,
  searchFilesInTree,
  getTreeFileCount,
};
