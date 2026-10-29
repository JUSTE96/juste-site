'use strict';
const directions = {
  essentiel: { name: '01 — Essentiel', kind: 'Une colonne · Anthracite', title: 'La lecture avant tout.', note: 'Un parcours linéaire, des rubriques franches et des dates faciles à repérer. Notre point de départ pour un CV polyvalent.' },
  signature: { name: '02 — Signature', kind: 'Une colonne · Vert forêt', title: 'Une élégance tranquille.', note: 'Un nom en serif, des filets discrets et davantage de respiration. Une présence éditoriale cohérente avec l’univers de Juste.' },
  perspective: { name: '03 — Perspective', kind: 'Deux colonnes · Terre cuite', title: 'Chaque information à sa place.', note: 'Le parcours conserve la place principale. Les compétences et les langues trouvent leur espace à droite. L’ordre d’extraction PDF devra être vérifié avant intégration.' }
};
const preview = document.getElementById('cv-preview');
const buttons = [...document.querySelectorAll('[data-style]')];
let currentAnimation;
buttons.forEach(button => button.addEventListener('click', () => {
  const style = button.dataset.style;
  const direction = directions[style];
  if (!direction || button.getAttribute('aria-pressed') === 'true') return;
  currentAnimation?.cancel();
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  preview.className = `cv ${style}`;
  document.getElementById('preview-name').textContent = direction.name;
  document.getElementById('style-kind').textContent = direction.kind;
  document.getElementById('style-title').textContent = direction.title;
  document.getElementById('style-note').textContent = direction.note;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    currentAnimation = preview.animate([{ opacity: .45, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
}));
const requestedStyle = new URLSearchParams(location.search).get('style');
if (Object.hasOwn(directions, requestedStyle)) {
  buttons.find(button => button.dataset.style === requestedStyle)?.click();
}
