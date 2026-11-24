# MainYuk — Penyewaan Lapangan

Aplikasi web untuk ujian praktik SMK RPL. Aplikasi menggunakan Node.js, Express, EJS, MySQL (`mysql2/promise`), dan Tailwind CSS CLI. Struktur MVC dibuat manual; query SQL berada di folder `models/`.

## Persiapan

- Node.js 18 atau lebih baru.
- MySQL 8 atau lebih baru, berjalan di komputer lokal.
- MySQL Workbench atau MySQL command-line client untuk menjalankan `skema.sql`.

## Instalasi dan menjalankan

1. Buka terminal di folder proyek, lalu pasang dependency:

   ```powershell
   npm.cmd install
   ```

2. Salin `.env.example` menjadi `.env`. Isi host, port, username, password MySQL, dan nama database. Ganti juga `SESSION_SECRET` dengan string acak yang panjang. File `.env` lokal tidak masuk Git.

3. Jalankan `skema.sql` menggunakan MySQL Workbench, atau dari PowerShell yang memiliki MySQL CLI:

   ```powershell
   Get-Content .\skema.sql | mysql -u root -p
   ```

   Skrip membuat database `penyewaan_lapangan` dan enam tabel aplikasi.

4. Masukkan data contoh:

   ```powershell
   npm.cmd run seed
   ```

5. Bangun CSS Tailwind lokal:

   ```powershell
   npm.cmd run css:build
   ```

6. Jalankan aplikasi:

   ```powershell
   npm.cmd start
   ```

7. Buka `http://localhost:3000`. Saat mengubah EJS atau Tailwind, jalankan `npm.cmd run css:watch` di terminal lain. `npm.cmd run dev` menjalankan server dengan mode watch.

## Akun contoh

Semua akun dan nomor HP di seed adalah data dummy. Password di database disimpan menggunakan bcrypt.

| Role | Username | Password |
| --- | --- | --- |
| Penyewa | `penyewa1` | `SewaLapangan123!` |
| Penyewa | `penyewa2` | `SewaLapangan123!` |
| Petugas | `petugas1` | `Petugas123!` |
| Admin | `admin1` | `Admin123!` |

## Halaman aplikasi

- Penyewa: `/jadwal`, `/jadwal/mingguan`, `/booking/baru`, `/riwayat`, dan `/booking/:id/bukti` (tersedia unduhan PDF).
- Petugas: `/jadwal`, `/jadwal/mingguan`, `/petugas/booking`, `/petugas/booking/baru`, dan `/petugas/penyewa/baru` untuk mencatat penyewa walk-in tanpa pendaftaran mandiri.
- Admin: `/admin/jenis`, `/admin/lapangan`, `/admin/tarif`, `/admin/user`, `/admin/rekap`, dan `/admin/audit`.
- Pendaftaran publik selalu membuat akun dengan role `penyewa`.

Session disimpan di MySQL agar tetap berlaku saat proses server dimulai ulang. Aplikasi membuat tabel `sessions` secara otomatis; user database perlu izin membuat tabel.

## Deploy ke Vercel

1. Push repository ke GitHub, lalu import repository tersebut dari dashboard Vercel.
2. Atur Framework Preset ke Express jika terdeteksi, atau Other. Konfigurasi `vercel.json` menjalankan `npm run css:build` dan menyertakan template EJS; biarkan Output Directory kosong.
3. Hubungkan aplikasi ke MySQL managed yang dapat menerima koneksi dari Vercel. Jalankan `skema.sql` pada database tersebut. Pastikan user database dapat membuat tabel `sessions`.
4. Tambahkan environment variables berikut di Vercel (Production, dan Preview jika diperlukan):

   ```text
   DB_HOST
   DB_PORT
   DB_USER
   DB_PASSWORD
   DB_NAME
   DB_CONNECTION_LIMIT=3
   DB_SSL=true
   SESSION_SECRET
   NODE_ENV=production
   ```

   Jika provider database memberikan CA certificate, tambahkan `DB_SSL_CA` dengan isi certificate tersebut. Jangan menaruh kredensial produksi di repository.
