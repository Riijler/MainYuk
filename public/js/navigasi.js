(() => {
  const tombol = document.getElementById('tombol-menu');
  const menu = document.getElementById('menu-utama');
  const label = document.getElementById('label-menu');
  if (!tombol || !menu) return;

  function tutupMenu() {
    menu.classList.add('hidden');
    tombol.setAttribute('aria-expanded', 'false');
    if (label) label.textContent = 'Menu';
  }

  tombol.addEventListener('click', () => {
    const terbuka = tombol.getAttribute('aria-expanded') === 'true';
    menu.classList.toggle('hidden', terbuka);
    tombol.setAttribute('aria-expanded', String(!terbuka));
    if (label) label.textContent = terbuka ? 'Menu' : 'Tutup';
  });

  menu.querySelectorAll('a').forEach((tautan) => tautan.addEventListener('click', tutupMenu));
  const batasDesktop = window.matchMedia('(min-width: 768px)');
  if (batasDesktop.addEventListener) batasDesktop.addEventListener('change', tutupMenu);
  else if (batasDesktop.addListener) batasDesktop.addListener(tutupMenu);
})();
