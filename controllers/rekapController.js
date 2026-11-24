const ExcelJS = require('exceljs');
const bookingModel = require('../models/bookingModel');
const lapanganModel = require('../models/lapanganModel');
const auditModel = require('../models/auditModel');

function tanggalHariIni() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function tanggalValid(tanggal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const nilaiTanggal = new Date(`${tanggal}T00:00:00Z`);
  return Number.isFinite(nilaiTanggal.getTime()) && nilaiTanggal.toISOString().slice(0, 10) === tanggal;
}

function filterDariKueri(req) {
  const hariIni = tanggalHariIni();
  const tanggalMulai = String(req.query.mulai || `${hariIni.slice(0, 7)}-01`);
  const tanggalSelesai = String(req.query.selesai || hariIni);
  const lapanganId = /^\d+$/.test(String(req.query.lapangan || '')) ? Number(req.query.lapangan) : null;
  const tanggalMulaiValid = tanggalValid(tanggalMulai);
  const tanggalSelesaiValid = tanggalValid(tanggalSelesai);

  return {
    tanggalMulai,
    tanggalSelesai,
    lapanganId,
    pesanError: !tanggalMulaiValid || !tanggalSelesaiValid
      ? 'Tanggal filter tidak valid.'
      : (tanggalMulai > tanggalSelesai ? 'Tanggal mulai harus sebelum atau sama dengan tanggal selesai.' : null)
  };
}

async function dataRekap(req, limit = null, offset = 0) {
  const filter = filterDariKueri(req);
  const daftarLapangan = await lapanganModel.daftarSemua();
  if (filter.lapanganId && !daftarLapangan.some((lapangan) => lapangan.id === filter.lapanganId)) {
    filter.pesanError = 'Lapangan yang dipilih tidak ditemukan.';
  }
  const hasil = filter.pesanError
    ? { daftar: [], jumlahBooking: 0, totalPendapatan: 0 }
    : await bookingModel.rekapPendapatan({ ...filter, limit, offset });
  return { ...filter, daftarLapangan, ...hasil };
}

async function lihatRekap(req, res) {
  try {
    const ukuranHalaman = 10;
    let halaman = Number.parseInt(req.query.halaman, 10);
    if (!Number.isInteger(halaman) || halaman < 1) halaman = 1;
    let data = await dataRekap(req, ukuranHalaman, (halaman - 1) * ukuranHalaman);
    const jumlahHalaman = Math.max(1, Math.ceil(data.jumlahBooking / ukuranHalaman));
    if (halaman > jumlahHalaman) {
      halaman = jumlahHalaman;
      data = await dataRekap(req, ukuranHalaman, (halaman - 1) * ukuranHalaman);
    }
    res.render('admin/rekap', {
      judul: 'Rekap pendapatan',
      ...data,
      halaman,
      jumlahHalaman,
      totalFormat: new Intl.NumberFormat('id-ID').format(data.totalPendapatan)
    });
  } catch (error) {
    console.error('Rekap pendapatan gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Rekap belum tersedia', pesan: 'Rekap belum dapat dimuat.' });
  }
}

async function eksporExcel(req, res) {
  try {
    const data = await dataRekap(req);
    if (data.pesanError) return res.redirect(`/admin/rekap?pesan=${encodeURIComponent(data.pesanError)}`);

    await auditModel.catat({ userId: req.session.pengguna.id, aksi: 'ekspor' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MainYuk';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Rekap Pendapatan');
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'REKAP PENDAPATAN PENYEWAAN LAPANGAN';
    sheet.getCell('A1').font = { bold: true, size: 16 };
    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = `Periode ${data.tanggalMulai} sampai ${data.tanggalSelesai}`;
    sheet.addRow([]);
    sheet.addRow(['Kode Booking', 'Tanggal', 'Penyewa', 'Lapangan', 'Jam Mulai', 'Jam Selesai', 'Durasi (jam)', 'Total (Rp)', 'Status']);
    const barisHeader = sheet.lastRow;
    barisHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    barisHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } };
    for (const booking of data.daftar) {
      sheet.addRow([
        booking.kode_booking, booking.tanggal, booking.penyewa_nama, booking.lapangan_nama,
        String(booking.jam_mulai).slice(0, 5), String(booking.jam_selesai).slice(0, 5),
        booking.durasi_jam, Number(booking.total_biaya), booking.status
      ]);
    }
    sheet.addRow([]);
    sheet.addRow(['Jumlah booking', data.jumlahBooking, 'Total pendapatan', data.totalPendapatan]);
    sheet.columns = [
      { width: 22 }, { width: 14 }, { width: 24 }, { width: 26 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 18 }, { width: 24 }
    ];
    sheet.getColumn(8).numFmt = '#,##0';
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    const namaFile = `rekap-pendapatan-${data.tanggalMulai}-${data.tanggalSelesai}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Ekspor rekap gagal:', error.message);
    if (!res.headersSent) res.status(500).send('File rekap belum dapat dibuat.');
  }
}

module.exports = { lihatRekap, eksporExcel };
