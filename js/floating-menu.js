(function () {
  'use strict';

  const menu = document.querySelector('.floating-page-menu');
  if (!menu) return;

  const trigger = menu.querySelector('.floating-menu-trigger');
  const current = menu.querySelector('#floating-menu-current');
  const links = Array.from(menu.querySelectorAll('[data-page-link]'));
  const page = document.body.dataset.page || 'replay';

  const labels = {
    replay: 'Replay',
    dashboard: 'Dashboard',
    drivers: 'Pilotos',
    teams: 'Equipes',
    circuits: 'Circuitos',
    analytics: 'Analytics',
    simulation: 'Simulador',
    customRace: 'Corrida customizada'
  };

  if (current) current.textContent = labels[page] || 'Menu';

  links.forEach((link) => {
    link.classList.toggle('is-active', link.dataset.pageLink === page);
  });

  trigger?.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) {
      menu.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
    }
  });
}());
