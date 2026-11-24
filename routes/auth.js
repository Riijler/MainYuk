const express = require('express');
const authController = require('../controllers/authController');
const cekLogin = require('../middleware/cekLogin');
const cekRole = require('../middleware/cekRole');

const router = express.Router();

router.get('/daftar', authController.tampilkanDaftar);
router.post('/daftar', authController.daftar);
router.get('/login', authController.tampilkanLogin);
router.post('/login', authController.login);
router.post('/logout', cekLogin, authController.logout);

router.get('/dashboard/penyewa', cekLogin, cekRole('penyewa'), authController.lihatDashboard);
router.get('/dashboard/petugas', cekLogin, cekRole('petugas'), authController.lihatDashboard);
router.get('/dashboard/admin', cekLogin, cekRole('admin'), authController.lihatDashboard);

module.exports = router;
