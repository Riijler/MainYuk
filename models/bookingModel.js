const crypto = require('crypto');
const pool = require('../config/db');
const tarifModel = require('./tarifModel');
const auditModel = require('./auditModel');

function menitDariJam(jam) {
  const cocok = /^(\d{2}):(\d{2})/.exec(String(jam || ''));
  return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : NaN;
}

function tanggalHariIni() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function kodeBookingBaru() {
  const tanggal = tanggalHariIni().replaceAll('-', '');
  const nomor = String(crypto.randomInt(0, 1000)).padStart(3, '0');
  return `BK-${tanggal}-${nomor}`;
}

async function adaBentrok({ lapanganId, tanggal, jamMulai, jamSelesai }, koneksi = pool) {
  const [baris] = await koneksi.execute(
    `SELECT id FROM booking
     WHERE lapangan_id = ? AND tanggal = ? AND status <> 'dibatalkan'
       AND jam_mulai < ? AND jam_selesai > ?
     FOR UPDATE`,
    [lapanganId, tanggal, jamSelesai, jamMulai]
  );
  return baris.length > 0;
}

async function buatAman({ userId, actorId = userId, lapanganId, tanggal, jamMulai, jamSelesai }) {
  const koneksi = await pool.getConnection();

  try {
    await koneksi.beginTransaction();

    // Kunci baris lapangan agar dua booking serentak pada lapangan yang sama bergiliran.
    const [barisLapangan] = await koneksi.execute(
      `SELECT id, jam_buka, jam_tutup, jam_mulai_lampu, status
       FROM lapangan WHERE id = ? FOR UPDATE`,
      [lapanganId]
    );
    const lapangan = barisLapangan[0];
    if (!lapangan) {
      const error = new Error('Lapangan tidak ditemukan.');
      error.code = 'LAPANGAN_TIDAK_ADA';
      throw error;
    }
    if (lapangan.status !== 'aktif') {
      const error = new Error('Lapangan sedang tidak aktif.');
      error.code = 'LAPANGAN_NONAKTIF';
      throw error;
    }

    const tanggalUji = new Date(`${tanggal}T00:00:00Z`);
    const tanggalValid = /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
      && Number.isFinite(tanggalUji.getTime())
      && tanggalUji.toISOString().slice(0, 10) === tanggal;
    if (!tanggalValid || tanggal < tanggalHariIni()) {
      const error = new Error('Tanggal booking sudah lewat atau tidak valid.');
      error.code = 'TANGGAL_LEWAT';
      throw error;
    }

    const mulai = menitDariJam(jamMulai);
    const selesai = menitDariJam(jamSelesai);
    const buka = menitDariJam(lapangan.jam_buka);
    const tutup = menitDariJam(lapangan.jam_tutup);
    if (!Number.isFinite(mulai) || !Number.isFinite(selesai) || selesai <= mulai || mulai % 60 !== 0 || (selesai - mulai) % 60 !== 0) {
      const error = new Error('Jam selesai harus setelah jam mulai dan durasi berupa jam penuh.');
      error.code = 'JAM_TIDAK_VALID';
      throw error;
    }
    if (mulai < buka || selesai > tutup) {
      const error = new Error('Waktu booking berada di luar jam operasional lapangan.');
      error.code = 'JAM_DI_LUAR_OPERASIONAL';
      throw error;
    }

    if (await adaBentrok({ lapanganId, tanggal, jamMulai, jamSelesai }, koneksi)) {
      const error = new Error('Jadwal bertabrakan dengan booking lain. Pilih waktu yang berbeda.');
      error.code = 'ADA_BENTROK';
      throw error;
    }

    const ringkasan = await tarifModel.hitungTotal({
      lapanganId, tanggal, jamMulai, jamSelesai, jamMulaiLampu: lapangan.jam_mulai_lampu
    }, koneksi);

    let hasilSimpan;
    for (let percobaan = 0; percobaan < 5; percobaan += 1) {
      try {
        [hasilSimpan] = await koneksi.execute(
          `INSERT INTO booking
             (kode_booking, user_id, lapangan_id, tanggal, jam_mulai, jam_selesai, durasi_jam, total_biaya, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_pembayaran')`,
          [kodeBookingBaru(), userId, lapanganId, tanggal, jamMulai, jamSelesai, ringkasan.durasiJam, ringkasan.totalBiaya]
        );
        break;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || percobaan === 4) throw error;
      }
    }

    await auditModel.catatDenganKoneksi(koneksi, {
      userId: actorId, aksi: 'booking', bookingId: hasilSimpan.insertId
    });
    await koneksi.commit();
    return { id: hasilSimpan.insertId, ...ringkasan };
  } catch (error) {
    await koneksi.rollback();
    throw error;
  } finally {
    koneksi.release();
  }
}

