const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { put } = require('@vercel/blob');

const folderUnggahan = path.join(__dirname, '..', 'public', 'uploads');

const multerGambar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, selesai) => {
    const ekstensi = path.extname(file.originalname).toLowerCase();
    const cocokJpg = ekstensi === '.jpg' || ekstensi === '.jpeg';
    const cocokPng = ekstensi === '.png';
    const mimeJpg = file.mimetype === 'image/jpeg';
    const mimePng = file.mimetype === 'image/png';

    if ((cocokJpg && mimeJpg) || (cocokPng && mimePng)) {
      return selesai(null, true);
    }
    selesai(new Error('Gambar harus berformat JPG atau PNG.'));
  }
}).single('gambar');

function unggahGambar(req, res, next) {
  multerGambar(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        req.pesanUpload = 'Ukuran gambar maksimal 2 MB.';
      } else {
        req.pesanUpload = error.message || 'Gambar tidak berhasil diunggah.';
      }
      return next();
    }

    if (req.file) {
      const isiAwal = req.file.buffer.subarray(0, 8);
      const ekstensi = path.extname(req.file.originalname).toLowerCase();
      const pngValid = ekstensi === '.png' && isiAwal.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpgValid = (ekstensi === '.jpg' || ekstensi === '.jpeg') && isiAwal[0] === 255 && isiAwal[1] === 216 && isiAwal[2] === 255;
      if (!pngValid && !jpgValid) {
        req.file = null;
        req.pesanUpload = 'Isi file tidak cocok dengan format JPG atau PNG.';
        return next();
      }

      try {
        const namaFile = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ekstensi}`;
        const diVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
        const tersediaBlob = process.env.BLOB_READ_WRITE_TOKEN
          || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN);

        if (diVercel && !tersediaBlob) {
          req.file = null;
          req.pesanUpload = 'Penyimpanan gambar belum dikonfigurasi untuk deployment ini.';
          return next();
        }

        if (diVercel || process.env.BLOB_READ_WRITE_TOKEN) {
          const blob = await put(namaFile, req.file.buffer, {
            access: 'public',
            addRandomSuffix: true,
            contentType: req.file.mimetype
          });
          req.file.filename = blob.url;
        } else {
          await fs.promises.mkdir(folderUnggahan, { recursive: true });
          await fs.promises.writeFile(path.join(folderUnggahan, namaFile), req.file.buffer, { flag: 'wx' });
          req.file.filename = namaFile;
        }
      } catch (simpanError) {
        console.error('Gagal menyimpan gambar lapangan:', simpanError.message);
        req.file = null;
        req.pesanUpload = 'Foto tidak dapat disimpan. Coba lagi atau periksa konfigurasi penyimpanan.';
      }
    }

    next();
  });
}

module.exports = { unggahGambar, folderUnggahan };
