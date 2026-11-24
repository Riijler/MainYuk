CREATE DATABASE IF NOT EXISTS penyewaan_lapangan
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE penyewaan_lapangan;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('penyewa', 'petugas', 'admin') NOT NULL DEFAULT 'penyewa',
  no_hp VARCHAR(15) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jenis_lapangan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lapangan (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  jenis_id INT UNSIGNED NOT NULL,
  gambar VARCHAR(255) NULL,
  jam_buka TIME NOT NULL DEFAULT '08:00:00',
  jam_tutup TIME NOT NULL DEFAULT '22:00:00',
  jam_mulai_lampu TIME NOT NULL DEFAULT '17:00:00',
  status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  CONSTRAINT fk_lapangan_jenis FOREIGN KEY (jenis_id) REFERENCES jenis_lapangan(id),
  UNIQUE KEY uq_lapangan_nama (nama)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tarif (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lapangan_id INT UNSIGNED NOT NULL,
  tipe_hari ENUM('weekday', 'weekend') NOT NULL,
  pakai_lampu TINYINT(1) NOT NULL DEFAULT 0,
  harga_per_jam DECIMAL(10,0) NOT NULL,
  CONSTRAINT fk_tarif_lapangan FOREIGN KEY (lapangan_id) REFERENCES lapangan(id),
  UNIQUE KEY uq_tarif_kombinasi (lapangan_id, tipe_hari, pakai_lampu)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kode_booking VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  lapangan_id INT UNSIGNED NOT NULL,
  tanggal DATE NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  durasi_jam INT NOT NULL,
  total_biaya DECIMAL(10,0) NOT NULL,
  status ENUM('menunggu_pembayaran', 'dibayar', 'selesai', 'dibatalkan') NOT NULL DEFAULT 'menunggu_pembayaran',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_booking_lapangan FOREIGN KEY (lapangan_id) REFERENCES lapangan(id),
  INDEX idx_booking_lapangan_tanggal (lapangan_id, tanggal)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  aksi ENUM('login', 'booking', 'bayar', 'batal', 'ekspor') NOT NULL,
  booking_id INT UNSIGNED NULL,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_booking FOREIGN KEY (booking_id) REFERENCES booking(id) ON DELETE SET NULL,
  INDEX idx_audit_waktu (waktu)
) ENGINE=InnoDB;
