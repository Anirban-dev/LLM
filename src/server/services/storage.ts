import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const s3Endpoint = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
const s3Region = process.env.S3_REGION || 'us-east-1';
const s3AccessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
const s3SecretKey = process.env.S3_SECRET_KEY || 'minioadmin';
const s3Bucket = process.env.S3_BUCKET_NAME || 'chatapp-media';
const s3PublicUrl = process.env.S3_PUBLIC_URL || `${s3Endpoint}/${s3Bucket}`;

let s3Client: S3Client | null = null;

try {
  s3Client = new S3Client({
    endpoint: s3Endpoint,
    region: s3Region,
    credentials: {
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    },
    forcePathStyle: true, // Crucial for MinIO and self-hosted S3 object storage
  });
} catch (err) {
  console.warn('⚠️ Could not initialize S3 Client for MinIO object storage:', err);
}

/**
 * Uploads a file buffer to MinIO / S3 Object Storage.
 * Falls back to local disk storage if Object Storage is unreachable or fails.
 */
export async function uploadFileToStorage(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{ fileUrl: string; storageType: 'minio_s3' | 'local_disk' }> {
  const fileExt = path.extname(originalFilename) || '';
  const sanitizedBase = path.basename(originalFilename, fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueKey = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedBase}${fileExt}`;

  // Try MinIO / S3 Object Storage first
  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: uniqueKey,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await s3Client.send(command);
      const objectUrl = `${s3PublicUrl}/${uniqueKey}`;
      console.log(`📦 [Object Storage] Uploaded ${originalFilename} to MinIO bucket "${s3Bucket}" -> ${objectUrl}`);
      return { fileUrl: objectUrl, storageType: 'minio_s3' };
    } catch (s3Err) {
      console.warn(`⚠️ MinIO Object Storage upload failed for ${originalFilename}. Falling back to local disk...`, s3Err);
    }
  }

  // Fallback: Save to local disk directory `/uploads`
  const diskPath = path.join(uploadsDir, uniqueKey);
  fs.writeFileSync(diskPath, fileBuffer);
  const localUrl = `/uploads/${uniqueKey}`;
  console.log(`💾 [Local Storage] Saved ${originalFilename} to local disk -> ${localUrl}`);
  return { fileUrl: localUrl, storageType: 'local_disk' };
}
