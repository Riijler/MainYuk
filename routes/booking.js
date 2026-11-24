const express = require('express');
const bookingController = require('../controllers/bookingController');
const cekLogin = require('../middleware/cekLogin');
const cekRole = require('../middleware/cekRole');

const router = express.Router();

router.get('/booking/baru', cekLogin, cekRole('penyewa'), bookingController.tampilkanFormBaru);
router.post('/booking/baru', cekLogin, cekRole('penyewa'), bookingController.simpanBooking);
router.get('/riwayat', cekLogin, cekRole('penyewa'), bookingController.riwayat);
router.post('/booking/:id/batal', cekLogin, cekRole('penyewa'), bookingController.batalkan);
router.get('/booking/:id/bukti/pdf', cekLogin, cekRole(['penyewa', 'petugas']), bookingController.unduhBuktiPdf);
router.get('/booking/:id/bukti', cekLogin, cekRole(['penyewa', 'petugas']), bookingController.bukti);

module.exports = router;
