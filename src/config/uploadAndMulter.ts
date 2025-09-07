import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const hash = crypto.randomBytes(16).toString('hex');
    const filename = `${hash}-${file.originalname}`;
    cb(null, filename);
  },
});

const cloudStorage = multer.memoryStorage();

// Filtro para aceitar apenas imagens
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo inválido. Apenas imagens são permitidas.'), false);
  }
};

export const isCloudUploadDestination = process.env.UPLOAD_DESTINATION === 'cloud';

export const upload = multer({
  storage: isCloudUploadDestination ? cloudStorage : diskStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
});