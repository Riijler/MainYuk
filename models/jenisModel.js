const pool = require('../config/db');

async function daftarSemua() {
  const [baris] = await pool.execute('SELECT id, nama FROM jenis_lapangan ORDER BY nama ASC');
  return baris;
}

async function buat(nama) {
  const [hasil] = await pool.execute('INSERT INTO jenis_lapangan (nama) VALUES (?)', [nama]);
  return hasil.insertId;
}

async function ubah(id, nama) {
  await pool.execute('UPDATE jenis_lapangan SET nama = ? WHERE id = ?', [nama, id]);
}

async function hapus(id) {
  await pool.execute('DELETE FROM jenis_lapangan WHERE id = ?', [id]);
}

module.exports = { daftarSemua, buat, ubah, hapus };
