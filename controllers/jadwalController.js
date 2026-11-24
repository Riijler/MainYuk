const jenisModel = require('../models/jenisModel');
const lapanganModel = require('../models/lapanganModel');
const tarifModel = require('../models/tarifModel');
const bookingModel = require('../models/bookingModel');

function tanggalHariIni() {
  const bagianTanggal = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  return bagianTanggal;
}

function tanggalValid(tanggal) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const tanggalUji = new Date(`${tanggal}T00:00:00Z`);
  return Number.isFinite(tanggalUji.getTime()) && tanggalUji.toISOString().slice(0, 10) === tanggal;
}

function menitDariJam(jam) {
  const cocok = /^(\d{2}):(\d{2})/.exec(String(jam || ''));
  return cocok ? Number(cocok[1]) * 60 + Number(cocok[2]) : 0;
}

function formatJam(menit) {
  const jam = String(Math.floor(menit / 60)).padStart(2, '0');
  const sisaMenit = String(menit % 60).padStart(2, '0');
  return `${jam}:${sisaMenit}`;
}

function rupiah(nilai) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(nilai));
}

function buatSlotLapangan(lapangan, daftarBooking) {
  const jamBuka = menitDariJam(lapangan.jam_buka);
  const jamTutup = menitDariJam(lapangan.jam_tutup);
  const jamLampu = menitDariJam(lapangan.jam_mulai_lampu);
  const bookingLapangan = daftarBooking.filter((booking) => booking.lapangan_id === lapangan.id);
  const slot = [];

  for (let mulai = jamBuka; mulai + 60 <= jamTutup; mulai += 60) {
    const selesai = mulai + 60;
    const terisi = bookingLapangan.some((booking) => (
      mulai < menitDariJam(booking.jam_selesai) && selesai > menitDariJam(booking.jam_mulai)
    ));

    slot.push({
      jamMulai: formatJam(mulai),
      jamSelesai: formatJam(selesai),
      terisi,
      pakaiLampu: mulai >= jamLampu
    });
  }

  return slot;
}

function tambahTanggal(tanggal, jumlahHari) {
  const nilaiTanggal = new Date(`${tanggal}T00:00:00Z`);
  nilaiTanggal.setUTCDate(nilaiTanggal.getUTCDate() + jumlahHari);
  return nilaiTanggal.toISOString().slice(0, 10);
}

async function lihatJadwal(req, res) {
  const tanggalKueri = String(req.query.tanggal || tanggalHariIni());
  const tanggal = tanggalValid(tanggalKueri) ? tanggalKueri : tanggalHariIni();
  const jenisId = /^\d+$/.test(String(req.query.jenis || '')) ? Number(req.query.jenis) : null;
  const lapanganId = /^\d+$/.test(String(req.query.lapangan || '')) ? Number(req.query.lapangan) : null;

  try {
    const [daftarJenis, daftarLapanganFilter] = await Promise.all([
      jenisModel.daftarSemua(), lapanganModel.daftarAktifUntukFilter()
    ]);
    const daftarLapangan = await lapanganModel.daftarAktif({ jenisId, lapanganId });
    const [daftarBooking, semuaTarif] = await Promise.all([
      bookingModel.daftarUntukJadwal(tanggal),
      tarifModel.daftarUntukLapangan(daftarLapangan.map((baris) => baris.id))
    ]);

    const lapanganUntukTampilan = daftarLapangan.map((lapangan) => {
      const tarifLapangan = semuaTarif.filter((tarif) => tarif.lapangan_id === lapangan.id);
      return {
        ...lapangan,
        slot: buatSlotLapangan(lapangan, daftarBooking),
        tarif: tarifLapangan.map((tarif) => ({
          tipeHari: tarif.tipe_hari,
          labelHari: tarif.tipe_hari === 'weekday' ? 'Weekday' : 'Weekend',
          pakaiLampu: Boolean(tarif.pakai_lampu),
          labelLampu: tarif.pakai_lampu ? 'Pakai lampu' : 'Tanpa lampu',
          harga: rupiah(tarif.harga_per_jam)
        }))
      };
    });

    res.render('jadwal/index', {
      judul: 'Jadwal lapangan',
      daftarJenis,
      daftarLapanganFilter,
      daftarLapangan: lapanganUntukTampilan,
      tanggal,
      jenisTerpilih: jenisId || '',
      lapanganTerpilih: lapanganId || '',
      pesanTanggal: tanggalKueri === tanggal ? null : 'Format tanggal tidak valid. Tampilkan jadwal hari ini.',
      jumlahSlot: lapanganUntukTampilan.reduce((jumlah, lapangan) => jumlah + lapangan.slot.length, 0)
    });
  } catch (error) {
    console.error('Jadwal gagal dimuat:', error.message);
    res.status(500).render('pesan', {
      judul: 'Jadwal belum tersedia',
      pesan: 'Data jadwal belum dapat dimuat. Periksa koneksi database dan pastikan seed sudah dijalankan.'
    });
  }
}

