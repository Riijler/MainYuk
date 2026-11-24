const express = require('express');
const petugasController = require('../controllers/petugasController');
const bookingController = require('../controllers/bookingController');
const cekLogin = require('../middleware/cekLogin');
const cekRole = require('../middleware/cekRole');

const router = express.Router();
router.use('/petugas', cekLogin, cekRole('petugas'));

router.get('/petugas/booking', petugasController.daftarBooking);
router.get('/petugas/penyewa/baru', petugasController.tambahPenyewa);
router.post('/petugas/penyewa/baru', petugasController.simpanPenyewa);
router.get('/petugas/booking/jam-terisi', petugasController.daftarJamTerisi);
router.get('/petugas/booking/baru', bookingController.tampilkanFormBaruPetugas);
router.post('/petugas/booking/baru', bookingController.simpanBookingPetugas);
router.post('/petugas/booking/:id/status', petugasController.ubahStatus);

module.exports = router;
