/**
 * Storage service for file operations via backend API.
 * Centralized wrapper for file upload, download, deletion, and listing.
 * Backend handles all MinIO interactions (credentials not exposed to frontend).
 * Used by all features: claims, debtors, contracts, master-contracts, etc.
 */

import { validateFile, validateFiles } from '@/utils/fileValidation.js';
import { authFetchOptions } from '@/api/backendClient.js';

// All /api/* requests are proxied by Vite (dev) or server.js (staging/prod).
// Never use VITE_API_PROXY as a URL prefix — it is the proxy *target*, not a path.
const API_BASE = '/api';

/**
 * Upload and validate a file via backend API.
 * 
 * @param {File} file - File to upload
 * @param {Object} options - Upload options
 * @param {string} options.recordId - Record ID (claim_no, debtor ID, etc.)
 * @param {string} options.batchId - Batch ID for organization
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 * 
 * @example
 * const result = await uploadFileToStorage(file, { recordId: 'CLM001', batchId: 'BATCH-2026-03' });
 * if (result.success) console.log('Uploaded:', result.data.key);
 */
export async function uploadFileToStorage(file, options) {
  const { recordId, batchId } = options;

  if (!recordId || !batchId) {
    return { success: false, error: 'recordId and batchId are required' };
  }

  // Validate file
  const validation = validateFile(file);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  try {
    const formData = new FormData();
    // Fields must come before file so backend can read them during stream parsing
    formData.append('recordId', recordId);
    formData.append('batchId', batchId);
    formData.append('file', file);

    const url = `${API_BASE}/files/upload`;
    const response = await fetch(url, await authFetchOptions({
      method: 'POST',
      body: formData,
    }, url));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || data };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upload and validate multiple files via backend API.
 * Stops on first error or validates all before uploading.
 * 
 * @param {File[]} files - Array of files to upload
 * @param {Object} options - Upload options
 * @param {string} options.recordId - Record ID
 * @param {string} options.batchId - Batch ID
 * @param {boolean} [options.stopOnError=true] - Stop uploading if validation fails
 * @returns {Promise<{success: boolean, uploaded: object[], errors: string[]}>}
 */
export async function uploadMultipleFiles(files, options) {
  const { recordId, batchId, stopOnError = true } = options;

  if (!recordId || !batchId) {
    return { success: false, uploaded: [], errors: ['recordId and batchId are required'] };
  }

  // Validate all files first
  const validation = validateFiles(files);
  if (!validation.isValid) {
    const errorMessages = validation.errors.map((err) =>
      err.fileName ? `${err.fileName}: ${err.errors.join('; ')}` : err.error
    );
    if (stopOnError) {
      return { success: false, uploaded: [], errors: errorMessages };
    }
  }

  // Upload all valid files
  const uploaded = [];
  const errors = [];

  for (const file of files) {
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      errors.push(`${file.name}: ${fileValidation.errors.join('; ')}`);
      if (stopOnError) break;
      continue;
    }

    try {
      const result = await uploadFileToStorage(file, { recordId, batchId });
      if (result.success) {
        uploaded.push(result.data);
      } else {
        errors.push(`${file.name}: ${result.error}`);
        if (stopOnError) break;
      }
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
      if (stopOnError) break;
    }
  }

  return { success: errors.length === 0, uploaded, errors };
}

/**
 * Get all files for a record via backend API.
 * 
 * @param {string} recordId - Record ID (claim_no, debtor ID, etc.)
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} Array of file objects {key, fileName, size, lastModified}
 * 
 * @example
 * const files = await getFilesForRecord('CLM001', 'BATCH-2026-03');
 * console.log(files); // [{key: '...', fileName: 'document.pdf', size: 1024, ...}, ...]
 */
export async function getFilesForRecord(recordId, batchId) {
  try {
    const params = new URLSearchParams({ recordId, batchId });
    const url = `${API_BASE}/files?${params.toString()}`;
    const response = await fetch(url, await authFetchOptions({}, url));

    if (!response.ok) {
      throw new Error(`Failed to fetch files with status ${response.status}`);
    }

    const data = await response.json();
    return data.data?.files || [];
  } catch (err) {
    console.error('Error fetching files:', err);
    return [];
  }
}

/**
 * Get a presigned download URL for a file via backend API.
 * URL expires in 30 minutes for security.
 * 
 * @param {string} fileKey - Full file key (e.g., 'BATCH-ID/RECORD-ID/filename')
 * @returns {Promise<string>} Presigned URL valid for 30 minutes
 * 
 * @example
 * const url = await getDownloadUrl('BATCH-2026-03/CLM001/document.pdf');
 * window.open(url); // Opens file in new tab
 */
export async function getDownloadUrl(fileKey) {
  try {
    const params = new URLSearchParams({ key: fileKey });
    const url = `${API_BASE}/files/download-url?${params.toString()}`;
    const response = await fetch(url, await authFetchOptions({}, url));

    if (!response.ok) {
      throw new Error(`Failed to get download URL with status ${response.status}`);
    }

    const data = await response.json();
    return data.data?.url || data.url;
  } catch (err) {
    console.error('Error generating download URL:', err);
    throw err;
  }
}

