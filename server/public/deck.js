/* W Forex · Presentation deck controller */
(function () {
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  let current = 0;

  const stage = document.getElementById('stage');
  const progFill = document.getElementById('progFill');
  const deckCount = document.getElementById('deckCount');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const fullBtn = document.getElementById('fullBtn');
  const dotsWrap = document.getElementById('dots');

  // build dots
  slides.forEach((s, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    b.addEventListener('click', () => go(i));
    dotsWrap.appendChild(b);
  });
  const dots = Array.from(dotsWrap.children);

  function go(i) {
    i = Math.max(0, Math.min(total - 1, i));
    if (i === current) return;
    slides[current].classList.remove('active');
    slides[current].classList.add(i > current ? 'prev' : '');
    // clear prev on the one we are leaving for opposite direction
    if (i < current) slides[current].classList.remove('prev');
    slides.forEach((s, idx) => {
      if (idx !== i) {
        // reset classes for non-active
        if (idx !== current) s.classList.remove('prev');
      }
    });
    current = i;
    slides[current].classList.add('active');
    slides[current].classList.remove('prev');
    // ensure earlier slides appear as 'prev' for a clean visual when navigating back
    slides.forEach((s, idx) => {
      if (idx < current) { s.classList.add('prev'); }
      else if (idx > current) { s.classList.remove('prev'); }
    });
    update();
  }

  function next() { if (current < total - 1) go(current + 1); }
  function prev() { if (current > 0) go(current - 1); }

  function update() {
    progFill.style.width = ((current + 1) / total * 100) + '%';
    deckCount.textContent = (current + 1) + ' / ' + total;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
    prevBtn.style.opacity = current === 0 ? '.4' : '1';
    nextBtn.style.opacity = current === total - 1 ? '.4' : '1';
    // scroll active slide to top
    slides[current].scrollTop = 0;
  }

  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  fullBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { go(0); }
    else if (e.key === 'End') { go(total - 1); }
    else if (e.key === 'f' || e.key === 'F') { fullBtn.click(); }
  });

  // swipe support
  let touchX = null;
  stage.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].screenX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].screenX - touchX;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
    touchX = null;
  });

  // click left/right halves of stage to navigate (but not when clicking links/buttons)
  stage.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x > rect.width * 0.65) next();
    else if (x < rect.width * 0.35) prev();
  });

  update();
})();
