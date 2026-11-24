const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BATAS_PER_HALAMAN = 10;

function nilaiKembali(body) {
  const lapanganId = /^\d+$/.test(String(body.lapangan_id || '')) ? String(body.lapangan_id) : '';
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal || '')) ? String(body.tanggal) : '';
  const jamMulai = /^(?:[01]\d|2[0-3]):00$/.test(String(body.jam_mulai || '')) ? String(body.jam_mulai) : '';
  return { lapanganId, tanggal, jamMulai };
}

function tampilkanFormPenyewa(res, { nama = '', noHp = '', pesanError = null, nilai = {} } = {}, status = 200) {
  res.status(status).render('petugas/penyewa-form', { judul: 'Tambah penyewa', nama, noHp, pesanError, nilai });
}

function formBookingPenyewaBaru(id, nilai) {
  const kueri = new URLSearchParams({ user_id: String(id), penyewa_baru: '1' });
  if (nilai.lapanganId) kueri.set('lapangan_id', nilai.lapanganId);
  if (nilai.tanggal) kueri.set('tanggal', nilai.tanggal);
  if (nilai.jamMulai) kueri.set('jam_mulai', nilai.jamMulai);
  return `/petugas/booking/baru?${kueri.toString()}`;
}

function tambahPenyewa(req, res) {
  tampilkanFormPenyewa(res, { nilai: nilaiKembali(req.query) });
}

function tanggalValid(tanggal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const nilaiTanggal = new Date(`${tanggal}T00:00:00Z`);
  return Number.isFinite(nilaiTanggal.getTime()) && nilaiTanggal.toISOString().slice(0, 10) === tanggal;
}

async function daftarJamTerisi(req, res) {
  const lapanganId = Number(req.query.lapangan_id);
  const tanggal = String(req.query.tanggal || '');
  if (!Number.isInteger(lapanganId) || lapanganId < 1 || !tanggalValid(tanggal)) {
    return res.status(400).json({ pesan: 'Lapangan atau tanggal tidak valid.' });
  }

  try {
    const daftarJam = await bookingModel.daftarJamTerisi(lapanganId, tanggal);
    res.json({ daftarJam });
  } catch (error) {
    console.error('Jam booking petugas gagal dimuat:', error.message);
    res.status(500).json({ pesan: 'Jadwal booking tidak dapat dimuat.' });
  }
}

async function simpanPenyewa(req, res) {
  const nama = String(req.body.nama || '').trim();
  const noHp = String(req.body.no_hp || '').trim();
  const nilai = nilaiKembali(req.body);
  let pesanError = null;

  if (!nama || nama.length > 100) pesanError = 'Nama wajib diisi dan maksimal 100 karakter.';
  else if (!/^\+?[0-9]{8,15}$/.test(noHp)) pesanError = 'Nomor HP harus terdiri dari 8–15 angka.';
  if (pesanError) return tampilkanFormPenyewa(res, { nama, noHp, nilai, pesanError }, 400);

  try {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 10);
    let id;
    for (let percobaan = 0; percobaan < 3; percobaan += 1) {
      const username = `tamu_${crypto.randomBytes(12).toString('hex')}`;
      try {
        id = await userModel.buatPenyewa({ nama, username, noHp, passwordHash });
        break;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || percobaan === 2) throw error;
      }
    }
    return res.redirect(formBookingPenyewaBaru(id, nilai));
  } catch (error) {
    console.error('Penyewa baru gagal disimpan:', error.message);
    return tampilkanFormPenyewa(res, { nama, noHp, nilai, pesanError: 'Data penyewa belum berhasil disimpan. Coba lagi.' }, 500);
  }
}

async function daftarBooking(req, res) {
  try {
    const cari = String(req.query.cari || '').trim().slice(0, 100);
    const urutanBoleh = ['dibuat', 'tanggal', 'kode', 'penyewa', 'lapangan', 'status', 'total'];
    const urut = urutanBoleh.includes(req.query.urut) ? req.query.urut : 'dibuat';
    const arah = req.query.arah === 'asc' ? 'asc' : 'desc';
    const jumlahBooking = await bookingModel.hitungSemuaBooking(cari);
    const jumlahHalaman = Math.max(1, Math.ceil(jumlahBooking / BATAS_PER_HALAMAN));
    const diminta = Number.parseInt(req.query.halaman, 10);
    const halaman = Number.isInteger(diminta) && diminta > 0 ? Math.min(diminta, jumlahHalaman) : 1;
    const daftarBooking = await bookingModel.daftarUntukPetugas(
      { limit: BATAS_PER_HALAMAN, offset: (halaman - 1) * BATAS_PER_HALAMAN, cari, urut, arah }
    );

    res.render('petugas/booking', {
      judul: 'Daftar booking', daftarBooking, halaman, jumlahHalaman,
      cari, urut, arah,
      pesan: typeof req.query.pesan === 'string' ? req.query.pesan : null
    });
  } catch (error) {
    console.error('Daftar booking petugas gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Booking belum tersedia', pesan: 'Daftar booking belum dapat dimuat.' });
  }
}

async function ubahStatus(req, res) {
  const statusBaru = String(req.body.status || '');
  const kembaliKeBukti = req.body.kembali === 'bukti';
  const alamatSetelahAksi = (pesan) => kembaliKeBukti
    ? `/booking/${encodeURIComponent(req.params.id)}/bukti?pesan=${encodeURIComponent(pesan)}`
    : `/petugas/booking?pesan=${encodeURIComponent(pesan)}`;
  if (!['dibayar', 'dibatalkan', 'selesai'].includes(statusBaru)) {
    return res.redirect(alamatSetelahAksi('Status booking tidak valid.'));
  }

  try {
    await bookingModel.ubahStatusOlehPetugas(req.params.id, statusBaru, req.session.pengguna.id);
    if (kembaliKeBukti && statusBaru === 'dibayar') {
      return res.redirect(`/booking/${encodeURIComponent(req.params.id)}/bukti?dibayar=1`);
    }
    res.redirect(alamatSetelahAksi('Status booking diperbarui.'));
  } catch (error) {
    const pesan = error.code === 'BOOKING_TIDAK_ADA'
      ? 'Booking tidak ditemukan.'
      : error.code === 'STATUS_TIDAK_VALID'
        ? 'Alur perubahan status tidak diizinkan.'
        : 'Status booking gagal diperbarui.';
    res.redirect(alamatSetelahAksi(pesan));
  }
}

module.exports = { daftarBooking, ubahStatus, tambahPenyewa, simpanPenyewa, daftarJamTerisi };
