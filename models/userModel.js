const pool = require('../config/db');

async function cariDenganUsername(username) {
  const [baris] = await pool.execute(
    'SELECT id, nama, username, password, role, no_hp FROM users WHERE username = ? LIMIT 1',
    [username]
  );

  return baris[0] || null;
}

async function buatPenyewa({ nama, username, passwordHash, noHp }) {
  const [hasil] = await pool.execute(
    `INSERT INTO users (nama, username, password, role, no_hp)
     VALUES (?, ?, ?, 'penyewa', ?)`,
    [nama, username, passwordHash, noHp]
  );

  return hasil.insertId;
}

async function daftarSemua() {
  const [baris] = await pool.execute(
    'SELECT id, nama, username, role, no_hp FROM users ORDER BY nama ASC'
  );
  return baris;
}

async function daftarPenyewa() {
  const [baris] = await pool.execute(
    "SELECT id, nama, username, no_hp FROM users WHERE role = 'penyewa' ORDER BY nama ASC"
  );
  return baris;
}

async function cariPenyewaDenganId(id) {
  const [baris] = await pool.execute(
    "SELECT id, nama, username FROM users WHERE id = ? AND role = 'penyewa' LIMIT 1",
    [id]
  );
  return baris[0] || null;
}

async function buatOlehAdmin({ nama, username, passwordHash, role, noHp }) {
  const [hasil] = await pool.execute(
    'INSERT INTO users (nama, username, password, role, no_hp) VALUES (?, ?, ?, ?, ?)',
    [nama, username, passwordHash, role, noHp]
  );
  return hasil.insertId;
}

async function ubahOlehAdmin(id, { nama, noHp, role, passwordHash }) {
  if (passwordHash) {
    await pool.execute(
      'UPDATE users SET nama = ?, no_hp = ?, role = ?, password = ? WHERE id = ?',
      [nama, noHp, role, passwordHash, id]
    );
    return;
  }

  await pool.execute(
    'UPDATE users SET nama = ?, no_hp = ?, role = ? WHERE id = ?',
    [nama, noHp, role, id]
  );
}

async function hapusOlehAdmin(id) {
  await pool.execute('DELETE FROM users WHERE id = ?', [id]);
}

module.exports = {
  cariDenganUsername, buatPenyewa, daftarSemua, daftarPenyewa, cariPenyewaDenganId,
  buatOlehAdmin, ubahOlehAdmin, hapusOlehAdmin
};
