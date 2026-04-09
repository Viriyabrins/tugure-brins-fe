/**
 * MinIO S3-compatible client for file uploads and management.
 * Uses AWS SDK v3 S3 client to interact with MinIO.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client configured for MinIO
const s3Client = new S3Client({
  region: 'us-east-1', // MinIO uses standard regions
  endpoint: import.meta.env.VITE_MINIO_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_MINIO_ACCESS_KEY,
    secretAccessKey: import.meta.env.VITE_MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // MinIO requires path-style URLs
});

const BUCKET = import.meta.env.VITE_MINIO_BUCKET;
const PRESIGNED_URL_EXPIRY = 30 * 60; // 30 minutes in seconds

/**
 * Upload a file to MinIO.
 * @param {File} file - The file to upload
 * @param {string} claimId - Claim ID (used in path)
 * @param {string} batchId - Batch ID (used in path)
 * @returns {Promise<{key: string, fileName: string, size: number, uploadedAt: string}>}
 */
export async function uploadFile(file, claimId, batchId) {
  if (!file) throw new Error('File is required');
  if (!claimId) throw new Error('Claim ID is required');
  if (!batchId) throw new Error('Batch ID is required');

  try {
    // Generate unique filename with timestamp to avoid collisions
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name}`;
    const key = `${BUCKET}/${batchId}/${claimId}/${fileName}`;

    // Convert File/Blob to ArrayBuffer for AWS SDK v3 compatibility
    const arrayBuffer = await file.arrayBuffer();

    // Upload file to MinIO
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: arrayBuffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        'original-filename': file.name,
        'claim-id': claimId,
        'batch-id': batchId,
        'uploaded-at': new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    return {
      key,
      fileName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('MinIO upload error:', err);
    throw new Error(`Failed to upload file: ${err.message}`);
  }
}

/**
 * Delete a file from MinIO.
 * @param {string} key - The file key (full path)
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  if (!key) throw new Error('File key is required');

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);
  } catch (err) {
    console.error('MinIO delete error:', err);
    throw new Error(`Failed to delete file: ${err.message}`);
  }
}

/**
 * List all files for a claim.
 * @param {string} claimId - Claim ID
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} Array of file objects {key, size, lastModified, fileName}
 */
export async function listFiles(claimId, batchId) {
  if (!claimId) throw new Error('Claim ID is required');
  if (!batchId) throw new Error('Batch ID is required');

  try {
    const prefix = `${BUCKET}/${batchId}/${claimId}/`;
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    if (!response.Contents) return [];

    return response.Contents.map((obj) => ({
      key: obj.Key,
      fileName: obj.Key.split('/').pop(), // Extract filename from key
      size: obj.Size,
      lastModified: obj.LastModified,
      bucket: BUCKET,
    }));
  } catch (err) {
    console.error('MinIO list error:', err);
    throw new Error(`Failed to list files: ${err.message}`);
  }
}

/**
 * Get a presigned URL for downloading a file.
 * @param {string} key - The file key
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key) {
  if (!key) throw new Error('File key is required');

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    return url;
  } catch (err) {
    console.error('MinIO presigned URL error:', err);
    throw new Error(`Failed to generate download URL: ${err.message}`);
  }
}

/**
 * Get file info and download URL in one call.
 * @param {string} key - The file key
 * @returns {Promise<{url: string, size: number, fileName: string}>}
 */
export async function getFileWithUrl(key) {
  if (!key) throw new Error('File key is required');

  const fileName = key.split('/').pop();
  const url = await getPresignedUrl(key);

  return { url, fileName, key };
}

export default {
  uploadFile,
  deleteFile,
  listFiles,
  getPresignedUrl,
  getFileWithUrl,
};
