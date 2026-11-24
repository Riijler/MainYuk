const express = require('express');
const jadwalController = require('../controllers/jadwalController');
const cekLogin = require('../middleware/cekLogin');
const cekRole = require('../middleware/cekRole');

const router = express.Router();

router.get('/jadwal', cekLogin, cekRole(['penyewa', 'petugas']), jadwalController.lihatJadwal);
router.get('/jadwal/mingguan', cekLogin, cekRole(['penyewa', 'petugas']), jadwalController.lihatMingguan);

module.exports = router;