5. Di project Vercel, buka Storage dan buat Vercel Blob store dengan akses Public. Hubungkan store ke project dan environment Production. Vercel akan menyediakan kredensial Blob untuk aplikasi.
6. Deploy, lalu uji halaman utama, login, booking, upload gambar admin, dan hapus/ubah gambar. Gambar yang diunggah di Vercel disimpan di Blob; pengembangan lokal tanpa Blob tetap menyimpan file di `public/uploads`.

Jangan gunakan akun seed bawaan untuk website publik. Ganti password demo atau buat akun admin dengan password unik sebelum membuka aplikasi ke pengguna.

## Skenario uji demo

1. **Role pendaftaran** — daftar akun baru, lalu periksa tabel `users`; role harus `penyewa` dan password harus berupa hash.
2. **Akses halaman** — tanpa login, buka `/jadwal` dan `/admin/jenis`; keduanya mengarahkan ke `/login`. Masuk sebagai penyewa lalu buka `/admin/jenis`; akses ditolak.
3. **Filter jadwal** — sebagai penyewa atau petugas, pilih tanggal, jenis, dan lapangan. Pastikan gambar/fallback, jam operasional, tanda lampu, tarif, dan slot per jam tampil. Dari halaman jadwal mingguan, pilih lapangan dan tanggal awal; tujuh hari slot lapangan itu tampil dalam satu tabel.
4. **Booking berhasil** — pilih lapangan aktif, tanggal yang belum lewat, lalu booking jam `08:00–10:00`. Pastikan status awal `menunggu_pembayaran`, kode booking terbentuk, durasi dan total tersimpan, serta audit `booking` tercatat.
5. **Booking bentrok yang harus ditolak** — pada lapangan dan tanggal yang sama, buat booking `08:00–10:00`, lalu coba booking kedua `09:00–11:00`. Booking kedua harus ditolak dengan pesan bentrok dan jumlah data booking tidak bertambah.
6. **Batas slot** — setelah booking `08:00–10:00`, booking `10:00–11:00` harus dapat dibuat karena jamnya tepat berdampingan. Coba juga tanggal lampau, lapangan nonaktif, dan jam di luar operasional; semuanya harus ditolak.
7. **Alur petugas** — sebagai petugas, buat booking atas nama penyewa; ubah booking `menunggu_pembayaran` menjadi `dibayar`, lalu `selesai`. Pastikan booking menunggu atau dibayar dapat dibatalkan petugas, sementara booking selesai tidak dapat dibatalkan.
8. **Batas pembatalan penyewa** — penyewa dapat membatalkan booking miliknya yang menunggu pembayaran. Pastikan penyewa tidak dapat membatalkan booking yang sudah dibayar atau milik pengguna lain.
9. **CRUD admin dan upload** — tambah, ubah, dan hapus jenis/lapangan/tarif/pengguna. Upload JPG/PNG di bawah 2 MB harus diterima; format lain dan gambar di atas 2 MB harus ditolak.
10. **Rekap dan audit** — rekap hanya menghitung status `dibayar` dan `selesai`. Unduh Excel, lalu periksa audit log mencatat aksi `ekspor`. Uji pencarian, pengurutan, dan pagination di daftar booking serta audit.
11. **Bukti booking** — buka bukti booking, unduh PDF, lalu gunakan tombol cetak. PDF memuat kode, status, penyewa, lapangan, waktu, dan total biaya. Navbar, footer, dan tombol cetak tidak ikut tercetak.
12. **Penyewa walk-in** — sebagai petugas, tambah penyewa dengan nama dan nomor HP. Pastikan form booking terbuka dengan penyewa baru terpilih, tanpa meminta penyewa membuat username atau password.

Untuk mengulang seed pada database yang sudah dipakai, seed tidak menghapus booking lama. Gunakan database demo baru bila ingin mengulang skenario dari kondisi kosong.