async function daftarUntukJadwal(tanggal) {
  const [baris] = await pool.execute(
    `SELECT lapangan_id, jam_mulai, jam_selesai, status
     FROM booking
     WHERE tanggal = ? AND status <> 'dibatalkan'
     ORDER BY jam_mulai ASC`,
    [tanggal]
  );
  return baris;
}

async function daftarJamTerisi(lapanganId, tanggal) {
  const [baris] = await pool.execute(
    `SELECT jam_mulai, jam_selesai
     FROM booking
     WHERE lapangan_id = ? AND tanggal = ? AND status <> 'dibatalkan'
     ORDER BY jam_mulai ASC`,
    [lapanganId, tanggal]
  );
  return baris;
}

async function daftarUntukRentangJadwal(lapanganId, tanggalMulai, tanggalSelesai) {
  const [baris] = await pool.execute(
    `SELECT tanggal, lapangan_id, jam_mulai, jam_selesai, status
     FROM booking
     WHERE lapangan_id = ? AND tanggal BETWEEN ? AND ? AND status <> 'dibatalkan'
     ORDER BY tanggal ASC, jam_mulai ASC`,
    [lapanganId, tanggalMulai, tanggalSelesai]
  );
  return baris;
}

async function hitungRiwayat(userId) {
  const [[hasil]] = await pool.execute('SELECT COUNT(*) AS jumlah FROM booking WHERE user_id = ?', [userId]);
  return Number(hasil.jumlah);
}

