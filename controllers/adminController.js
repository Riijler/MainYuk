const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { del } = require('@vercel/blob');
const jenisModel = require('../models/jenisModel');
const lapanganModel = require('../models/lapanganModel');
const tarifModel = require('../models/tarifModel');
const userModel = require('../models/userModel');
const { folderUnggahan } = require('../middleware/upload');

const daftarRole = ['penyewa', 'petugas', 'admin'];
const nilaiJam = (jam) => {
  const cocok = /^(\d{2}):(\d{2})$/.exec(String(jam || ''));
  return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : NaN;
};

async function hapusFile(namaFile) {
  if (!namaFile) return;
  if (/^https:\/\//i.test(namaFile)) {
    try {
      await del(namaFile);
    } catch (error) {
      console.error('Gagal menghapus gambar dari Vercel Blob:', error.message);
    }
    return;
  }

  const alamatFile = path.join(folderUnggahan, path.basename(namaFile));
  try {
    await fs.promises.unlink(alamatFile);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Gagal menghapus gambar lapangan:', error.message);
  }
}

function pesanDariQuery(req) {
  return typeof req.query.pesan === 'string' ? req.query.pesan : null;
}

async function daftarJenis(req, res) {
  try {
    res.render('admin/jenis', {
      judul: 'Kelola jenis lapangan',
      daftarJenis: await jenisModel.daftarSemua(),
      pesan: pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Gagal membaca jenis lapangan:', error.message);
    res.status(500).send('Data jenis lapangan tidak dapat dibaca.');
  }
}

async function tambahJenis(req, res) {
  const nama = String(req.body.nama || '').trim();
  if (!nama || nama.length > 50) return res.redirect('/admin/jenis?pesan=Nama%20jenis%20wajib%20diisi%20(maksimal%2050%20karakter).');

  try {
    await jenisModel.buat(nama);
    res.redirect('/admin/jenis?pesan=Jenis%20lapangan%20ditambahkan.');
  } catch (error) {
    const pesan = error.code === 'ER_DUP_ENTRY' ? 'Nama%20jenis%20sudah%20ada.' : 'Jenis%20gagal%20disimpan.';
    res.redirect(`/admin/jenis?pesan=${pesan}`);
  }
}

async function ubahJenis(req, res) {
  const nama = String(req.body.nama || '').trim();
  if (!nama || nama.length > 50) return res.redirect('/admin/jenis?pesan=Nama%20jenis%20tidak%20valid.');
  try {
    await jenisModel.ubah(req.params.id, nama);
    res.redirect('/admin/jenis?pesan=Jenis%20lapangan%20diperbarui.');
  } catch (error) {
    const pesan = error.code === 'ER_DUP_ENTRY' ? 'Nama%20jenis%20sudah%20ada.' : 'Jenis%20gagal%20diperbarui.';
    res.redirect(`/admin/jenis?pesan=${pesan}`);
  }
}

async function hapusJenis(req, res) {
  try {
    await jenisModel.hapus(req.params.id);
    res.redirect('/admin/jenis?pesan=Jenis%20lapangan%20dihapus.');
  } catch (error) {
    const pesan = error.code === 'ER_ROW_IS_REFERENCED_2'
      ? 'Jenis%20masih%20digunakan%20oleh%20lapangan.'
      : 'Jenis%20gagal%20dihapus.';
    res.redirect(`/admin/jenis?pesan=${pesan}`);
  }
}

async function daftarLapangan(req, res) {
  try {
    res.render('admin/lapangan', {
      judul: 'Kelola lapangan',
      daftarLapangan: await lapanganModel.daftarSemua(),
      pesan: pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Gagal membaca lapangan:', error.message);
    res.status(500).send('Data lapangan tidak dapat dibaca.');
  }
}

async function tampilkanFormLapangan(req, res) {
  const id = req.params.id;
  try {
    const semuaLapangan = id ? await lapanganModel.daftarSemua() : [];
    const lapangan = id ? semuaLapangan.find((baris) => baris.id === Number(id)) : null;
    if (id && !lapangan) return res.status(404).send('Lapangan tidak ditemukan.');

    res.render('admin/lapangan-form', {
      judul: id ? 'Ubah lapangan' : 'Tambah lapangan',
      daftarJenis: await jenisModel.daftarSemua(),
      lapangan,
      pesanError: null
    });
  } catch (error) {
    console.error('Gagal membuka form lapangan:', error.message);
    res.status(500).send('Form lapangan tidak dapat dibuka.');
  }
}

function dataFormLapangan(req, gambar) {
  return {
    nama: String(req.body.nama || '').trim(),
    jenisId: Number(req.body.jenis_id),
    gambar,
    jamBuka: String(req.body.jam_buka || ''),
    jamTutup: String(req.body.jam_tutup || ''),
    jamMulaiLampu: String(req.body.jam_mulai_lampu || ''),
    status: req.body.status
  };
}

async function validasiDataLapangan(data) {
  const jenis = await jenisModel.daftarSemua();
  const jenisValid = jenis.some((baris) => baris.id === data.jenisId);
  const buka = nilaiJam(data.jamBuka);
  const tutup = nilaiJam(data.jamTutup);
  const lampu = nilaiJam(data.jamMulaiLampu);

  if (!data.nama || data.nama.length > 100) return 'Nama lapangan wajib diisi dan maksimal 100 karakter.';
  if (!jenisValid) return 'Pilih jenis lapangan yang tersedia.';
  if (!['aktif', 'nonaktif'].includes(data.status)) return 'Status lapangan tidak valid.';
  if (!Number.isFinite(buka) || !Number.isFinite(tutup) || buka >= tutup) return 'Jam buka dan tutup tidak valid.';
  if (!Number.isFinite(lampu) || lampu < buka || lampu >= tutup) return 'Jam mulai lampu harus berada dalam jam operasional.';
  return null;
}

async function simpanLapangan(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  let lama = null;
  try {
    if (id) {
      lama = (await lapanganModel.daftarSemua()).find((baris) => baris.id === id);
      if (!lama) {
        await hapusFile(req.file && req.file.filename);
        return res.status(404).send('Lapangan tidak ditemukan.');
      }
    }

    if (req.pesanUpload) {
      return tampilkanUlangFormLapangan(req, res, id, lama, req.pesanUpload);
    }

    const hapusGambar = req.body.hapus_gambar === '1';
    const namaGambar = req.file ? req.file.filename : (hapusGambar ? null : (lama && lama.gambar));
    const data = dataFormLapangan(req, namaGambar || null);
    const pesanError = await validasiDataLapangan(data);
    if (pesanError) {
      await hapusFile(req.file && req.file.filename);
      return tampilkanUlangFormLapangan(req, res, id, lama, pesanError);
    }

    if (id) await lapanganModel.ubah(id, data);
    else await lapanganModel.buat(data);

    if (lama && (req.file || hapusGambar)) await hapusFile(lama.gambar);
    return res.redirect('/admin/lapangan?pesan=Data%20lapangan%20tersimpan.');
  } catch (error) {
    await hapusFile(req.file && req.file.filename);
    if (error.code === 'ER_DUP_ENTRY') {
      return tampilkanUlangFormLapangan(req, res, id, lama, 'Nama lapangan sudah digunakan.');
    }
    console.error('Gagal menyimpan lapangan:', error.message);
    return tampilkanUlangFormLapangan(req, res, id, lama, 'Data lapangan gagal disimpan.');
  }
}

async function tampilkanUlangFormLapangan(req, res, id, lama, pesanError) {
  res.status(400).render('admin/lapangan-form', {
    judul: id ? 'Ubah lapangan' : 'Tambah lapangan',
    daftarJenis: await jenisModel.daftarSemua(),
    pesanError,
    lapangan: {
      ...(lama || {}),
      nama: String(req.body.nama || (lama && lama.nama) || ''),
      jenis_id: Number(req.body.jenis_id || (lama && lama.jenis_id) || 0),
      jam_buka: req.body.jam_buka || (lama && lama.jam_buka) || '08:00:00',
      jam_tutup: req.body.jam_tutup || (lama && lama.jam_tutup) || '22:00:00',
      jam_mulai_lampu: req.body.jam_mulai_lampu || (lama && lama.jam_mulai_lampu) || '17:00:00',
      status: req.body.status || (lama && lama.status) || 'aktif'
    }
  });
}

async function hapusLapangan(req, res) {
  try {
    const lama = (await lapanganModel.daftarSemua()).find((baris) => baris.id === Number(req.params.id));
    if (!lama) return res.redirect('/admin/lapangan?pesan=Lapangan%20tidak%20ditemukan.');
    await lapanganModel.hapus(req.params.id);
    await hapusFile(lama.gambar);
    res.redirect('/admin/lapangan?pesan=Lapangan%20dihapus.');
  } catch (error) {
    const pesan = error.code === 'ER_ROW_IS_REFERENCED_2'
      ? 'Lapangan%20masih%20memiliki%20tarif%20atau%20booking.'
      : 'Lapangan%20gagal%20dihapus.';
    res.redirect(`/admin/lapangan?pesan=${pesan}`);
  }
}

async function daftarTarif(req, res) {
  try {
    const [daftarTarif, daftarLapangan] = await Promise.all([
      tarifModel.daftarSemua(), lapanganModel.daftarSemua()
    ]);
    res.render('admin/tarif', {
      judul: 'Kelola tarif', daftarTarif, daftarLapangan, pesan: pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Gagal membaca tarif:', error.message);
    res.status(500).send('Data tarif tidak dapat dibaca.');
  }
}

function dataFormTarif(body) {
  return {
    lapanganId: Number(body.lapangan_id),
    tipeHari: body.tipe_hari,
    pakaiLampu: body.pakai_lampu === '1' ? 1 : (body.pakai_lampu === '0' ? 0 : null),
    hargaPerJam: Number(body.harga_per_jam)
  };
}

function validasiDataTarif(data, daftarLapangan) {
  if (!daftarLapangan.some((baris) => baris.id === data.lapanganId)) return 'Pilih lapangan yang tersedia.';
  if (!['weekday', 'weekend'].includes(data.tipeHari)) return 'Tipe hari tidak valid.';
  if (![0, 1].includes(data.pakaiLampu)) return 'Pilihan lampu tidak valid.';
  if (!Number.isSafeInteger(data.hargaPerJam) || data.hargaPerJam < 1 || data.hargaPerJam > 9999999999) return 'Harga per jam harus berupa angka positif.';
  return null;
}

async function simpanTarif(req, res) {
  try {
    const daftarLapangan = await lapanganModel.daftarSemua();
    const data = dataFormTarif(req.body);
    const pesanError = validasiDataTarif(data, daftarLapangan);
    if (pesanError) return res.redirect(`/admin/tarif?pesan=${encodeURIComponent(pesanError)}`);

    if (req.params.id) await tarifModel.ubah(req.params.id, data);
    else await tarifModel.buat(data);
    res.redirect('/admin/tarif?pesan=Tarif%20tersimpan.');
  } catch (error) {
    const pesan = error.code === 'ER_DUP_ENTRY'
      ? 'Kombinasi%20tarif%20tersebut%20sudah%20ada.'
      : 'Tarif%20gagal%20disimpan.';
    res.redirect(`/admin/tarif?pesan=${pesan}`);
  }
}

async function hapusTarif(req, res) {
  try {
    await tarifModel.hapus(req.params.id);
    res.redirect('/admin/tarif?pesan=Tarif%20dihapus.');
  } catch (error) {
    res.redirect('/admin/tarif?pesan=Tarif%20gagal%20dihapus.');
  }
}

async function daftarUser(req, res) {
  try {
    res.render('admin/user', {
      judul: 'Kelola pengguna',
      daftarUser: await userModel.daftarSemua(),
      sessionPenggunaId: req.session.pengguna.id,
      pesan: pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Gagal membaca pengguna:', error.message);
    res.status(500).send('Data pengguna tidak dapat dibaca.');
  }
}

async function tampilkanFormUser(req, res) {
  try {
    const daftarUser = req.params.id ? await userModel.daftarSemua() : [];
    const pengguna = req.params.id ? daftarUser.find((baris) => baris.id === Number(req.params.id)) : null;
    if (req.params.id && !pengguna) return res.status(404).send('Pengguna tidak ditemukan.');
    res.render('admin/user-form', {
      judul: pengguna ? 'Ubah pengguna' : 'Tambah pengguna',
      pengguna, pesanError: null
    });
  } catch (error) {
    console.error('Gagal membuka form pengguna:', error.message);
    res.status(500).send('Form pengguna tidak dapat dibuka.');
  }
}

async function simpanUser(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  const data = {
    nama: String(req.body.nama || '').trim(),
    username: String(req.body.username || '').trim(),
    noHp: String(req.body.no_hp || '').trim(),
    role: req.body.role,
    password: String(req.body.password || '')
  };

  let pesanError = null;
  if (!data.nama || data.nama.length > 100) {
    pesanError = 'Nama wajib diisi dan maksimal 100 karakter.';
  } else if (!/^[a-zA-Z0-9_]{3,50}$/.test(data.username)) {
    pesanError = 'Username harus 3–50 karakter dan hanya berisi huruf, angka, garis bawah.';
  } else if (!/^\+?[0-9]{8,15}$/.test(data.noHp)) {
    pesanError = 'Nomor HP harus terdiri dari 8–15 angka.';
  } else if (!daftarRole.includes(data.role)) {
    pesanError = 'Pilih role yang tersedia.';
  } else if (!id && data.password.length < 8) {
    pesanError = 'Password minimal 8 karakter.';
  } else if (data.password && data.password.length > 72) {
    pesanError = 'Password maksimal 72 karakter.';
  }

  if (pesanError) return renderFormUserError(res, id, data, pesanError);

  try {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    if (id) {
      await userModel.ubahOlehAdmin(id, { ...data, passwordHash });
      return res.redirect('/admin/user?pesan=Pengguna%20diperbarui.');
    }
    await userModel.buatOlehAdmin({ ...data, passwordHash });
    return res.redirect('/admin/user?pesan=Pengguna%20ditambahkan.');
  } catch (error) {
    const pesan = error.code === 'ER_DUP_ENTRY'
      ? 'Username%20sudah%20digunakan.'
      : 'Data%20pengguna%20gagal%20disimpan.';
    return res.redirect(`/admin/user?pesan=${pesan}`);
  }
}

function renderFormUserError(res, id, data, pesanError) {
  return res.status(400).render('admin/user-form', {
    judul: id ? 'Ubah pengguna' : 'Tambah pengguna',
    pengguna: { ...data, no_hp: data.noHp },
    pesanError
  });
}

async function hapusUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.session.pengguna.id) {
    return res.redirect('/admin/user?pesan=Akun%20admin%20yang%20sedang%20dipakai%20tidak%20dapat%20dihapus.');
  }
  try {
    await userModel.hapusOlehAdmin(id);
    res.redirect('/admin/user?pesan=Pengguna%20dihapus.');
  } catch (error) {
    const pesan = error.code === 'ER_ROW_IS_REFERENCED_2'
      ? 'Pengguna%20masih%20terkait%20booking%20atau%20audit.'
      : 'Pengguna%20gagal%20dihapus.';
    res.redirect(`/admin/user?pesan=${pesan}`);
  }
}

module.exports = {
  daftarJenis, tambahJenis, ubahJenis, hapusJenis,
  daftarLapangan, tampilkanFormLapangan, simpanLapangan, hapusLapangan,
  daftarTarif, simpanTarif, hapusTarif,
  daftarUser, tampilkanFormUser, simpanUser, hapusUser
};
