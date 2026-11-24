const mysql = require('mysql2/promise');

if (process.env.NODE_ENV === 'production') {
  const variabelWajib = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const belumDiatur = variabelWajib.filter((nama) => !process.env[nama]);
  if (belumDiatur.length) {
    console.error(`Peringatan: Environment database production belum lengkap: ${belumDiatur.join(', ')}.`);
  }
}

// Pool dipakai bersama agar koneksi bisa digunakan ulang oleh model.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'penyewaan_lapangan',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || (process.env.NODE_ENV === 'production' ? 3 : 10)),
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ssl: process.env.DB_SSL === 'true'
    ? {
        rejectUnauthorized: false,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } : {})
      }
    : undefined
});

pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err.message);
});

module.exports = pool;
