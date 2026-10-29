(() => {
  const examples = {
    logistique: {
      title: 'Assistant logistique', score: 74, label: 'Des atouts pour cette offre',
      summary: 'Votre expérience en magasin est un bon point de départ.',
      job: 'Participer aux inventaires, au réassort et à la réception des livraisons.',
      atouts: [
        ['La gestion des stocks, déjà dans votre parcours', 'Réassort des rayons et inventaires mensuels.'],
        ['Une expérience des réceptions', 'Réception des livraisons et contrôle des bons.']
      ],
      pistes: [
        ['À PRÉCISER', 'Décrivez votre rôle dans les inventaires.', 'Ajoutez un exemple réel : préparation, comptage ou vérification des écarts, selon ce que vous avez fait.'],
        ['À DÉVELOPPER', 'Le CACES est un atout souhaité.', 'Il n’est pas mentionné dans ce CV. Ne l’ajoutez qu’après l’avoir obtenu.']
      ],
      cvTitle: 'Candidature — Assistant logistique',
      bullets: ['Réassort des rayons et participation aux inventaires mensuels.', 'Réception des livraisons et contrôle des bons.']
    },
    client: {
      title: 'Conseiller clientèle', score: 82, label: 'Votre expérience a des choses à dire',
      summary: 'Le conseil en magasin rejoint les attentes de relation client.',
      job: 'Accueillir les clients, comprendre leurs besoins et les accompagner dans leurs achats.',
      atouts: [
        ['Le contact client, au cœur de votre expérience', 'Conseil client en rayon.'],
        ['Un parcours en vente', 'Vendeuse — Maison Rivage, 2023–2024.']
      ],
      pistes: [
        ['À PRÉCISER', 'Expliquez votre accompagnement client.', 'Décrivez une situation réelle de conseil, le besoin du client et votre façon de l’aider.'],
        ['À DÉVELOPPER', 'La pratique d’un CRM n’est pas renseignée.', 'Si vous avez utilisé un logiciel de suivi client, précisez son nom et votre usage réel.']
      ],
      cvTitle: 'Candidature — Conseiller clientèle',
      bullets: ['Conseil et accompagnement des clients en rayon.', 'Encaissement et réassort des rayons.']
    }
  };
  let scenario = 'logistique', tab = 'atouts';
  const panel = document.getElementById('demo-content');
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let contentAnimation;
  function render(animate = true) {
    const data = examples[scenario];
    document.getElementById('demo-job').textContent = data.title;
    document.getElementById('demo-job-copy').textContent = data.job;
    document.getElementById('demo-score').innerHTML = `${data.score}<small>%</small>`;
    document.querySelector('.score-orbit').style.setProperty('--score-angle', `${data.score * 3.6}deg`);
    document.getElementById('demo-score-label').textContent = data.label;
    document.getElementById('demo-summary').textContent = data.summary;
    document.querySelectorAll('[data-demo-tab]').forEach((button) => {
      const active = button.dataset.demoTab === tab;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `demo-nav-${tab}`);
    if (tab === 'atouts') panel.innerHTML = data.atouts.map(([title, quote]) => `<article class="demo-item"><strong>${escape(title)}</strong><blockquote>« ${escape(quote)} »</blockquote></article>`).join('');
    if (tab === 'pistes') panel.innerHTML = data.pistes.map(([label, title, advice]) => `<article class="demo-item"><span class="mini-label">${escape(label)}</span><strong>${escape(title)}</strong><p>${escape(advice)}</p></article>`).join('');
    if (tab === 'cv') panel.innerHTML = `<div class="mini-cv"><strong>Camille D.</strong><b>${escape(data.cvTitle)}</b><hr><b>Vendeuse — Maison Rivage</b><span>2023–2024</span><ul>${data.bullets.map((line) => `<li>${escape(line)}</li>`).join('')}</ul><hr><span>Excel · Canva · Anglais B2</span></div>`;
    document.getElementById('demo-action').innerHTML = tab === 'cv' ? 'Revoir les pistes <span aria-hidden="true">↗</span>' : 'Voir le CV adapté <span aria-hidden="true">↗</span>';
    contentAnimation?.cancel();
    if (animate && !reduced.matches) contentAnimation = panel.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.19,1,.22,1)' });
  }
  document.querySelectorAll('[data-demo-tab]').forEach((button) => button.addEventListener('click', () => { tab = button.dataset.demoTab; render(); }));
  document.querySelector('.demo-tabs').addEventListener('keydown', (event) => {
    const buttons = [...document.querySelectorAll('[data-demo-tab]')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    tab = buttons[next].dataset.demoTab; render(); buttons[next].focus();
  });
  document.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', () => {
    scenario = button.dataset.scenario;
    document.querySelectorAll('[data-scenario]').forEach((item) => {
      item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', String(item === button));
    }); render();
  }));
  document.getElementById('demo-action').addEventListener('click', () => { tab = tab === 'cv' ? 'pistes' : 'cv'; render(); });
  document.getElementById('show-improvements').addEventListener('click', () => { tab = 'pistes'; render(); });
  const dialog = document.getElementById('access-dialog');
  const closingDialogs = new WeakMap();
  function closeOverlay(target) {
    if (!target.open) return Promise.resolve();
    if (closingDialogs.has(target)) return closingDialogs.get(target);
    if (reduced.matches) { target.close(); return Promise.resolve(); }
    const animation = target.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 180, easing: 'ease-out' });
    const task = animation.finished.catch(() => {}).then(() => {
      target.close(); closingDialogs.delete(target);
    });
    closingDialogs.set(target, task);
    return task;
  }
  document.querySelectorAll('[data-install]').forEach((button) => button.addEventListener('click', () => {
    const destination = window.LARPEUR_SITE?.extensionUrl;
    if (destination && /^https:\/\/chromewebstore\.google\.com\/detail\//.test(destination)) { window.location.assign(destination); return; }
    dialog.showModal();
  }));
  document.getElementById('close-access').addEventListener('click', () => closeOverlay(dialog));
  document.getElementById('back-to-demo').addEventListener('click', async () => {
    await closeOverlay(dialog); document.getElementById('demo').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' });
    document.getElementById(`demo-nav-${tab}`).focus({ preventScroll: true });
  });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) {
    const rectangle = dialog.getBoundingClientRect();
    if (event.clientX < rectangle.left || event.clientX > rectangle.right || event.clientY < rectangle.top || event.clientY > rectangle.bottom) closeOverlay(dialog);
  } });
  // Une démonstration éditoriale, sans nouvel appel d'analyse.
  const specimen = document.getElementById('specimen');
  const sourceButton = document.getElementById('perspective-source');
  const adaptedButton = document.getElementById('perspective-adapted');
  let specimenAnimation;
  function setPerspective(adapted) {
    specimen.classList.toggle('adapted', adapted);
    sourceButton.setAttribute('aria-pressed', String(!adapted));
    adaptedButton.setAttribute('aria-pressed', String(adapted));
    document.getElementById('specimen-label').textContent = adapted ? 'POUR UNE OFFRE EN LOGISTIQUE' : 'DANS LE CV D’ORIGINE';
    const copy = document.getElementById('specimen-copy');
    copy.textContent = adapted ? 'Réception des livraisons, réassort des rayons et participation aux inventaires.' : 'Réassort des rayons, inventaires et réception des livraisons.';
    document.getElementById('perspective-note').textContent = adapted ? 'Les mêmes missions, présentées dans un ordre adapté à l’offre.' : 'Une mission réelle, telle qu’elle figure dans le CV.';
    specimenAnimation?.cancel();
    if (!reduced.matches) specimenAnimation = copy.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.19,1,.22,1)' });
  }
  sourceButton.addEventListener('click', () => setPerspective(false));
  adaptedButton.addEventListener('click', () => setPerspective(true));
  const menu = document.getElementById('mobile-menu');
  document.getElementById('open-menu').addEventListener('click', () => menu.showModal());
  document.getElementById('close-menu').addEventListener('click', () => closeOverlay(menu));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', async event => {
    event.preventDefault(); await closeOverlay(menu); window.location.hash = link.hash;
  }));
  [menu, dialog].forEach(target => target.addEventListener('cancel', event => { event.preventDefault(); closeOverlay(target); }));
  menu.addEventListener('close', () => { document.getElementById('open-menu').focus({ preventScroll: true }); });
  const header = document.getElementById('site-header');
  let scrollQueued = false;
  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { header.classList.toggle('scrolled', scrollY > 45); scrollQueued = false; });
  }, { passive: true });
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -16px 0px' });
    document.querySelectorAll('.reveal').forEach(node => observer.observe(node));
    // Un lien clavier peut atteindre un élément avant son entrée dans le viewport.
    document.addEventListener('focusin', event => event.target.closest?.('.reveal')?.classList.add('visible'));
    const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.desktop-nav a').forEach(link => link.classList.toggle('active', link.hash === '#' + entry.target.id));
    }), { rootMargin: '-20% 0px -45% 0px' });
    ['approche', 'comment', 'collection', 'demo', 'tarifs', 'faq'].forEach(id => navObserver.observe(document.getElementById(id)));
  }
  reduced.addEventListener('change', () => { if (reduced.matches) { contentAnimation?.cancel(); specimenAnimation?.cancel(); } });
  render(false);
})();
