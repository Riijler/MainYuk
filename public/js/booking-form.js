(() => {
  const form = document.getElementById('form-booking');
  if (!form) return;

  const pilihLapangan = document.getElementById('lapangan_id');
  const pilihTanggal = document.getElementById('tanggal');
  const pilihMulai = document.getElementById('jam_mulai');
  const pilihDurasi = document.getElementById('durasi_jam');
  const jamSelesaiTersembunyi = document.getElementById('jam_selesai');
  const pesanJam = document.getElementById('pesan-jam-terisi');
  const tombolSimpan = document.getElementById('tombol-simpan-booking');
  const atasNamaPenyewa = form.dataset.atasNamaPenyewa === '1';

  let daftarBooking = [];
  let jadwalSiap = !atasNamaPenyewa;
  let nomorPermintaan = 0;

  function keMenit(jam) {
    if (!jam) return NaN;
    const [jamAngka, menitAngka] = jam.split(':').map(Number);
    return jamAngka * 60 + menitAngka;
  }

  function keJam(menit) {
    return `${String(Math.floor(menit / 60)).padStart(2, '0')}:${String(menit % 60).padStart(2, '0')}`;
  }

  function formatRupiah(nilai) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(nilai);
  }

  function bentrokDenganBooking(mulai, selesai) {
    return daftarBooking.some((booking) => (
      mulai < keMenit(booking.jam_selesai) && selesai > keMenit(booking.jam_mulai)
    ));
  }

  function bersihkanRingkasan() {
    document.getElementById('ringkasan-durasi').textContent = '—';
    document.getElementById('ringkasan-selesai').textContent = '—';
    document.getElementById('ringkasan-lampu').textContent = '—';
    document.getElementById('ringkasan-total').textContent = '—';
    jamSelesaiTersembunyi.value = '';
  }

  function isiPilihanJam(nilaiLama = pilihMulai.value || pilihMulai.dataset.jamAwal) {
    const opsi = pilihLapangan.selectedOptions[0];
    const buka = keMenit(opsi.dataset.buka);
    const tutup = keMenit(opsi.dataset.tutup);
    pilihMulai.replaceChildren();
    const daftarJamBisaDipilih = [];

    for (let mulai = buka; mulai + 60 <= tutup; mulai += 60) {
      if (atasNamaPenyewa && bentrokDenganBooking(mulai, mulai + 60)) continue;
      daftarJamBisaDipilih.push(keJam(mulai));
    }

    if (!daftarJamBisaDipilih.length) {
      const kosong = document.createElement('option');
      kosong.value = '';
      kosong.textContent = 'Tidak ada jam kosong';
      pilihMulai.append(kosong);
      pilihMulai.disabled = true;
      pilihDurasi.replaceChildren();
      pilihDurasi.disabled = true;
      tombolSimpan.disabled = true;
      bersihkanRingkasan();
      if (atasNamaPenyewa) pesanJam.textContent = 'Semua jam operasional sudah terisi booking aktif.';
      return;
    }

    daftarJamBisaDipilih.forEach((jam) => {
      const option = document.createElement('option');
      option.value = jam;
      option.textContent = jam;
      pilihMulai.append(option);
    });

    pilihMulai.disabled = false;
    tombolSimpan.disabled = false;
    if (daftarJamBisaDipilih.includes(nilaiLama)) pilihMulai.value = nilaiLama;
    else pilihMulai.selectedIndex = 0;
    isiPilihanDurasi();
  }

  function isiPilihanDurasi() {
    const opsi = pilihLapangan.selectedOptions[0];
    const mulai = keMenit(pilihMulai.value);
    const tutup = keMenit(opsi.dataset.tutup);
    if (!Number.isFinite(mulai)) {
      pilihDurasi.replaceChildren();
      pilihDurasi.disabled = true;
      bersihkanRingkasan();
      return;
    }

    const maksimal = Math.floor((tutup - mulai) / 60);
    const nilaiLama = Number(pilihDurasi.value || pilihDurasi.dataset.durasiAwal || 1);
    pilihDurasi.replaceChildren();
    const daftarDurasi = [];

    for (let durasi = 1; durasi <= maksimal; durasi += 1) {
      if (atasNamaPenyewa && bentrokDenganBooking(mulai, mulai + durasi * 60)) continue;
      daftarDurasi.push(durasi);
      const option = document.createElement('option');
      option.value = String(durasi);
      option.textContent = `${durasi} jam`;
      pilihDurasi.append(option);
    }

    pilihDurasi.disabled = daftarDurasi.length === 0;
    if (daftarDurasi.length) {
      pilihDurasi.value = String(daftarDurasi.includes(nilaiLama) ? nilaiLama : daftarDurasi[0]);
      hitungRingkasan();
    } else {
      bersihkanRingkasan();
    }
  }

  function hitungRingkasan() {
    const opsi = pilihLapangan.selectedOptions[0];
    const mulai = keMenit(pilihMulai.value);
    const durasi = Number(pilihDurasi.value || 0);
    if (!opsi || !Number.isFinite(mulai) || !durasi) {
      bersihkanRingkasan();
      return;
    }

    const selesai = mulai + durasi * 60;
    const hari = new Date(`${pilihTanggal.value}T00:00:00`).getDay();
    const tipeHari = hari === 0 || hari === 6 ? 'weekend' : 'weekday';
    const jamLampu = keMenit(opsi.dataset.lampu);
    let total = 0;
    let tarifLengkap = true;
    let perluLampu = false;

    for (let menit = mulai; menit < selesai; menit += 60) {
      const pakaiLampu = menit >= jamLampu;
      perluLampu = perluLampu || pakaiLampu;
      const harga = opsi.dataset[`tarif${tipeHari === 'weekday' ? 'Weekday' : 'Weekend'}${pakaiLampu ? 'Pakai' : 'Tanpa'}Lampu`];
      if (!harga) {
        tarifLengkap = false;
        break;
      }
      total += Number(harga);
    }

    document.getElementById('ringkasan-durasi').textContent = `${durasi} jam`;
    document.getElementById('ringkasan-selesai').textContent = keJam(selesai);
    document.getElementById('ringkasan-lampu').textContent = perluLampu ? 'Termasuk lampu' : 'Tanpa lampu';
    document.getElementById('ringkasan-total').textContent = tarifLengkap ? formatRupiah(total) : 'Tarif belum lengkap';
    jamSelesaiTersembunyi.value = `${keJam(selesai)}:00`;
  }

  async function muatJadwalPetugas() {
    if (!atasNamaPenyewa) {
      isiPilihanJam();
      return;
    }

    const permintaanSaatIni = ++nomorPermintaan;
    const nilaiSebelumnya = pilihMulai.value || pilihMulai.dataset.jamAwal;
    jadwalSiap = false;
    tombolSimpan.disabled = true;
    pilihMulai.disabled = true;
    pilihDurasi.disabled = true;
    pesanJam.textContent = 'Memuat jam yang tersedia…';

    try {
      const parameter = new URLSearchParams({
        lapangan_id: pilihLapangan.value,
        tanggal: pilihTanggal.value
      });
      const response = await fetch(`/petugas/booking/jam-terisi?${parameter}`, { cache: 'no-store' });
      const hasil = await response.json();
      if (!response.ok) throw new Error(hasil.pesan || 'Jadwal booking tidak dapat dimuat.');
      if (permintaanSaatIni !== nomorPermintaan) return;

      daftarBooking = hasil.daftarJam || [];
      jadwalSiap = true;
      pesanJam.textContent = daftarBooking.length
        ? 'Jam dan durasi yang beririsan dengan booking aktif disembunyikan.'
        : 'Belum ada booking aktif pada tanggal ini.';
      isiPilihanJam(nilaiSebelumnya);
    } catch (error) {
      if (permintaanSaatIni !== nomorPermintaan) return;
      daftarBooking = [];
      pilihMulai.replaceChildren();
      const gagal = document.createElement('option');
      gagal.value = '';
      gagal.textContent = 'Jadwal belum tersedia';
      pilihMulai.append(gagal);
      pilihMulai.disabled = true;
      pilihDurasi.replaceChildren();
      pilihDurasi.disabled = true;
      tombolSimpan.disabled = true;
      pesanJam.textContent = `${error.message} Coba ubah pilihan atau muat ulang halaman.`;
      bersihkanRingkasan();
    }
  }

  pilihLapangan.addEventListener('change', muatJadwalPetugas);
  pilihTanggal.addEventListener('change', muatJadwalPetugas);
  pilihMulai.addEventListener('change', isiPilihanDurasi);
  pilihDurasi.addEventListener('change', hitungRingkasan);
  form.addEventListener('submit', (event) => {
    if (atasNamaPenyewa && (!jadwalSiap || !pilihMulai.value || bentrokDenganBooking(keMenit(pilihMulai.value), keMenit(jamSelesaiTersembunyi.value)))) {
      event.preventDefault();
      pesanJam.textContent = 'Pilih waktu yang kosong sebelum menyimpan booking.';
    }
  });

  muatJadwalPetugas();
})();
