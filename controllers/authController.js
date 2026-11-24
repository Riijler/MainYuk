const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');

const alamatDashboard = {
  penyewa: '/dashboard/penyewa',
  petugas: '/dashboard/petugas',
  admin: '/dashboard/admin'
};

function tampilkanLogin(req, res) {
  if (req.session.pengguna) {
    return res.redirect(alamatDashboard[req.session.pengguna.role]);
  }

  res.render('auth/login', {
    judul: 'Masuk',
    halamanAuth: 'login',
    pesanBerhasil: req.query.daftar ? 'Akun berhasil dibuat. Silakan masuk.' : null,
    nilai: {},
    pesanError: null
  });
}

function tampilkanDaftar(req, res) {
  if (req.session.pengguna) {
    return res.redirect(alamatDashboard[req.session.pengguna.role]);
  }

  res.render('auth/daftar', {
    judul: 'Daftar akun',
    halamanAuth: 'daftar',
    nilai: {},
    pesanError: null
  });
}

async function daftar(req, res) {
  const nilai = {
    nama: String(req.body.nama || '').trim(),
    username: String(req.body.username || '').trim(),
    noHp: String(req.body.no_hp || '').trim()
  };
  const password = String(req.body.password || '');
  const konfirmasiPassword = String(req.body.konfirmasi_password || '');

  if (!nilai.nama || nilai.nama.length > 100) {
    return tampilkanErrorDaftar(res, nilai, 'Nama wajib diisi dan maksimal 100 karakter.');
  }
  if (!/^[a-zA-Z0-9_]{3,50}$/.test(nilai.username)) {
    return tampilkanErrorDaftar(res, nilai, 'Username harus 3–50 karakter, hanya huruf, angka, atau garis bawah.');
  }
  if (!/^\+?[0-9]{8,15}$/.test(nilai.noHp)) {
    return tampilkanErrorDaftar(res, nilai, 'Nomor HP harus terdiri dari 8–15 angka.');
  }
  if (password.length < 8 || password.length > 72) {
    return tampilkanErrorDaftar(res, nilai, 'Password harus terdiri dari 8–72 karakter.');
  }
  if (password !== konfirmasiPassword) {
    return tampilkanErrorDaftar(res, nilai, 'Konfirmasi password belum sama.');
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await userModel.buatPenyewa({ ...nilai, passwordHash });
    return res.redirect('/login?daftar=berhasil');
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return tampilkanErrorDaftar(res, nilai, 'Username sudah digunakan. Silakan pilih username lain.');
    }

    console.error('Pendaftaran gagal:', error.message);
    return tampilkanErrorDaftar(res, nilai, 'Pendaftaran belum berhasil. Periksa koneksi database lalu coba lagi.');
  }
}

function tampilkanErrorDaftar(res, nilai, pesanError) {
  return res.status(400).render('auth/daftar', {
    judul: 'Daftar akun',
    halamanAuth: 'daftar',
    nilai,
    pesanError
  });
}

async function login(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).render('auth/login', {
      judul: 'Masuk', halamanAuth: 'login', nilai: { username },
      pesanError: 'Username dan password wajib diisi.', pesanBerhasil: null
    });
  }

  try {
    const pengguna = await userModel.cariDenganUsername(username);
    const cocok = pengguna && await bcrypt.compare(password, pengguna.password);

    if (!cocok) {
      return res.status(401).render('auth/login', {
        judul: 'Masuk', halamanAuth: 'login', nilai: { username },
        pesanError: 'Username atau password tidak cocok.', pesanBerhasil: null
      });
    }

    await auditModel.catat({ userId: pengguna.id, aksi: 'login' });

    // Ganti ID session sesudah login untuk mengurangi risiko session fixation.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.pengguna = {
      id: pengguna.id,
      nama: pengguna.nama,
      username: pengguna.username,
      role: pengguna.role
    };
    await new Promise((resolve, reject) => {
      req.session.save((error) => error ? reject(error) : resolve());
    });

    return res.redirect(alamatDashboard[pengguna.role]);
  } catch (error) {
    console.error('Login gagal:', error.message);
    return res.status(500).render('auth/login', {
      judul: 'Masuk', halamanAuth: 'login', nilai: { username },
      pesanError: 'Login belum berhasil. Periksa koneksi database lalu coba lagi.', pesanBerhasil: null
    });
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('penyewaan.sid');
    res.redirect('/');
  });
}

function lihatDashboard(req, res) {
  const pengguna = req.session.pengguna;
  const namaRole = {
    penyewa: 'Penyewa',
    petugas: 'Petugas',
    admin: 'Administrator'
  }[pengguna.role];

  res.render('dashboard', {
    judul: `Dashboard ${namaRole}`,
    namaRole
  });
}

module.exports = { tampilkanLogin, tampilkanDaftar, daftar, login, logout, lihatDashboard };
