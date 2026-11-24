const pool = require('../config/db');

async function catat({ userId, aksi, bookingId = null }) {
  await catatDenganKoneksi(pool, { userId, aksi, bookingId });
}

async function catatDenganKoneksi(koneksi, { userId, aksi, bookingId = null }) {
  await koneksi.execute(
    'INSERT INTO audit_log (user_id, aksi, booking_id) VALUES (?, ?, ?)',
    [userId, aksi, bookingId]
  );
}

function buatKondisiCari(cari) {
  if (!cari) return { kondisi: '', nilai: [] };
  const kata = `%${cari}%`;
  return {
    kondisi: 'WHERE u.nama LIKE ? OR u.username LIKE ? OR a.aksi LIKE ? OR b.kode_booking LIKE ?',
    nilai: [kata, kata, kata, kata]
  };
}

async function daftarDenganFilter({ limit, offset, cari = '', urut = 'waktu', arah = 'desc' }) {
  const kolomUrut = {
    waktu: 'a.waktu', pengguna: 'u.nama', aksi: 'a.aksi', kode: 'b.kode_booking'
  };
  const kolom = kolomUrut[urut] || kolomUrut.waktu;
  const arahSQL = arah === 'asc' ? 'ASC' : 'DESC';
  const filter = buatKondisiCari(cari);
  const [baris] = await pool.execute(
    `SELECT a.id, a.aksi, a.booking_id, a.waktu,
            u.nama AS pengguna_nama, u.username, b.kode_booking
     FROM audit_log a JOIN users u ON u.id = a.user_id
     LEFT JOIN booking b ON b.id = a.booking_id
     ${filter.kondisi}
     ORDER BY ${kolom} ${arahSQL}, a.id DESC LIMIT ? OFFSET ?`,
    [...filter.nilai, limit, offset]
  );
  return baris;
}

async function hitungDenganFilter(cari = '') {
  const filter = buatKondisiCari(cari);
  const [[hasil]] = await pool.execute(
    `SELECT COUNT(*) AS jumlah FROM audit_log a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN booking b ON b.id = a.booking_id
     ${filter.kondisi}`,
    filter.nilai
  );
  return Number(hasil.jumlah);
}

module.exports = { catat, catatDenganKoneksi, daftarDenganFilter, hitungDenganFilter };
