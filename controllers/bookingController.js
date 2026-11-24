const lapanganModel = require('../models/lapanganModel');
const tarifModel = require('../models/tarifModel');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');

const BATAS_PER_HALAMAN = 10;

function tanggalHariIni() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function formatRupiah(nilai) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(nilai));
}

async function tampilkanForm(req, res, pesanError = null, nilai = {}, atasNamaPenyewa = false) {
  try {
    const semuaLapangan = await lapanganModel.daftarAktif({});
    const daftarPenyewa = atasNamaPenyewa ? await userModel.daftarPenyewa() : [];
    const daftarTarif = await tarifModel.daftarUntukLapangan(semuaLapangan.map((lapangan) => lapangan.id));
    const daftarLapangan = semuaLapangan.map((lapangan) => {
      const tarif = Object.fromEntries(daftarTarif
        .filter((baris) => baris.lapangan_id === lapangan.id)
        .map((baris) => [`${baris.tipe_hari}_${Number(baris.pakai_lampu)}`, Number(baris.harga_per_jam)]));
      return { ...lapangan, tarif };
    });

    res.render('booking/form', {
      judul: atasNamaPenyewa ? 'Booking atas nama penyewa' : 'Booking lapangan',
      daftarLapangan,
      daftarPenyewa,
      atasNamaPenyewa,
      pesanPenyewaBaru: req.query.penyewa_baru === '1',
      pesanError,
      nilai: {
        tanggal: nilai.tanggal || tanggalHariIni(),
        lapanganId: String(nilai.lapangan_id || nilai.lapanganId || (daftarLapangan[0] && daftarLapangan[0].id) || ''),
        jamMulai: nilai.jam_mulai || nilai.jamMulai || '',
        userId: String(nilai.user_id || nilai.userId || (daftarPenyewa[0] && daftarPenyewa[0].id) || ''),
        durasiJam: Number(nilai.durasi_jam || nilai.durasiJam || 1)
      }
    });
  } catch (error) {
    console.error('Form booking gagal dimuat:', error.message);
    res.status(500).render('pesan', {
      judul: 'Form booking belum tersedia',
      pesan: 'Data lapangan atau tarif belum dapat dimuat. Periksa database dan data seed.'
    });
  }
}

function tampilkanFormBaru(req, res) {
  tampilkanForm(req, res);
}

function tampilkanFormBaruPetugas(req, res) {
  tampilkanForm(req, res, null, req.query, true);
}

async function simpanBooking(req, res) {
  return simpanBookingUntukPengguna(req, res, false);
}

async function simpanBookingPetugas(req, res) {
  return simpanBookingUntukPengguna(req, res, true);
}