async function daftarRiwayat(userId, limit, offset) {
  const [baris] = await pool.execute(
    `SELECT b.id, b.kode_booking, b.tanggal, b.jam_mulai, b.jam_selesai,
            b.durasi_jam, b.total_biaya, b.status, b.created_at,
            l.nama AS lapangan_nama, j.nama AS jenis_nama
     FROM booking b
     JOIN lapangan l ON l.id = b.lapangan_id
     JOIN jenis_lapangan j ON j.id = l.jenis_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
  return baris;
}

async function cariBukti(id) {
  const [baris] = await pool.execute(
    `SELECT b.id, b.kode_booking, b.user_id, b.lapangan_id, b.tanggal, b.jam_mulai,
            b.jam_selesai, b.durasi_jam, b.total_biaya, b.status, b.created_at,
            u.nama AS penyewa_nama, u.username AS penyewa_username,
            l.nama AS lapangan_nama, l.gambar, j.nama AS jenis_nama
     FROM booking b
     JOIN users u ON u.id = b.user_id
     JOIN lapangan l ON l.id = b.lapangan_id
     JOIN jenis_lapangan j ON j.id = l.jenis_id
     WHERE b.id = ? LIMIT 1`,
    [id]
  );
  return baris[0] || null;
}

async function batalkanPenyewa(id, userId) {
  const koneksi = await pool.getConnection();
  try {
    await koneksi.beginTransaction();
    const [baris] = await koneksi.execute(
      'SELECT id, status FROM booking WHERE id = ? AND user_id = ? FOR UPDATE',
      [id, userId]
    );
    const booking = baris[0];
    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.code = 'BOOKING_TIDAK_ADA';
      throw error;
    }
    if (booking.status !== 'menunggu_pembayaran') {
      const error = new Error('Penyewa hanya dapat membatalkan booking yang menunggu pembayaran.');
      error.code = 'STATUS_TIDAK_VALID';
      throw error;
    }
    await koneksi.execute("UPDATE booking SET status = 'dibatalkan' WHERE id = ?", [id]);
    await auditModel.catatDenganKoneksi(koneksi, { userId, aksi: 'batal', bookingId: id });
    await koneksi.commit();
  } catch (error) {
    await koneksi.rollback();
    throw error;
  } finally {
    koneksi.release();
  }
}

async function daftarUntukPetugas({ limit, offset, cari = '', urut = 'dibuat', arah = 'desc' }) {
  const kolomUrut = {
    dibuat: 'b.created_at', tanggal: 'b.tanggal', kode: 'b.kode_booking',
    penyewa: 'u.nama', lapangan: 'l.nama', status: 'b.status', total: 'b.total_biaya'
  };
  const kolom = kolomUrut[urut] || kolomUrut.dibuat;
  const arahSQL = arah === 'asc' ? 'ASC' : 'DESC';
  let kondisi = '';
  const nilai = [];
  if (cari) {
    kondisi = `WHERE b.kode_booking LIKE ? OR u.nama LIKE ? OR l.nama LIKE ? OR b.status LIKE ?`;
    const kata = `%${cari}%`;
    nilai.push(kata, kata, kata, kata);
  }

  const [baris] = await pool.execute(
    `SELECT b.id, b.kode_booking, b.tanggal, b.jam_mulai, b.jam_selesai,
            b.durasi_jam, b.total_biaya, b.status, b.created_at,
            u.nama AS penyewa_nama, l.nama AS lapangan_nama, j.nama AS jenis_nama
     FROM booking b
     JOIN users u ON u.id = b.user_id
     JOIN lapangan l ON l.id = b.lapangan_id
     JOIN jenis_lapangan j ON j.id = l.jenis_id
     ${kondisi}
     ORDER BY ${kolom} ${arahSQL}, b.id DESC LIMIT ? OFFSET ?`,
    [...nilai, limit, offset]
  );
  return baris;
}

async function hitungSemuaBooking(cari = '') {
  let kondisi = '';
  const nilai = [];
  if (cari) {
    kondisi = `WHERE b.kode_booking LIKE ? OR u.nama LIKE ? OR l.nama LIKE ? OR b.status LIKE ?`;
    const kata = `%${cari}%`;
    nilai.push(kata, kata, kata, kata);
  }
  const [[hasil]] = await pool.execute(
    `SELECT COUNT(*) AS jumlah FROM booking b
     JOIN users u ON u.id = b.user_id JOIN lapangan l ON l.id = b.lapangan_id ${kondisi}`,
    nilai
  );
  return Number(hasil.jumlah);
}

async function rekapPendapatan({ tanggalMulai, tanggalSelesai, lapanganId = null, limit = null, offset = 0 }) {
  let kondisi = `WHERE b.tanggal BETWEEN ? AND ? AND b.status IN ('dibayar', 'selesai')`;
  const nilai = [tanggalMulai, tanggalSelesai];
  if (lapanganId) {
    kondisi += ' AND b.lapangan_id = ?';
    nilai.push(lapanganId);
  }
  let sqlDaftar =
    `SELECT b.kode_booking, b.tanggal, b.jam_mulai, b.jam_selesai,
            b.durasi_jam, b.total_biaya, b.status,
            u.nama AS penyewa_nama, l.nama AS lapangan_nama
     FROM booking b JOIN users u ON u.id = b.user_id JOIN lapangan l ON l.id = b.lapangan_id
     ${kondisi}
     ORDER BY b.tanggal DESC, b.jam_mulai ASC`;
  const nilaiDaftar = [...nilai];
  if (Number.isInteger(limit) && limit > 0) {
    sqlDaftar += ' LIMIT ? OFFSET ?';
    nilaiDaftar.push(limit, offset);
  }
  const [daftar] = await pool.execute(sqlDaftar, nilaiDaftar);
  const [[ringkasan]] = await pool.execute(
    `SELECT COUNT(*) AS jumlah_booking, COALESCE(SUM(b.total_biaya), 0) AS total_pendapatan
     FROM booking b ${kondisi}`,
    nilai
  );
  return {
    daftar,
    jumlahBooking: Number(ringkasan.jumlah_booking),
    totalPendapatan: Number(ringkasan.total_pendapatan)
  };
}

async function ubahStatusOlehPetugas(id, statusBaru, userId) {
  const koneksi = await pool.getConnection();
  try {
    await koneksi.beginTransaction();
    const [baris] = await koneksi.execute('SELECT status FROM booking WHERE id = ? FOR UPDATE', [id]);
    const booking = baris[0];
    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.code = 'BOOKING_TIDAK_ADA';
      throw error;
    }

    const boleh = (booking.status === 'menunggu_pembayaran' && ['dibayar', 'dibatalkan'].includes(statusBaru))
      || (booking.status === 'dibayar' && ['selesai', 'dibatalkan'].includes(statusBaru));
    if (!boleh) {
      const error = new Error('Perubahan status booking tidak sesuai alur.');
      error.code = 'STATUS_TIDAK_VALID';
      throw error;
    }

    await koneksi.execute('UPDATE booking SET status = ? WHERE id = ?', [statusBaru, id]);
    const aksi = statusBaru === 'dibayar' ? 'bayar' : (statusBaru === 'dibatalkan' ? 'batal' : null);
    if (aksi) await auditModel.catatDenganKoneksi(koneksi, { userId, aksi, bookingId: id });
    await koneksi.commit();
  } catch (error) {
    await koneksi.rollback();
    throw error;
  } finally {
    koneksi.release();
  }
}

module.exports = {
  adaBentrok, buatAman, daftarUntukJadwal, daftarJamTerisi, daftarUntukRentangJadwal, hitungRiwayat, daftarRiwayat, cariBukti,
  batalkanPenyewa, daftarUntukPetugas, hitungSemuaBooking, rekapPendapatan, ubahStatusOlehPetugas
};
