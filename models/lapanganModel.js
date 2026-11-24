const pool = require('../config/db');

async function daftarSemua() {
  const [baris] = await pool.execute(
    `SELECT l.id, l.nama, l.jenis_id, j.nama AS jenis_nama, l.gambar,
            l.jam_buka, l.jam_tutup, l.jam_mulai_lampu, l.status
     FROM lapangan l
     JOIN jenis_lapangan j ON j.id = l.jenis_id
     ORDER BY l.nama ASC`
  );
  return baris;
}

async function daftarAktif({ jenisId, lapanganId }) {
  let sql = `SELECT l.id, l.nama, l.jenis_id, j.nama AS jenis_nama, l.gambar,
                    l.jam_buka, l.jam_tutup, l.jam_mulai_lampu, l.status
             FROM lapangan l
             JOIN jenis_lapangan j ON j.id = l.jenis_id
             WHERE l.status = 'aktif'`;
  const nilai = [];

  if (jenisId) {
    sql += ' AND l.jenis_id = ?';
    nilai.push(jenisId);
  }
  if (lapanganId) {
    sql += ' AND l.id = ?';
    nilai.push(lapanganId);
  }

  sql += ' ORDER BY l.nama ASC';
  const [baris] = await pool.execute(sql, nilai);
  return baris;
}

async function daftarAktifUntukFilter() {
  const [baris] = await pool.execute(
    "SELECT id, nama, jenis_id FROM lapangan WHERE status = 'aktif' ORDER BY nama ASC"
  );
  return baris;
}

async function buat({ nama, jenisId, gambar, jamBuka, jamTutup, jamMulaiLampu, status }) {
  const [hasil] = await pool.execute(
    `INSERT INTO lapangan (nama, jenis_id, gambar, jam_buka, jam_tutup, jam_mulai_lampu, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nama, jenisId, gambar, jamBuka, jamTutup, jamMulaiLampu, status]
  );
  return hasil.insertId;
}

async function ubah(id, { nama, jenisId, gambar, jamBuka, jamTutup, jamMulaiLampu, status }) {
  await pool.execute(
    `UPDATE lapangan
     SET nama = ?, jenis_id = ?, gambar = ?, jam_buka = ?, jam_tutup = ?, jam_mulai_lampu = ?, status = ?
     WHERE id = ?`,
    [nama, jenisId, gambar, jamBuka, jamTutup, jamMulaiLampu, status, id]
  );
}

async function hapus(id) {
  await pool.execute('DELETE FROM lapangan WHERE id = ?', [id]);
}

module.exports = { daftarSemua, daftarAktif, daftarAktifUntukFilter, buat, ubah, hapus };