async function simpanBookingUntukPengguna(req, res, atasNamaPenyewa) {
  const tanggal = String(req.body.tanggal || '');
  const lapanganId = Number(req.body.lapangan_id);
  const jamMulai = String(req.body.jam_mulai || '');
  const durasiJam = Number(req.body.durasi_jam);
  const userId = atasNamaPenyewa ? Number(req.body.user_id) : req.session.pengguna.id;
  const nilai = { tanggal, lapangan_id: lapanganId, jam_mulai: jamMulai, durasi_jam: durasiJam, user_id: userId };

  if (atasNamaPenyewa) {
    try {
      if (!Number.isInteger(userId) || !await userModel.cariPenyewaDenganId(userId)) {
        return tampilkanForm(req, res, 'Pilih akun penyewa yang terdaftar.', nilai, true);
      }
    } catch (error) {
      console.error('Data penyewa gagal dibaca:', error.message);
      return tampilkanForm(req, res, 'Data penyewa belum dapat dibaca. Periksa database.', nilai, true);
    }
  }

  if (!Number.isInteger(lapanganId) || lapanganId < 1) {
    return tampilkanForm(req, res, 'Pilih lapangan yang tersedia.', nilai, atasNamaPenyewa);
  }
  const tanggalUji = new Date(`${tanggal}T00:00:00Z`);
  const tanggalValid = /^\d{4}-\d{2}-\d{2}$/.test(tanggal)
    && Number.isFinite(tanggalUji.getTime())
    && tanggalUji.toISOString().slice(0, 10) === tanggal;
  if (!tanggalValid || tanggal < tanggalHariIni()) {
    return tampilkanForm(req, res, 'Tanggal booking tidak boleh lewat dan harus valid.', nilai, atasNamaPenyewa);
  }
  if (!/^([01]\d|2[0-3]):00$/.test(jamMulai)) {
    return tampilkanForm(req, res, 'Pilih jam mulai yang tersedia.', nilai, atasNamaPenyewa);
  }
  if (!Number.isInteger(durasiJam) || durasiJam < 1 || durasiJam > 24) {
    return tampilkanForm(req, res, 'Durasi booking harus 1–24 jam.', nilai, atasNamaPenyewa);
  }

  const menitMulai = Number(jamMulai.slice(0, 2)) * 60;
  const menitSelesai = menitMulai + durasiJam * 60;
  const jamSelesai = `${String(Math.floor(menitSelesai / 60)).padStart(2, '0')}:${String(menitSelesai % 60).padStart(2, '0')}:00`;

  try {
    const booking = await bookingModel.buatAman({
      actorId: atasNamaPenyewa ? req.session.pengguna.id : undefined,
      userId: atasNamaPenyewa ? userId : req.session.pengguna.id,
      lapanganId,
      tanggal,
      jamMulai: `${jamMulai}:00`,
      jamSelesai
    });
    res.redirect(`/booking/${booking.id}/bukti?baru=1`);
  } catch (error) {
    const pesan = {
      LAPANGAN_TIDAK_ADA: 'Lapangan tidak ditemukan.',
      LAPANGAN_NONAKTIF: 'Lapangan sedang tidak aktif. Pilih lapangan lain.',
      TANGGAL_LEWAT: 'Tanggal booking tidak boleh lewat.',
      JAM_TIDAK_VALID: 'Rentang waktu harus berupa jam penuh.',
      JAM_DI_LUAR_OPERASIONAL: 'Waktu yang dipilih berada di luar jam operasional lapangan.',
      ADA_BENTROK: 'Jadwal tersebut sudah terisi. Pilih jam lain.',
      TARIF_TIDAK_LENGKAP: error.message
    }[error.code] || 'Booking belum berhasil disimpan. Periksa database lalu coba lagi.';
    if (!pesan.startsWith('Tarif')) console.error('Booking gagal:', error.message);
    return tampilkanForm(req, res, pesan, nilai, atasNamaPenyewa);
  }
}

async function riwayat(req, res) {
  try {
    const jumlahSemua = await bookingModel.hitungRiwayat(req.session.pengguna.id);
    const jumlahHalaman = Math.max(1, Math.ceil(jumlahSemua / BATAS_PER_HALAMAN));
    const diminta = Number.parseInt(req.query.halaman, 10);
    const halaman = Number.isInteger(diminta) && diminta > 0 ? Math.min(diminta, jumlahHalaman) : 1;
    const daftarBooking = await bookingModel.daftarRiwayat(
      req.session.pengguna.id,
      BATAS_PER_HALAMAN,
      (halaman - 1) * BATAS_PER_HALAMAN
    );
    res.render('booking/riwayat', {
      judul: 'Riwayat booking', daftarBooking, halaman, jumlahHalaman,
      pesan: typeof req.query.pesan === 'string' ? req.query.pesan : null
    });
  } catch (error) {
    console.error('Riwayat booking gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Riwayat belum tersedia', pesan: 'Riwayat booking belum dapat dimuat.' });
  }
}

async function batalkan(req, res) {
  try {
    await bookingModel.batalkanPenyewa(req.params.id, req.session.pengguna.id);
    res.redirect('/riwayat?pesan=Booking%20berhasil%20dibatalkan.');
  } catch (error) {
    const pesan = error.code === 'BOOKING_TIDAK_ADA'
      ? 'Booking%20tidak%20ditemukan.'
      : error.code === 'STATUS_TIDAK_VALID'
        ? 'Booking%20ini%20tidak%20dapat%20dibatalkan%20oleh%20penyewa.'
        : 'Booking%20gagal%20dibatalkan.';
    res.redirect(`/riwayat?pesan=${pesan}`);
  }
}

async function bukti(req, res) {
  try {
    const booking = await bookingModel.cariBukti(req.params.id);
    if (!booking) return res.status(404).render('pesan', { judul: 'Bukti tidak ditemukan', pesan: 'Booking tidak ditemukan.' });

    const pengguna = req.session.pengguna;
    if (pengguna.role === 'penyewa' && booking.user_id !== pengguna.id) {
      return res.status(404).render('pesan', { judul: 'Bukti tidak ditemukan', pesan: 'Booking tidak ditemukan.' });
    }

    const tanggal = new Date(`${booking.tanggal}T00:00:00Z`);
    res.render('booking/bukti', {
      judul: `Bukti ${booking.kode_booking}`,
      booking,
      tanggalTampilan: new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long', timeZone: 'UTC'
      }).format(tanggal),
      totalTampilan: formatRupiah(booking.total_biaya),
      pesanBaru: Boolean(req.query.baru),
      pesanDibayar: Boolean(req.query.dibayar),
      pesanStatus: typeof req.query.pesan === 'string' ? req.query.pesan.slice(0, 180) : null
    });
  } catch (error) {
    console.error('Bukti booking gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Bukti belum tersedia', pesan: 'Bukti booking belum dapat dimuat.' });
  }
}

