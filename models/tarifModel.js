const pool = require('../config/db');

function menitDariJam(jam) {
  const cocok = /^(\d{2}):(\d{2})/.exec(String(jam || ''));
  return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : NaN;
}

async function daftarSemua() {
  const [baris] = await pool.execute(
    `SELECT t.id, t.lapangan_id, l.nama AS lapangan_nama, t.tipe_hari,
            t.pakai_lampu, t.harga_per_jam
     FROM tarif t
     JOIN lapangan l ON l.id = t.lapangan_id
     ORDER BY l.nama ASC, t.tipe_hari ASC, t.pakai_lampu ASC`
  );
  return baris;
}

async function daftarUntukLapangan(daftarId) {
  if (daftarId.length === 0) return [];

  const tandaTanya = daftarId.map(() => '?').join(', ');
  const [baris] = await pool.execute(
    `SELECT lapangan_id, tipe_hari, pakai_lampu, harga_per_jam
     FROM tarif WHERE lapangan_id IN (${tandaTanya})`,
    daftarId
  );
  return baris;
}

async function buat({ lapanganId, tipeHari, pakaiLampu, hargaPerJam }) {
  const [hasil] = await pool.execute(
    'INSERT INTO tarif (lapangan_id, tipe_hari, pakai_lampu, harga_per_jam) VALUES (?, ?, ?, ?)',
    [lapanganId, tipeHari, pakaiLampu, hargaPerJam]
  );
  return hasil.insertId;
}

async function ubah(id, { lapanganId, tipeHari, pakaiLampu, hargaPerJam }) {
  await pool.execute(
    `UPDATE tarif SET lapangan_id = ?, tipe_hari = ?, pakai_lampu = ?, harga_per_jam = ?
     WHERE id = ?`,
    [lapanganId, tipeHari, pakaiLampu, hargaPerJam, id]
  );
}

async function hapus(id) {
  await pool.execute('DELETE FROM tarif WHERE id = ?', [id]);
}

async function hitungTotal({ lapanganId, tanggal, jamMulai, jamSelesai, jamMulaiLampu }, koneksi = pool) {
  const mulai = menitDariJam(jamMulai);
  const selesai = menitDariJam(jamSelesai);
  const mulaiLampu = menitDariJam(jamMulaiLampu);
  if (!Number.isFinite(mulai) || !Number.isFinite(selesai) || selesai <= mulai || mulai % 60 !== 0 || (selesai - mulai) % 60 !== 0) {
    const error = new Error('Rentang waktu booking harus berupa jam penuh.');
    error.code = 'JAM_TIDAK_VALID';
    throw error;
  }

  const hari = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
  const tipeHari = hari === 0 || hari === 6 ? 'weekend' : 'weekday';
  const [daftarHarga] = await koneksi.execute(
    'SELECT tipe_hari, pakai_lampu, harga_per_jam FROM tarif WHERE lapangan_id = ?',
    [lapanganId]
  );
  const hargaCocok = new Map(daftarHarga.map((tarif) => [
    `${tarif.tipe_hari}|${Number(tarif.pakai_lampu)}`,
    Number(tarif.harga_per_jam)
  ]));

  let total = 0;
  for (let jam = mulai; jam < selesai; jam += 60) {
    const pakaiLampu = jam >= mulaiLampu ? 1 : 0;
    const harga = hargaCocok.get(`${tipeHari}|${pakaiLampu}`);
    if (harga === undefined) {
      const error = new Error(`Tarif ${tipeHari} ${pakaiLampu ? 'dengan' : 'tanpa'} lampu belum diatur.`);
      error.code = 'TARIF_TIDAK_LENGKAP';
      throw error;
    }
    total += harga;
  }

  return { durasiJam: (selesai - mulai) / 60, totalBiaya: total };
}

module.exports = { daftarSemua, daftarUntukLapangan, buat, ubah, hapus, hitungTotal };
