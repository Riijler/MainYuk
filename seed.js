require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./config/db');

const akunContoh = [
  { nama: 'Siti Contoh', username: 'penyewa1', password: 'SewaLapangan123!', role: 'penyewa', no_hp: '081234560001' },
  { nama: 'Budi Contoh', username: 'penyewa2', password: 'SewaLapangan123!', role: 'penyewa', no_hp: '081234560002' },
  { nama: 'Rina Petugas', username: 'petugas1', password: 'Petugas123!', role: 'petugas', no_hp: '081234560003' },
  { nama: 'Ari Admin', username: 'admin1', password: 'Admin123!', role: 'admin', no_hp: '081234560004' }
];

const daftarJenis = ['sepak bola', 'mini soccer', 'futsal', 'voli', 'tennis', 'padel', 'badminton'];

function tanggalFormat(tanggal) {
  return [tanggal.getFullYear(), String(tanggal.getMonth() + 1).padStart(2, '0'), String(tanggal.getDate()).padStart(2, '0')].join('-');
}

function tambahHari(jumlahHari) {
  const tanggal = new Date();
  tanggal.setHours(0, 0, 0, 0);
  tanggal.setDate(tanggal.getDate() + jumlahHari);
  return tanggalFormat(tanggal);
}

async function isiDataContoh() {
  const koneksi = await pool.getConnection();

  try {
    await koneksi.beginTransaction();

    for (const jenis of daftarJenis) {
      await koneksi.execute('INSERT INTO jenis_lapangan (nama) VALUES (?) ON DUPLICATE KEY UPDATE nama = VALUES(nama)', [jenis]);
    }

    for (const akun of akunContoh) {
      const passwordHash = await bcrypt.hash(akun.password, 10);
      await koneksi.execute(
        `INSERT INTO users (nama, username, password, role, no_hp)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama = VALUES(nama), password = VALUES(password), role = VALUES(role), no_hp = VALUES(no_hp)`,
        [akun.nama, akun.username, passwordHash, akun.role, akun.no_hp]
      );
    }

    const lapanganContoh = [
      { nama: 'Lapangan Sepak Bola Utama', jenis: 'sepak bola', dasar: 350000 },
      { nama: 'Lapangan Futsal A', jenis: 'futsal', dasar: 100000 },
      { nama: 'Lapangan Mini Soccer', jenis: 'mini soccer', dasar: 250000 },
      { nama: 'Lapangan Voli Indoor', jenis: 'voli', dasar: 80000 },
      { nama: 'Lapangan Tenis Outdoor', jenis: 'tennis', dasar: 120000 },
      { nama: 'Lapangan Padel 1', jenis: 'padel', dasar: 200000 },
      { nama: 'Lapangan Badminton 1', jenis: 'badminton', dasar: 60000 }
    ];

    for (const data of lapanganContoh) {
      const [[jenis]] = await koneksi.execute('SELECT id FROM jenis_lapangan WHERE nama = ?', [data.jenis]);
      await koneksi.execute(
        `INSERT INTO lapangan (nama, jenis_id, gambar, jam_buka, jam_tutup, jam_mulai_lampu, status)
         VALUES (?, ?, NULL, '08:00:00', '22:00:00', '17:00:00', 'aktif')
         ON DUPLICATE KEY UPDATE nama = VALUES(nama)`,
        [data.nama, jenis.id]
      );
      const [[lapangan]] = await koneksi.execute('SELECT id FROM lapangan WHERE nama = ?', [data.nama]);

      for (const [tipeHari, pengali] of [['weekday', 1], ['weekend', 1.2]]) {
        for (const [pakaiLampu, tambahan] of [[0, 0], [1, 20000]]) {
          const harga = Math.round(data.dasar * pengali + tambahan);
          await koneksi.execute(
            `INSERT INTO tarif (lapangan_id, tipe_hari, pakai_lampu, harga_per_jam)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE harga_per_jam = VALUES(harga_per_jam)`,
            [lapangan.id, tipeHari, pakaiLampu, harga]
          );
        }
      }
    }

    // Contoh booking dibuat pada tanggal berbeda agar tidak saling bentrok.
    const contohBooking = [
      { username: 'penyewa1', lapangan: 'Lapangan Futsal A', hari: 2, mulai: '08:00:00', selesai: '10:00:00', status: 'menunggu_pembayaran', total: 200000, nomor: '001' },
      { username: 'penyewa2', lapangan: 'Lapangan Mini Soccer', hari: 3, mulai: '10:00:00', selesai: '12:00:00', status: 'dibayar', total: 500000, nomor: '002' },
      { username: 'penyewa1', lapangan: 'Lapangan Badminton 1', hari: -10, mulai: '14:00:00', selesai: '16:00:00', status: 'selesai', total: 120000, nomor: '003' },
      { username: 'penyewa2', lapangan: 'Lapangan Futsal A', hari: -5, mulai: '18:00:00', selesai: '20:00:00', status: 'dibatalkan', total: 240000, nomor: '004' }
    ];

    for (const data of contohBooking) {
      const tanggal = tambahHari(data.hari);
      const kode = `BK-${tanggal.replaceAll('-', '')}-${data.nomor}`;
      const [[pengguna]] = await koneksi.execute('SELECT id FROM users WHERE username = ?', [data.username]);
      const [[lapangan]] = await koneksi.execute('SELECT id FROM lapangan WHERE nama = ?', [data.lapangan]);
      await koneksi.execute(
        `INSERT INTO booking (kode_booking, user_id, lapangan_id, tanggal, jam_mulai, jam_selesai, durasi_jam, total_biaya, status)
         VALUES (?, ?, ?, ?, ?, ?, 2, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), total_biaya = VALUES(total_biaya)`,
        [kode, pengguna.id, lapangan.id, tanggal, data.mulai, data.selesai, data.total, data.status]
      );
    }

    await koneksi.commit();
    console.log('Data contoh berhasil dimasukkan.');
  } catch (error) {
    await koneksi.rollback();
    throw error;
  } finally {
    koneksi.release();
    await pool.end();
  }
}

isiDataContoh().catch((error) => {
  console.error('Seed gagal:', error.message);
  process.exitCode = 1;
});
