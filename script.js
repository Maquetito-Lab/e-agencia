// e. agencia · comportamiento mínimo: reveals, nav activa, año del footer.

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Año del footer
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // Índice para el stagger de los chips
  $$('.chips li').forEach((li, i) => li.style.setProperty('--i', i));

  // Reveal al entrar en pantalla
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // Hero: con mouse, las dos capas del degradé se desplazan hacia el cursor
  // (la de adelante más que la de fondo). Sin mouse (celu) solo respiran.
  const hero = $('.hero');
  const layers = $$('.hero__layer');
  if (hero && layers.length && matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const strength = [0.08, 0.18]; // fracción del ancho/alto del hero que se corre cada capa
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 … 0.5
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l, i) => {
        l.style.setProperty('--ox', (nx * r.width * strength[i]).toFixed(1) + 'px');
        l.style.setProperty('--oy', (ny * r.height * strength[i]).toFixed(1) + 'px');
      });
    });
    hero.addEventListener('pointerleave', () => {
      layers.forEach((l) => { l.style.setProperty('--ox', '0px'); l.style.setProperty('--oy', '0px'); });
    });
  }

  // Menú hamburguesa (celular)
  const nav = $('.nav');
  const toggle = $('.nav__toggle');
  const pills = $$('.nav__links .pill');
  pills.forEach((p, i) => p.style.setProperty('--i', i));

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  pills.forEach((p) => p.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Nav: compacta al scrollear y marca la sección visible
  const sections = pills
    .map((p) => $(p.getAttribute('href')))
    .filter(Boolean);

  const onScroll = () => {
    nav.classList.toggle('is-compact', window.scrollY > 40);

    const line = window.scrollY + window.innerHeight * 0.35;
    let current = sections[0];
    for (const s of sections) if (s.offsetTop <= line) current = s;
    pills.forEach((p) => p.classList.toggle('is-active', p.getAttribute('href') === '#' + current.id));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