async function lihatMingguan(req, res) {
  const kueriTanggal = String(req.query.tanggal || tanggalHariIni());
  const tanggalMulai = tanggalValid(kueriTanggal) ? kueriTanggal : tanggalHariIni();

  try {
    const daftarLapanganFilter = await lapanganModel.daftarAktifUntukFilter();
    if (!daftarLapanganFilter.length) {
      return res.render('jadwal/mingguan', {
        judul: 'Jadwal mingguan', daftarLapanganFilter, lapangan: null,
        tanggalMulai, daftarHari: [], tarif: [], pesanTanggal: null
      });
    }

    const idKueri = /^\d+$/.test(String(req.query.lapangan || '')) ? Number(req.query.lapangan) : null;
    const idTerpilih = idKueri || daftarLapanganFilter[0].id;
    const daftarLapangan = await lapanganModel.daftarAktif({ lapanganId: idTerpilih });
    const lapangan = daftarLapangan[0];
    if (!lapangan) return res.status(404).render('pesan', { judul: 'Lapangan tidak ditemukan', pesan: 'Pilih lapangan aktif untuk melihat jadwal mingguan.' });

    const tanggalSelesai = tambahTanggal(tanggalMulai, 6);
    const [daftarBooking, daftarTarif] = await Promise.all([
      bookingModel.daftarUntukRentangJadwal(lapangan.id, tanggalMulai, tanggalSelesai),
      tarifModel.daftarUntukLapangan([lapangan.id])
    ]);
    const daftarHari = Array.from({ length: 7 }, (_, indeks) => {
      const tanggal = tambahTanggal(tanggalMulai, indeks);
      const nilaiTanggal = new Date(`${tanggal}T00:00:00Z`);
      const bookingHari = daftarBooking.filter((booking) => String(booking.tanggal).slice(0, 10) === tanggal);
      return {
        tanggal,
        label: new Intl.DateTimeFormat('id-ID', {
          weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
        }).format(nilaiTanggal),
        slot: buatSlotLapangan(lapangan, bookingHari)
      };
    });

    res.render('jadwal/mingguan', {
      judul: 'Jadwal mingguan', daftarLapanganFilter,
      lapangan, tanggalMulai, daftarHari,
      tarif: daftarTarif.map((baris) => ({
        hari: baris.tipe_hari === 'weekday' ? 'Weekday' : 'Weekend',
        lampu: Number(baris.pakai_lampu) ? 'Pakai lampu' : 'Tanpa lampu',
        harga: rupiah(baris.harga_per_jam), pakaiLampu: Boolean(baris.pakai_lampu)
      })),
      pesanTanggal: kueriTanggal === tanggalMulai ? null : 'Format tanggal tidak valid. Jadwal dimulai hari ini.'
    });
  } catch (error) {
    console.error('Jadwal mingguan gagal dimuat:', error.message);
    res.status(500).render('pesan', { judul: 'Jadwal mingguan belum tersedia', pesan: 'Jadwal belum dapat dimuat.' });
  }
}

module.exports = { lihatJadwal, lihatMingguan, buatSlotLapangan };