async function unduhBuktiPdf(req, res) {
  try {
    const booking = await bookingModel.cariBukti(req.params.id);
    if (!booking) return res.status(404).render('pesan', { judul: 'Bukti tidak ditemukan', pesan: 'Booking tidak ditemukan.' });

    const pengguna = req.session.pengguna;
    if (pengguna.role === 'penyewa' && booking.user_id !== pengguna.id) {
      return res.status(404).render('pesan', { judul: 'Bukti tidak ditemukan', pesan: 'Booking tidak ditemukan.' });
    }

    const PDFDocument = require('pdfkit');
    const dokumen = new PDFDocument({ size: 'A4', margin: 52 });
    const namaAman = booking.kode_booking.replace(/[^a-zA-Z0-9-]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bukti-${namaAman}.pdf"`);
    dokumen.pipe(res);

    const lebar = dokumen.page.width - 104;
    dokumen.lineWidth(2).strokeColor('#111111').rect(52, 52, lebar, dokumen.page.height - 104).stroke();
    dokumen.rect(52, 52, lebar, 12).fill('#c6f26b');
    dokumen.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text('MAINYUK / BUKTI BOOKING', 72, 88);
    dokumen.fontSize(25).text('PEMESANAN LAPANGAN', 72, 112);
    dokumen.moveTo(72, 154).lineTo(dokumen.page.width - 72, 154).lineWidth(1.5).stroke('#111111');

    const tanggal = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(`${booking.tanggal}T00:00:00Z`));
    const status = booking.status.replaceAll('_', ' ').toUpperCase();
    dokumen.rect(72, 176, lebar - 40, 58).fill('#c6f26b');
    dokumen.fillColor('#111111').fontSize(9).text('KODE BOOKING', 86, 186);
    dokumen.fontSize(20).text(booking.kode_booking, 86, 201);
    dokumen.fontSize(10).text(`STATUS: ${status}`, 72, 250);

    const detail = [
      ['Nama penyewa', booking.penyewa_nama],
      ['Lapangan', `${booking.lapangan_nama} / ${booking.jenis_nama}`],
      ['Tanggal', tanggal],
      ['Waktu', `${String(booking.jam_mulai).slice(0, 5)} - ${String(booking.jam_selesai).slice(0, 5)}`],
      ['Durasi', `${booking.durasi_jam} jam`]
    ];
    let posisiY = 294;
    for (const [label, nilai] of detail) {
      dokumen.fillColor('#666666').font('Helvetica-Bold').fontSize(9).text(label.toUpperCase(), 72, posisiY);
      dokumen.fillColor('#111111').font('Helvetica').fontSize(13).text(String(nilai), 72, posisiY + 15, { width: lebar - 40 });
      posisiY += 62;
    }

    dokumen.moveTo(72, posisiY + 2).lineTo(dokumen.page.width - 72, posisiY + 2).lineWidth(1).stroke('#111111');
    dokumen.fillColor('#666666').font('Helvetica-Bold').fontSize(9).text('TOTAL BIAYA', 72, posisiY + 20);
    dokumen.fillColor('#111111').font('Helvetica-Bold').fontSize(23)
      .text(`Rp${formatRupiah(booking.total_biaya)}`, 72, posisiY + 38);
    dokumen.font('Helvetica').fontSize(9).text('Simpan bukti ini untuk konfirmasi di lokasi lapangan.', 72, dokumen.page.height - 92);
    dokumen.end();
  } catch (error) {
    console.error('PDF bukti booking gagal dibuat:', error.message);
    if (!res.headersSent) res.status(500).send('PDF bukti belum dapat dibuat.');
    else res.destroy(error);
  }
}

module.exports = {
  tampilkanFormBaru, simpanBooking, tampilkanFormBaruPetugas, simpanBookingPetugas,
  riwayat, batalkan, bukti, unduhBuktiPdf
};
