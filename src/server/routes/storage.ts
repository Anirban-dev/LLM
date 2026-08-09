import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateJwt } from '../auth';
import { uploadFileToStorage } from '../services/storage';

const router = Router();

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// POST /api/storage/upload
router.post(
  '/upload',
  authenticateJwt,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
      }

      const originalName = req.file.originalname || 'file';
      const mimeType = req.file.mimetype || 'application/octet-stream';

      const { fileUrl, storageType } = await uploadFileToStorage(
        req.file.buffer,
        originalName,
        mimeType
      );

      let fileType: 'image' | 'video' | 'document' | 'audio' = 'document';
      if (mimeType.startsWith('image/')) fileType = 'image';
      else if (mimeType.startsWith('video/')) fileType = 'video';
      else if (mimeType.startsWith('audio/')) fileType = 'audio';

      res.json({
        url: fileUrl,
        fileUrl,
        mediaUrl: fileUrl,
        type: fileType,
        fileName: originalName,
        fileSize: req.file.size,
        mimeType,
        storageType,
      });
    } catch (error: any) {
      console.error('Storage upload route error:', error);
      res.status(500).json({ message: error.message || 'Error uploading file' });
    }
  }
);

export default router;
