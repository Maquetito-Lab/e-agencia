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

  // Hero: la mancha lima persigue al mouse (solo si hay puntero fino, o sea no en celu)
  const hero = $('.hero');
  const spot = $('.hero__spot');
  if (hero && spot && matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let tx = hero.clientWidth * 0.42, ty = hero.clientHeight * 0.3; // objetivo
    let x = tx, y = ty;                                              // posición actual
    let raf = null;
    const tick = () => {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;                     // persigue con retardo
      spot.style.setProperty('--mx', x + 'px');
      spot.style.setProperty('--my', y + 'px');
      raf = (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) ? requestAnimationFrame(tick) : null;
    };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      hero.classList.add('has-pointer');
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener('pointerleave', () => hero.classList.remove('has-pointer'));
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
