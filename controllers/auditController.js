const auditModel = require('../models/auditModel');

const BATAS_PER_HALAMAN = 10;
const kolomUrut = ['waktu', 'pengguna', 'aksi', 'kode'];

async function lihatAudit(req, res) {
  try {
    const cari = String(req.query.cari || '').trim().slice(0, 100);
    const urut = kolomUrut.includes(req.query.urut) ? req.query.urut : 'waktu';
    const arah = req.query.arah === 'asc' ? 'asc' : 'desc';
    const jumlahCatatan = await auditModel.hitungDenganFilter(cari);
    const jumlahHalaman = Math.max(1, Math.ceil(jumlahCatatan / BATAS_PER_HALAMAN));
    const diminta = Number.parseInt(req.query.halaman, 10);
    const halaman = Number.isInteger(diminta) && diminta > 0 ? Math.min(diminta, jumlahHalaman) : 1;
    const daftarLog = await auditModel.daftarDenganFilter({
      limit: BATAS_PER_HALAMAN,
      offset: (halaman - 1) * BATAS_PER_HALAMAN,
      cari,
      urut,
      arah
    });

    res.render('admin/audit', {
      judul: 'Audit log', daftarLog, halaman, jumlahHalaman, cari, urut, arah
    });
  } catch (error) {
    console.error('Audit log gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Audit belum tersedia', pesan: 'Audit log belum dapat dimuat.' });
  }
}

module.exports = { lihatAudit };
