(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let journeyAnimation;
  const journeyStage = document.querySelector('.journey-stage');
  document.querySelectorAll('[data-journey]').forEach(button => button.addEventListener('click', () => {
    const step = button.dataset.journey;
    if (journeyStage.dataset.currentStep === step) return;
    journeyAnimation?.cancel();
    journeyStage.dataset.currentStep = step;
    document.querySelectorAll('[data-journey]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('[data-journey-panel]').forEach(panel => { panel.hidden = panel.dataset.journeyPanel !== step; });
    const visible = journeyStage.querySelector(`[data-journey-panel="${step}"]`);
    if (!reduced.matches) journeyAnimation = visible.animate([{ opacity: 0, transform: 'translateY(15px) rotate(-4deg)' }, { opacity: 1, transform: 'translateY(0) rotate(-2deg)' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }));
  reduced.addEventListener('change', () => {
    if (reduced.matches) { journeyAnimation?.cancel(); }
  });
})();
