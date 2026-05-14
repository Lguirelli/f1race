(function () {
  'use strict';

  const state = { data: { drivers: [], teams: [], circuits: [], health: [] } };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const color = (value, fallback = '#56c7ff') => String(value || fallback).startsWith('#') ? value || fallback : `#${value}`;

  function metric(label, value, detail = '') {
    return `<article class="neo-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;
  }

  function renderDashboard() {
    const d = state.data;
    const grid = $('#dashboard-season-grid');
    const years = d.meetings.map((item) => Number(item.year)).filter(Number.isFinite);
    const minYear = years.length ? Math.min(...years) : 1950;
    const maxYear = years.length ? Math.max(...years) : 2026;

    if (grid) grid.innerHTML = [
      metric('Corridas', d.meetings.length || '-', `${minYear}-${maxYear}`),
      metric('Sessões', d.sessions.length || '-', 'arquivos conectados'),
      metric('Pilotos', d.drivers.length || '-', 'cadastros normalizados'),
      metric('Equipes', d.teams.length || '-', 'construtores históricos'),
      metric('Circuitos', d.circuits.length || '-', 'layouts e metadados'),
      metric('Base', `${minYear}-${maxYear}`, 'sem chamada externa')
    ].join('');

    const races = $('#dashboard-featured-races');
    if (races) {
      const latest = [...d.meetings]
        .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(b.round || 0) - Number(a.round || 0))
        .slice(0, 8);
      races.innerHTML = latest.map((item) => `<article><b>◎</b><span>${esc(item.year)} · ${esc(item.meeting_name || item.name)} · ${esc(item.circuit_short_name || item.location || '')}</span></article>`).join('')
        || '<article><b>◎</b><span>Nenhuma corrida encontrada na base.</span></article>';
    }

    const health = $('#dashboard-data-health');
    if (health) health.innerHTML = d.health.map((item) => `<article class="health-card"><strong>${esc(item.label)}</strong><span>${esc(item.value ?? item.status ?? '-')}</span><small>${esc(item.detail || '')}</small></article>`).join('');
  }

  function driverCard(driver) {
    const c = color(driver.team_color);
    const idx = driver.indexes || {};
    const tags = (driver.style_tags || []).slice(0, 4).map((tag) => `<span>${esc(tag)}</span>`).join('');
    const starts = driver.starts ?? driver.race_starts ?? '-';
    const wins = driver.wins ?? '-';
    const podiums = driver.podiums ?? '-';

    return `<article class="driver-number-card" style="--team-color:${c}" data-driver-id="${esc(driver.driver_id)}">
      <div class="driver-bg-number">${esc(driver.number || '-')}</div>
      <div class="driver-card-top"><span class="driver-flag">🏁</span><b>#${esc(driver.number || '-')}</b></div>
      <div class="driver-card-main"><h3>${esc(driver.name)}</h3><p>${esc(driver.current_team || driver.team_name || 'Equipe não informada')}</p></div>
      <div class="driver-tags">${tags}</div>
      <div class="driver-index-row">
        <span>Corridas <b>${esc(starts)}</b></span>
        <span>Vitórias <b>${esc(wins)}</b></span>
        <span>Pódios <b>${esc(podiums)}</b></span>
      </div>
      <div class="driver-index-row driver-index-row-secondary">
        <span>Cons. <b>${esc(idx.consistency ?? '-')}</b></span>
        <span>Ritmo <b>${esc(idx.race_pace ?? '-')}</b></span>
        <span>Quali <b>${esc(idx.qualifying ?? '-')}</b></span>
      </div>
    </article>`;
  }

  function renderDriverDetail(driver) {
    const panel = $('#driver-detail-panel');
    if (!panel) return;
    const idx = driver.indexes || {};
    const indexLabels = { consistency: 'Consistência', race_pace: 'Ritmo de corrida', qualifying: 'Classificação' };

    panel.innerHTML = `<span class="page-kicker">Perfil do piloto</span><h3>${esc(driver.name || 'Selecione um piloto')}</h3><p>${esc(driver.style_summary || 'Clique em um card para ver a leitura completa.')}</p>
      <div class="profile-stats">
        ${metric('Títulos', driver.titles ?? '-', driver.years_active || '')}
        ${metric('Corridas', driver.starts ?? '-', `${driver.seasons ?? '-'} temporadas`)}
        ${metric('Vitórias', driver.wins ?? '-', `${driver.points ?? '-'} pontos`)}
        ${metric('Pódios', driver.podiums ?? '-', 'resultados')}
        ${metric('Poles', driver.poles ?? '-', 'classificação')}
        ${metric('Média chegada', driver.avg_finish ?? '-', 'posição final')}
      </div>
      <div class="style-bars">
        ${Object.entries(idx).map(([k, v]) => `<label><span>${esc(indexLabels[k] || k)}</span><i><em style="width:${Number(v) || 0}%"></em></i><b>${esc(v)}</b></label>`).join('')}
      </div>`;
  }

  function renderDrivers() {
    const gallery = $('#drivers-gallery');
    const search = $('#driver-search');
    const filter = $('#driver-status-filter');
    if (!gallery) return;

    const query = String(search?.value || '').toLowerCase();
    const status = filter?.value || 'all';
    const maxYear = Math.max(...state.data.drivers.map((driver) => Number(driver.year || 0)).filter(Number.isFinite), 0);
    const championNames = new Set(['Juan Manuel Fangio', 'Alberto Ascari', 'Jack Brabham', 'Graham Hill', 'Jim Clark', 'Jackie Stewart', 'Niki Lauda', 'James Hunt', 'Mario Andretti', 'Jody Scheckter', 'Alan Jones', 'Nelson Piquet', 'Keke Rosberg', 'Alain Prost', 'Ayrton Senna', 'Nigel Mansell', 'Michael Schumacher', 'Damon Hill', 'Jacques Villeneuve', 'Mika Hakkinen', 'Fernando Alonso', 'Kimi Raikkonen', 'Lewis Hamilton', 'Jenson Button', 'Sebastian Vettel', 'Nico Rosberg', 'Max Verstappen']);

    const drivers = state.data.drivers.filter((driver) => {
      const haystack = [driver.name, driver.country, driver.current_team, driver.status, driver.year, driver.years_active, ...(driver.style_tags || [])].join(' ').toLowerCase();
      const isActive = driver.status_category === 'active' || (maxYear && Number(driver.year || 0) >= maxYear - 1);
      const isChampion = championNames.has(driver.name) || Number(driver.titles || 0) > 0;
      const statusOk = status === 'all'
        || (status === 'active' && isActive)
        || (status === 'historical' && !isActive)
        || (status === 'champion' && isChampion);
      return statusOk && haystack.includes(query);
    }).sort((a, b) => {
      return Number(b.year || 0) - Number(a.year || 0)
        || Number(b.wins || 0) - Number(a.wins || 0)
        || Number(b.podiums || 0) - Number(a.podiums || 0)
        || String(a.name || '').localeCompare(String(b.name || ''));
    });

    gallery.innerHTML = drivers.map(driverCard).join('') || '<div class="empty-page-state">Nenhum piloto encontrado.</div>';
    gallery.querySelectorAll('.driver-number-card').forEach((card) => {
      card.addEventListener('click', () => {
        const driver = state.data.drivers.find((item) => item.driver_id === card.dataset.driverId);
        if (driver) renderDriverDetail(driver);
      });
    });
    renderDriverDetail(drivers[0] || {});
  }

  function renderTeams() {
    const el = $('#teams-gallery');
    if (!el) return;
    el.innerHTML = state.data.teams.map((team) => `<article class="team-card panel" style="--team-color:${color(team.color)}"><span>${esc(team.country)}</span><h3>${esc(team.name)}</h3><p>${esc(team.summary)}</p><div>${metric('Títulos', team.titles)}${metric('Vitórias', team.wins)}${metric('Era', team.era)}</div></article>`).join('');
  }

  function renderCircuits() {
    const el = $('#circuits-gallery');
    if (!el) return;
    el.innerHTML = state.data.circuits.map((circuit) => `<article class="circuit-card panel"><div class="fake-circuit-map"></div><span>${esc(circuit.country)}</span><h3>${esc(circuit.name)}</h3><p>${esc(circuit.summary)}</p><div class="chip-row"><b>${esc(circuit.profile)}</b><b>${esc(circuit.length_km)} km</b><b>${esc(circuit.layout_versions)} layouts</b></div></article>`).join('');
  }

  function renderAnalytics() {
    const cmp = $('#analytics-driver-compare');
    if (cmp) {
      const drivers = [...state.data.drivers]
        .sort((a, b) => Number(a.number || a.driver_number || 999) - Number(b.number || b.driver_number || 999))
        .slice(0, 8);
      cmp.innerHTML = drivers.map((driver) => metric(driver.name, driver.current_team || '-', `ano base ${driver.year || '-'}`)).join('');
    }

    const list = $('#analytics-index-list');
    if (list) {
      const byYear = state.data.meetings.reduce((acc, item) => {
        const year = item.year || 'Sem ano';
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {});
      const topYears = Object.entries(byYear)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .slice(0, 8);
      list.innerHTML = topYears.map(([year, count]) => `<article><b>◉</b><span>${esc(year)} · ${esc(count)} corridas conectadas</span></article>`).join('');
    }
  }

  function renderSimulation() {
    const el = $('#simulation-results');
    if (!el) return;

    const sessionsWithReplay = state.data.sessions.filter((item) => item.has_simulation || item.recommended_frontend_mode || item.session_key);
    const estimated = sessionsWithReplay.filter((item) => String(item.recommended_frontend_mode || '').includes('estimated')).length;
    const realLike = Math.max(0, sessionsWithReplay.length - estimated);

    el.innerHTML = [
      metric('Sessões prontas', sessionsWithReplay.length || '-', 'carregadas da base local'),
      metric('Replays estimados', estimated || '-', 'gerados por resultado/voltas'),
      metric('Replays detalhados', realLike || '-', 'com maior granularidade'),
      metric('Chamadas externas', '0', 'OpenF1 bloqueada nesta versão')
    ].join('');
  }



  function buildOptions(items, labelKey = 'name', valueKey = 'id') {
    return items.map((item, index) => {
      const label = item[labelKey] || item.name || item.driver_id || item.team_id || `Item ${index + 1}`;
      const value = item[valueKey] || item.driver_id || item.team_id || item.circuit_id || label;
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join('');
  }

  function getCustomRaceState() {
    const selectedDrivers = $$('.custom-driver-row').map((row) => ({
      driverId: row.querySelector('[data-custom-driver]')?.value,
      carId: row.querySelector('[data-custom-car]')?.value,
      strategy: row.querySelector('[data-custom-strategy]')?.value
    })).filter((item) => item.driverId);

    return {
      year: $('#custom-race-year')?.value || '2026',
      circuit: $('#custom-race-circuit')?.value || '',
      session: $('#custom-race-session')?.value || 'race',
      weather: $('#custom-race-weather')?.value || 'dry',
      trackTemp: $('#custom-race-track-temp')?.value || 'normal',
      balance: $('#custom-race-balance')?.value || 'same-car',
      selectedDrivers
    };
  }

  function customDriverRow(index, driverId = '', carId = '') {
    const drivers = state.data.drivers;
    const teams = state.data.teams;
    const firstDriver = drivers[index] || drivers[0] || {};
    const firstTeam = teams[index % Math.max(teams.length, 1)] || teams[0] || {};
    const selectedDriver = driverId || firstDriver.driver_id || '';
    const selectedCar = carId || firstTeam.team_id || firstTeam.name || '';

    return `<article class="custom-driver-row" data-custom-row="${index}">
      <div class="custom-grid-number">${String(index + 1).padStart(2, '0')}</div>
      <label>Piloto
        <select class="glass-input" data-custom-driver>${drivers.map((driver) => `<option value="${esc(driver.driver_id)}" ${driver.driver_id === selectedDriver ? 'selected' : ''}>${esc(driver.name)}</option>`).join('')}</select>
      </label>
      <label>Carro / equipe
        <select class="glass-input" data-custom-car>${teams.map((team) => {
          const value = team.team_id || team.name;
          return `<option value="${esc(value)}" ${value === selectedCar ? 'selected' : ''}>${esc(team.name)}</option>`;
        }).join('')}</select>
      </label>
      <label>Estratégia
        <select class="glass-input" data-custom-strategy>
          <option value="balanced">Equilibrada</option>
          <option value="aggressive">Agressiva</option>
          <option value="tyre-save">Conservar pneus</option>
          <option value="undercut">Undercut</option>
          <option value="overcut">Overcut</option>
        </select>
      </label>
      <button class="custom-remove-driver" type="button" aria-label="Remover piloto">×</button>
    </article>`;
  }

  function renderCustomSummary() {
    const el = $('#custom-race-summary');
    if (!el) return;
    const custom = getCustomRaceState();
    const circuit = state.data.circuits.find((item) => String(item.circuit_id || item.name) === String(custom.circuit));
    const drivers = custom.selectedDrivers.map((item) => state.data.drivers.find((driver) => driver.driver_id === item.driverId)).filter(Boolean);
    const avgConsistency = Math.round(drivers.reduce((sum, driver) => sum + Number(driver.indexes?.consistency || 0), 0) / Math.max(drivers.length, 1));
    const avgRacePace = Math.round(drivers.reduce((sum, driver) => sum + Number(driver.indexes?.race_pace || 0), 0) / Math.max(drivers.length, 1));

    el.innerHTML = `
      ${metric('Ano', custom.year, 'temporada simulada')}
      ${metric('Pista', circuit?.name || 'Não definida', circuit?.profile || 'layout dinâmico')}
      ${metric('Clima', custom.weather, custom.trackTemp)}
      ${metric('Pilotos', drivers.length, 'no grid customizado')}
      ${metric('Consistência média', avgConsistency || '-', 'índice agregado')}
      ${metric('Ritmo médio', avgRacePace || '-', 'índice agregado')}
      <article class="custom-fairness-note">
        <strong>Critério de justiça</strong>
        <p>${custom.balance === 'same-car'
          ? 'Todos os pilotos são avaliados no mesmo carro base, reduzindo o peso da diferença de equipamento.'
          : custom.balance === 'era-normalized'
            ? 'A diferença entre eras será normalizada para comparar habilidade relativa, não apenas resultado bruto.'
            : custom.balance === 'team-context'
              ? 'A leitura considera contexto de equipe, confiabilidade e força do carro por temporada.'
              : 'Cada piloto usa o carro escolhido, permitindo comparar habilidade dentro de cenários personalizados.'}</p>
      </article>`;
  }

  function bindCustomRaceEvents() {
    ['#custom-race-year', '#custom-race-circuit', '#custom-race-session', '#custom-race-weather', '#custom-race-track-temp', '#custom-race-balance'].forEach((selector) => {
      $(selector)?.addEventListener('change', renderCustomSummary);
    });

    $('#custom-add-driver')?.addEventListener('click', () => {
      const grid = $('#custom-driver-grid');
      if (!grid) return;
      const count = grid.querySelectorAll('.custom-driver-row').length;
      grid.insertAdjacentHTML('beforeend', customDriverRow(count));
      bindCustomDriverRows();
      renderCustomSummary();
    });

    $('#custom-reset-grid')?.addEventListener('click', () => {
      const grid = $('#custom-driver-grid');
      if (!grid) return;
      grid.innerHTML = Array.from({ length: Math.min(6, state.data.drivers.length || 6) }, (_, index) => customDriverRow(index)).join('');
      bindCustomDriverRows();
      renderCustomSummary();
    });
  }

  function bindCustomDriverRows() {
    $$('.custom-driver-row select').forEach((select) => select.onchange = renderCustomSummary);
    $$('.custom-remove-driver').forEach((button) => {
      button.onclick = () => {
        button.closest('.custom-driver-row')?.remove();
        $$('.custom-driver-row').forEach((row, index) => {
          row.dataset.customRow = String(index);
          const n = row.querySelector('.custom-grid-number');
          if (n) n.textContent = String(index + 1).padStart(2, '0');
        });
        renderCustomSummary();
      };
    });
  }

  function renderCustomRace() {
    const year = $('#custom-race-year');
    const circuit = $('#custom-race-circuit');
    const grid = $('#custom-driver-grid');
    if (!year || !circuit || !grid) return;

    year.innerHTML = Array.from({ length: 77 }, (_, i) => 1950 + i).reverse().map((y) => `<option value="${y}" ${y === 2026 ? 'selected' : ''}>${y}</option>`).join('');
    circuit.innerHTML = state.data.circuits.map((item) => `<option value="${esc(item.circuit_id || item.name)}">${esc(item.name)}</option>`).join('');
    grid.innerHTML = Array.from({ length: Math.min(6, state.data.drivers.length || 6) }, (_, index) => customDriverRow(index)).join('');

    bindCustomRaceEvents();
    bindCustomDriverRows();
    renderCustomSummary();
  }

  function renderAll() {
    renderDashboard();
    renderDrivers();
    renderTeams();
    renderCircuits();
    renderAnalytics();
    renderSimulation();
    renderCustomRace();
  }

  async function boot() {
    if (!window.F1PlatformData) return;
    state.data = await window.F1PlatformData.loadPlatformData();
    $('#driver-search')?.addEventListener('input', renderDrivers);
    $('#driver-status-filter')?.addEventListener('change', renderDrivers);
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
