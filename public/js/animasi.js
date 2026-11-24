(() => {
  const navigasi = document.querySelector('.site-navbar');
  if (navigasi) navigasi.dataset.enter = 'nav';

  const bagianHero = document.querySelector('main > section:first-child');
  const judulHalaman = document.querySelector('main h1');
  if (bagianHero && document.querySelector('main#konten')) {
    bagianHero.dataset.enter = 'hero';
  } else if (judulHalaman) {
    judulHalaman.dataset.enter = 'hero';
  }

  const sasaran = document.querySelectorAll('main > section, main > div, main > form, main > article, main .grid > article');
  const urutanPerKelompok = new Map();
  sasaran.forEach((elemen) => {
    elemen.dataset.scrollAnimasi = 'true';
    const induk = elemen.parentElement;
    const urutan = urutanPerKelompok.get(induk) || 0;
    elemen.style.setProperty('--scroll-delay', `${urutan * 75}ms`);
    urutanPerKelompok.set(induk, urutan + 1);
  });

  document.querySelectorAll('.slot-preview-item').forEach((slot, indeks) => {
    slot.style.setProperty('--slot-delay', `${indeks * 45}ms`);
  });

  if (!('IntersectionObserver' in window)) {
    sasaran.forEach((elemen) => elemen.classList.add('terlihat-scroll'));
    document.documentElement.dataset.motionReady = 'true';
    return;
  }

  try {
    const pengamat = new IntersectionObserver((daftar) => {
      daftar.forEach((item) => {
        if (!item.isIntersecting) return;
        item.target.classList.add('terlihat-scroll');
        pengamat.unobserve(item.target);
      });
    }, { threshold: 0, rootMargin: '0px' });

    sasaran.forEach((elemen) => pengamat.observe(elemen));
    document.documentElement.dataset.motionReady = 'true';
  } catch (error) {
    sasaran.forEach((elemen) => elemen.classList.add('terlihat-scroll'));
    document.documentElement.dataset.motionReady = 'true';
  }
})();
