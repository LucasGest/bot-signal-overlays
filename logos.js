// Logos animés (GSAP, hébergé sur ce site : vendor/gsap.min.js).
// Logo de l'event : entrée lettre par lettre, « #2 » qui respire, reflet qui passe de temps en temps.
// Logo du bot : un point d'antenne et trois ondes radio qui partent en boucle.
// Si logo-event.png / logo-bot.png existent, l'image remplace le logo texte et flotte doucement.
'use strict';

(() => {
  const g = window.gsap;
  if (!g) return; // sans GSAP, les logos restent affichés, simplement immobiles

  for (const svg of document.querySelectorAll('.bot-mark')) {
    const dot = svg.querySelector('.bm-dot');
    const waves = svg.querySelectorAll('.bm-w');
    g.set(waves, { opacity: 0, transformOrigin: '50% 100%' });
    g.timeline({ repeat: -1, repeatDelay: 0.8 })
      .fromTo(dot, { scale: 0.5, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, ease: 'back.out(4)' })
      .fromTo(waves, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, stagger: 0.16, ease: 'power2.out' }, '<0.1')
      .to(waves, { opacity: 0, duration: 0.6, stagger: 0.16, ease: 'power1.in' }, '+=0.9');
  }

  for (const box of document.querySelectorAll('.ev-logo .logo-txt')) {
    const parts = box.querySelectorAll('.ev-small, .ev-big, .ev-num');
    const num = box.querySelector('.ev-num');
    const shine = box.querySelector('.ev-shine');
    g.from(parts, { y: 18, opacity: 0, duration: 0.8, stagger: 0.14, ease: 'back.out(2)', delay: 0.2 });
    g.to(num, { scale: 1.07, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.2 });
    g.timeline({ repeat: -1, repeatDelay: 7, delay: 1.6 })
      .fromTo(shine, { xPercent: -160, opacity: 1 }, { xPercent: 260, duration: 1.3, ease: 'power2.inOut' });
  }

  for (const img of document.querySelectorAll('img.logo')) {
    g.to(img, { y: -4, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
})();
