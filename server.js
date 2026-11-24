require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./config/db');
const lapanganModel = require('./models/lapanganModel');
const tarifModel = require('./models/tarifModel');

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET production wajib diatur dengan minimal 32 karakter acak.');
}

const diVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

const sessionStore = new MySQLStore({
  clearExpired: !diVercel,
  checkExpirationInterval: diVercel ? 0 : 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000,
  createDatabaseTable: false
}, pool);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.locals.urlGambar = (gambar) => {
  if (!gambar) return '';
  return /^https:\/\//i.test(gambar)
    ? gambar
    : `/uploads/${encodeURIComponent(path.basename(gambar))}`;
};
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  name: 'penyewaan.sid',
  secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));
sessionStore.onReady().catch((error) => {
  console.error('Session store MySQL gagal disiapkan:', error.message);
});

const alamatDashboard = {
  penyewa: '/dashboard/penyewa',
  petugas: '/dashboard/petugas',
  admin: '/dashboard/admin'
};

app.use((req, res, next) => {
  res.locals.pengguna = req.session.pengguna || null;
  res.locals.alamatDashboard = req.session.pengguna ? alamatDashboard[req.session.pengguna.role] : null;
  next();
});

const routeAuth = require('./routes/auth');
app.use(routeAuth);
const routeAdmin = require('./routes/admin');
app.use(routeAdmin);
const routeJadwal = require('./routes/jadwal');
app.use(routeJadwal);
const routeBooking = require('./routes/booking');
app.use(routeBooking);
const routePetugas = require('./routes/petugas');
app.use(routePetugas);

app.get('/', async (req, res) => {
  try {
    const lapanganAktif = await lapanganModel.daftarAktif({});
    const daftarTarif = await tarifModel.daftarUntukLapangan(lapanganAktif.map((lapangan) => lapangan.id));
    const labelJenis = {
      'sepak bola': 'RUMPUT OUTDOOR', 'mini soccer': 'LAPANGAN OUTDOOR', futsal: 'RUMPUT SINTETIS',
      voli: 'LAPANGAN INDOOR', tennis: 'HARD COURT', padel: 'LAPANGAN PADEL', badminton: 'LANTAI VINYL'
    };
    const lapanganContoh = lapanganAktif.map((lapangan) => {
      const tarifLapangan = daftarTarif
        .filter((tarif) => tarif.lapangan_id === lapangan.id)
        .map((tarif) => Number(tarif.harga_per_jam));
      return {
        id: lapangan.id,
        nama: lapangan.nama,
        jenis: lapangan.jenis_nama,
        harga: tarifLapangan.length
          ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.min(...tarifLapangan))
          : '—',
        jam: `${String(lapangan.jam_buka).slice(0, 5).replace(':', '.')}—${String(lapangan.jam_tutup).slice(0, 5).replace(':', '.')}`,
        lampu: String(lapangan.jam_mulai_lampu).slice(0, 5).replace(':', '.'),
        label: labelJenis[lapangan.jenis_nama] || 'LAPANGAN OLAHRAGA'
      };
    });
    res.render('beranda', { judul: 'Penyewaan Lapangan', lapanganContoh, lapanganUtama: lapanganContoh[0] || null });
  } catch (error) {
    console.error('Katalog beranda gagal dimuat:', error.message);
    res.status(500).render('pesan', {
      judul: 'Katalog belum tersedia',
      pesan: 'Pilihan lapangan belum dapat dimuat. Periksa koneksi database.'
    });
  }
});

app.use((req, res) => {
  res.status(404).send('Halaman tidak ditemukan.');
});

app.use((error, req, res, next) => {
  console.error('Request gagal:', error.message);
  if (res.headersSent) return next(error);
  return res.status(500).send('Terjadi kesalahan server.');
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
  });
}

module.exports = app;
