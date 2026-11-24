const express = require('express');
const adminController = require('../controllers/adminController');
const cekLogin = require('../middleware/cekLogin');
const cekRole = require('../middleware/cekRole');
const { unggahGambar } = require('../middleware/upload');
const rekapController = require('../controllers/rekapController');
const auditController = require('../controllers/auditController');

const router = express.Router();
router.use('/admin', cekLogin, cekRole('admin'));

router.get('/admin', (req, res) => res.redirect('/admin/jenis'));

router.get('/admin/jenis', adminController.daftarJenis);
router.post('/admin/jenis', adminController.tambahJenis);
router.post('/admin/jenis/:id/edit', adminController.ubahJenis);
router.post('/admin/jenis/:id/hapus', adminController.hapusJenis);

router.get('/admin/lapangan', adminController.daftarLapangan);
router.get('/admin/lapangan/baru', adminController.tampilkanFormLapangan);
router.post('/admin/lapangan/baru', unggahGambar, adminController.simpanLapangan);
router.get('/admin/lapangan/:id/edit', adminController.tampilkanFormLapangan);
router.post('/admin/lapangan/:id/edit', unggahGambar, adminController.simpanLapangan);
router.post('/admin/lapangan/:id/hapus', adminController.hapusLapangan);

router.get('/admin/tarif', adminController.daftarTarif);
router.post('/admin/tarif', adminController.simpanTarif);
router.post('/admin/tarif/:id/edit', adminController.simpanTarif);
router.post('/admin/tarif/:id/hapus', adminController.hapusTarif);

router.get('/admin/user', adminController.daftarUser);
router.get('/admin/user/baru', adminController.tampilkanFormUser);
router.post('/admin/user/baru', adminController.simpanUser);
router.get('/admin/user/:id/edit', adminController.tampilkanFormUser);
router.post('/admin/user/:id/edit', adminController.simpanUser);
router.post('/admin/user/:id/hapus', adminController.hapusUser);

router.get('/admin/rekap', rekapController.lihatRekap);
router.get('/admin/rekap/ekspor', rekapController.eksporExcel);
router.get('/admin/audit', auditController.lihatAudit);

module.exports = router;