/**
 * Delete a file from storage via backend API.
 * 
 * @param {string} fileKey - Full file key
 * @returns {Promise<void>}
 * 
 * @example
 * await removeFile('BATCH-2026-03/CLM001/document.pdf');
 */
export async function removeFile(fileKey) {
  try {
    const params = new URLSearchParams({ key: fileKey });
    const url = `${API_BASE}/files?${params.toString()}`;
    const response = await fetch(url, await authFetchOptions({ method: 'DELETE' }, url));

    if (!response.ok) {
      throw new Error(`Failed to delete file with status ${response.status}`);
    }
  } catch (err) {
    console.error('Error deleting file:', err);
    throw err;
  }
}

/**
 * Get total size of all files for a record (useful for quota checking).
 * 
 * @param {string} recordId - Record ID
 * @param {string} batchId - Batch ID
 * @returns {Promise<number>} Total size in bytes
 */
export async function getTotalFilesSize(recordId, batchId) {
  try {
    const files = await getFilesForRecord(recordId, batchId);
    return files.reduce((sum, file) => sum + (file.size || 0), 0);
  } catch (err) {
    console.error('Error calculating total file size:', err);
    return 0;
  }
}

export default {
  uploadFileToStorage,
  uploadMultipleFiles,
  getFilesForRecord,
  getDownloadUrl,
  removeFile,
  getTotalFilesSize,
  uploadFileToPath,
  uploadMultipleFilesToPath,
  getFilesByPath,
};

// ─── Folder-based storage API (new) ─────────────────────────────────────────

/**
 * Upload a file using the folder-based storage structure.
 *
 * @param {File} file - File to upload
 * @param {Object} options
 * @param {string} options.folder - Top-level folder (e.g. 'master-contract', 'claim', 'batch')
 * @param {string} options.subfolder - Subfolder (e.g. 'excel', 'attachment')
 * @param {string} [options.recordId] - Optional record ID (e.g. nomor_peserta)
 * @param {string} [options.identifier] - Optional identifier for filename (e.g. contractNo, batchId)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function uploadFileToPath(file, options) {
  const { folder, subfolder, recordId, identifier } = options;

  if (!folder || !subfolder) {
    return { success: false, error: 'folder and subfolder are required' };
  }

  const validation = validateFile(file);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  try {
    const formData = new FormData();
    // Fields must come before file so backend can read them during stream parsing
    formData.append('folder', folder);
    formData.append('subfolder', subfolder);
    if (recordId) formData.append('recordId', recordId);
    if (identifier) formData.append('identifier', identifier);
    formData.append('file', file);

    const url = `${API_BASE}/files/upload`;
    const response = await fetch(url, await authFetchOptions({
      method: 'POST',
      body: formData,
    }, url));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data: data.data || data };
  } catch (err) {
    console.error('Upload to path error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upload multiple files using the folder-based storage structure.
 *
 * @param {File[]} files
 * @param {Object} options
 * @param {string} options.folder
 * @param {string} options.subfolder
 * @param {string} [options.recordId]
 * @param {string} [options.identifier]
 * @param {boolean} [options.stopOnError=true]
 * @returns {Promise<{success: boolean, uploaded: object[], errors: string[]}>}
 */
export async function uploadMultipleFilesToPath(files, options) {
  const { folder, subfolder, recordId, identifier, stopOnError = true } = options;

  if (!folder || !subfolder) {
    return { success: false, uploaded: [], errors: ['folder and subfolder are required'] };
  }

  const validation = validateFiles(files);
  if (!validation.isValid && stopOnError) {
    const errorMessages = validation.errors.map((err) =>
      err.fileName ? `${err.fileName}: ${err.errors.join('; ')}` : err.error
    );
    return { success: false, uploaded: [], errors: errorMessages };
  }

  const uploaded = [];
  const errors = [];

  for (const file of files) {
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      errors.push(`${file.name}: ${fileValidation.errors.join('; ')}`);
      if (stopOnError) break;
      continue;
    }

    try {
      const result = await uploadFileToPath(file, { folder, subfolder, recordId, identifier });
      if (result.success) {
        uploaded.push(result.data);
      } else {
        errors.push(`${file.name}: ${result.error}`);
        if (stopOnError) break;
      }
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
      if (stopOnError) break;
    }
  }

  return { success: errors.length === 0, uploaded, errors };
}

/**
 * List files using the folder-based storage structure.
 *
 * @param {string} folder - Top-level folder
 * @param {string} subfolder - Subfolder
 * @param {string} [recordId] - Optional record ID
 * @returns {Promise<Array>} Array of file objects
 */
export async function getFilesByPath(folder, subfolder, recordId) {
  try {
    const params = new URLSearchParams({ folder, subfolder });
    if (recordId) params.append('recordId', recordId);
    const url = `${API_BASE}/files?${params.toString()}`;
    const response = await fetch(url, await authFetchOptions({}, url));

    if (!response.ok) {
      throw new Error(`Failed to fetch files with status ${response.status}`);
    }

    const data = await response.json();
    return data.data?.files || [];
  } catch (err) {
    console.error('Error fetching files by path:', err);
    return [];
  }
}
