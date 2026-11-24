function cekRole(roleDiperlukan) {
  const daftarRole = Array.isArray(roleDiperlukan) ? roleDiperlukan : [roleDiperlukan];

  return (req, res, next) => {
    if (!req.session.pengguna || !daftarRole.includes(req.session.pengguna.role)) {
      return res.status(403).render('pesan', {
        judul: 'Akses ditolak',
        pesan: 'Akun ini tidak memiliki akses ke halaman tersebut.'
      });
    }

    next();
  };
}

module.exports = cekRole;
