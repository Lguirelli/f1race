(function () {
  'use strict';

  const CONFIG = {
    startYear: 1950,
    endYear: 2026,
    loadLocationOnSessionLoad: false,
    locationSampleSeconds: 4,
    loadCarDataOnDriverClick: false,
    carDataSampleSeconds: 4,
    simulationTickMs: 750,
    simulationStepSeconds: 25,
    allowedSessionNames: [
      'Race',
      'Qualifying',
      'Sprint',
      'Sprint Qualifying',
      'Sprint Shootout'
    ]
  };

  const TIME_SERIES_KEYS = [
    'positions',
    'intervals',
    'laps',
    'weather',
    'pit',
    'raceControl',
    'location',
    'carData'
  ];

  const AppState = {
    year: null,
    meeting: null,
    session: null,
    bundle: null,
    sourceBundle: null,
    loadedSessionKey: null,
    selectedDriverNumber: null,
    hiddenTeams: new Set(),
    dimMode: 'dim',
    isLive: false,
    loading: false,
    loadingCarDataFor: null,
    simulation: {
      timer: null,
      startTime: null,
      endTime: null,
      currentTime: null,
      elapsedSeconds: 0,
      progress: 0,
      running: false
    }
  };

  function u() {
    return window.OpenF1Utils;
  }

  function api() {
    return window.OpenF1API;
  }

  function renderers() {
    return window.OpenF1Renderers;
  }

  function elements() {
    return {
      yearSelect: document.getElementById('yearSelect'),
      trackSelect: document.getElementById('trackSelect'),
      sessionSelect: document.getElementById('sessionSelect'),
      loadHistoryBtn: document.getElementById('loadHistoryBtn'),
      resetTeams: document.getElementById('reset-teams'),
      toggleAll: document.getElementById('toggle-all'),
      modeDim: document.getElementById('mode-dim'),
      modeHide: document.getElementById('mode-hide')
    };
  }

  function fillSelect(select, items, getValue, getLabel, placeholder) {
    if (!select) return;

    select.innerHTML = '';

    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.appendChild(first);

    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = getValue(item);
      option.textContent = getLabel(item);
      option.dataset.raw = JSON.stringify(item);
      select.appendChild(option);
    });
  }

  function getSelectedRaw(select) {
    const option = select?.options?.[select.selectedIndex];
    if (!option?.dataset?.raw) return null;

    try {
      return JSON.parse(option.dataset.raw);
    } catch {
      return null;
    }
  }

  function setButtonLoading(isLoading, label = 'Visualizar') {
    const { loadHistoryBtn } = elements();
    if (!loadHistoryBtn) return;

    AppState.loading = isLoading;
    loadHistoryBtn.disabled = isLoading || !AppState.session;
    loadHistoryBtn.textContent = isLoading ? 'Carregando...' : label;
  }

  function syncAllCheckbox() {
    const { toggleAll } = elements();
    if (!toggleAll || !AppState.bundle) return;

    const teams = new Set(
      (AppState.bundle.drivers || []).map((driver) => driver.team_name || 'Sem equipe')
    );

    toggleAll.checked = AppState.hiddenTeams.size === 0;
    toggleAll.indeterminate = AppState.hiddenTeams.size > 0 && AppState.hiddenTeams.size < teams.size;
  }

  function setSelectState({ trackDisabled = true, sessionDisabled = true, loadDisabled = true } = {}) {
    const { trackSelect, sessionSelect, loadHistoryBtn } = elements();

    if (trackSelect) trackSelect.disabled = trackDisabled;
    if (sessionSelect) sessionSelect.disabled = sessionDisabled;
    if (loadHistoryBtn) loadHistoryBtn.disabled = loadDisabled;
  }

  function initYears() {
    const years = [];

    for (let year = CONFIG.startYear; year <= CONFIG.endYear; year += 1) {
      years.push({ year });
    }

    fillSelect(
      elements().yearSelect,
      years.reverse(),
      (item) => item.year,
      (item) => String(item.year),
      'Selecionar ano'
    );
  }

  function allowedSession(session) {
    const name = String(session.session_name || '').toLowerCase();

    return CONFIG.allowedSessionNames.some((allowed) => name === allowed.toLowerCase())
      || name.includes('race')
      || name.includes('qualifying')
      || name.includes('sprint');
  }

  function clearTrackLayer() {
    const carsLayer = document.getElementById('cars-layer');
    if (carsLayer) carsLayer.innerHTML = '';

    const mapLabel = document.querySelector('#track-svg .map-label');
    if (mapLabel) mapLabel.remove();

    const staticTexts = document.querySelectorAll(
      '#track-svg > text, #track-svg .placeholder-text, #track-svg .empty-text, #track-svg .loading-text, #track-svg .map-placeholder'
    );

    staticTexts.forEach((item) => item.remove());
  }

  function resetSessionData() {
    stopSimulation(false);

    AppState.bundle = null;
    AppState.sourceBundle = null;
    AppState.loadedSessionKey = null;
    AppState.selectedDriverNumber = null;
    AppState.hiddenTeams = new Set();
    AppState.loadingCarDataFor = null;
    AppState.isLive = false;

    clearTrackLayer();

    if (!AppState.sourceBundle && !AppState.bundle) {
      renderInitialEmptyState();
    }
  }

  async function onYearChange() {
    const { yearSelect, trackSelect, sessionSelect } = elements();
    const year = yearSelect?.value;

    AppState.year = year || null;
    AppState.meeting = null;
    AppState.session = null;

    resetSessionData();

    fillSelect(trackSelect, [], () => '', () => '', 'Carregando corridas...');
    fillSelect(sessionSelect, [], () => '', () => '', 'Selecionar sessão');

    setSelectState({
      trackDisabled: true,
      sessionDisabled: true,
      loadDisabled: true
    });

    if (!year) {
      fillSelect(trackSelect, [], () => '', () => '', 'Selecionar pista');
      return;
    }

    try {
      u().setStatus(`Buscando corridas de ${year} na base local...`, 'loading');

      const meetings = await api().getMeetingsByYear(year);

      fillSelect(
        trackSelect,
        meetings,
        (item) => item.meeting_key,
        (item) => item.meeting_name || item.circuit_short_name || item.location || `Meeting ${item.meeting_key}`,
        meetings.length ? 'Selecionar pista' : 'Nenhuma corrida encontrada'
      );

      setSelectState({
        trackDisabled: !meetings.length,
        sessionDisabled: true,
        loadDisabled: true
      });

      u().setStatus(
        meetings.length ? '' : `Nenhuma corrida encontrada para ${year}.`,
        meetings.length ? 'info' : 'error'
      );
    } catch (error) {
      console.error(error);

      fillSelect(trackSelect, [], () => '', () => '', 'Erro ao carregar corridas');
      u().setStatus('Erro ao buscar corridas na base local.', 'error');
    }
  }

  async function onTrackChange() {
    const { trackSelect, sessionSelect } = elements();
    const meeting = getSelectedRaw(trackSelect);

    AppState.meeting = meeting;
    AppState.session = null;

    resetSessionData();

    fillSelect(sessionSelect, [], () => '', () => '', 'Carregando sessões...');

    setSelectState({
      trackDisabled: false,
      sessionDisabled: true,
      loadDisabled: true
    });

    if (!meeting) {
      fillSelect(sessionSelect, [], () => '', () => '', 'Selecionar sessão');
      return;
    }

    try {
      u().setStatus(`Buscando sessões de ${meeting.meeting_name || meeting.location}...`, 'loading');

      const sessions = await api().getSessionsByMeeting(meeting.meeting_key);
      const filtered = sessions.filter(allowedSession);

      fillSelect(
        sessionSelect,
        filtered,
        (item) => item.session_key,
        (item) => u().translateSessionName(item.session_name || `Sessão ${item.session_key}`),
        filtered.length ? 'Selecionar sessão' : 'Nenhuma sessão encontrada'
      );

      setSelectState({
        trackDisabled: false,
        sessionDisabled: !filtered.length,
        loadDisabled: true
      });

      u().setStatus(
        filtered.length ? '' : 'Nenhuma sessão de corrida, quali ou sprint encontrada.',
        filtered.length ? 'info' : 'error'
      );
    } catch (error) {
      console.error(error);

      fillSelect(sessionSelect, [], () => '', () => '', 'Erro ao carregar sessões');
      u().setStatus('Erro ao buscar sessões na base local.', 'error');
    }
  }

  function onSessionChange() {
    const { sessionSelect, loadHistoryBtn } = elements();

    AppState.session = getSelectedRaw(sessionSelect);

    resetSessionData();

    if (loadHistoryBtn) {
      loadHistoryBtn.disabled = !AppState.session;
      loadHistoryBtn.textContent = 'Visualizar';
    }
  }

  function selectFirstDriverIfNeeded() {
    if (AppState.selectedDriverNumber || !AppState.bundle) return;

    const standings = renderers().buildStandings(AppState);

    if (standings[0]) {
      AppState.selectedDriverNumber = Number(standings[0].driver.driver_number);
    }
  }

  function renderAll() {
    if (!AppState.bundle) return;

    selectFirstDriverIfNeeded();

    renderers().renderAll(AppState, {
      onDriverSelect,
      onTeamFilterChange: () => {
        syncAllCheckbox();

        renderers().renderLeftColumn(AppState, {
          onDriverSelect,
          onTeamFilterChange: renderAll
        });

        renderers().renderTrackMap(AppState, {
          onDriverSelect
        });
      }
    });

    syncAllCheckbox();
  }

  function dateMsFromItem(item) {
    const ms = u().itemDate(item).getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }

  function getTimelineBounds(bundle) {
    const allTimes = [];
    const primaryTimes = [];
    const primaryKeys = new Set(['location', 'positions', 'laps', 'intervals']);

    TIME_SERIES_KEYS.forEach((key) => {
      (bundle?.[key] || []).forEach((item) => {
        const ms = dateMsFromItem(item);

        if (ms === null) return;

        allTimes.push(ms);

        if (primaryKeys.has(key)) {
          primaryTimes.push(ms);
        }
      });
    });

    if (!allTimes.length) return null;

    return {
      startTime: Math.min(...(primaryTimes.length ? primaryTimes : allTimes)),
      endTime: Math.max(...allTimes)
    };
  }

  function filterByCurrentTime(items, currentTime) {
    return [...(items || [])].filter((item) => {
      const ms = dateMsFromItem(item);
      return ms === null || ms <= currentTime;
    });
  }

  function currentLapNumber(bundle) {
    return u().maxValid(bundle?.laps || [], (lap) => lap.lap_number);
  }

  function filterStintsByLap(stints, lapNumber) {
    if (!Array.isArray(stints)) return [];

    return stints.filter((stint) => {
      const lapStart = u().asNumber(stint.lap_start ?? stint.start_lap ?? stint.lap_number);

      if (lapStart === null) return lapNumber !== null;
      if (lapNumber === null) return lapStart <= 1;

      return lapStart <= lapNumber;
    });
  }

  function buildBundleAtTime(sourceBundle, currentTime, finished = false) {
    const partial = {
      drivers: [...(sourceBundle?.drivers || [])],
      positions: filterByCurrentTime(sourceBundle?.positions || [], currentTime),
      intervals: filterByCurrentTime(sourceBundle?.intervals || [], currentTime),
      laps: filterByCurrentTime(sourceBundle?.laps || [], currentTime),
      weather: filterByCurrentTime(sourceBundle?.weather || [], currentTime),
      stints: [],
      pit: filterByCurrentTime(sourceBundle?.pit || [], currentTime),
      raceControl: filterByCurrentTime(sourceBundle?.raceControl || [], currentTime),
      sessionResult: finished ? [...(sourceBundle?.sessionResult || [])] : [],
      startingGrid: [...(sourceBundle?.startingGrid || [])],
      location: filterByCurrentTime(sourceBundle?.location || [], currentTime),
      carData: filterByCurrentTime(sourceBundle?.carData || [], currentTime)
    };

    partial.stints = filterStintsByLap(sourceBundle?.stints || [], currentLapNumber(partial));

    return partial;
  }

  function formatSimulationClock(currentTime) {
    const date = new Date(currentTime);

    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function updateSimulationStatus(finished = false) {
    const lap = currentLapNumber(AppState.bundle);
    const clock = AppState.simulation.currentTime
      ? formatSimulationClock(AppState.simulation.currentTime)
      : '--:--:--';

    if (finished) {
      u().setStatus('Simulação finalizada. Clique em “Reiniciar simulação” para rodar de novo.', 'sim');
      return;
    }

    u().setStatus(
      `Simulação histórica em tempo real · ${clock}${lap ? ` · Volta ${lap}` : ''}`,
      'sim'
    );
  }

  function applySimulationFrame(currentTime, finished = false) {
    if (!AppState.sourceBundle) return;

    const startTime = AppState.simulation.startTime || currentTime;
    const endTime = AppState.simulation.endTime || currentTime;
    const duration = Math.max(1, endTime - startTime);
    const elapsed = Math.max(0, currentTime - startTime);

    AppState.simulation.currentTime = currentTime;
    AppState.simulation.elapsedSeconds = elapsed / 1000;
    AppState.simulation.progress = Math.max(0, Math.min(1, elapsed / duration));
    AppState.bundle = buildBundleAtTime(AppState.sourceBundle, currentTime, finished);
    AppState.isLive = !finished;

    document.body.classList.remove('empty-state');

    renderAll();
    updateSimulationStatus(finished);
  }

  function stopSimulation(clearStatus = true) {
    if (AppState.simulation.timer) {
      window.clearInterval(AppState.simulation.timer);
    }

    AppState.simulation.timer = null;
    AppState.simulation.running = false;
    AppState.isLive = false;

    document.body.classList.remove('simulation-mode');

    if (clearStatus) {
      u().setStatus('', 'info');
    }
  }

  function startSimulation() {
    if (!AppState.sourceBundle) return;

    stopSimulation(false);

    const bounds = getTimelineBounds(AppState.sourceBundle);

    if (!bounds) {
      AppState.bundle = AppState.sourceBundle;
      AppState.isLive = false;

      document.body.classList.remove('empty-state');

      renderAll();

      u().setStatus('Sessão carregada, mas sem timestamps suficientes para simulação.', 'info');
      setButtonLoading(false, 'Visualizar');

      return;
    }

    AppState.simulation.startTime = bounds.startTime;
    AppState.simulation.endTime = bounds.endTime;
    AppState.simulation.currentTime = bounds.startTime;
    AppState.simulation.running = true;

    document.body.classList.add('simulation-mode');

    applySimulationFrame(bounds.startTime, false);
    setButtonLoading(false, 'Reiniciar simulação');

    AppState.simulation.timer = window.setInterval(() => {
      const nextTime = AppState.simulation.currentTime + (CONFIG.simulationStepSeconds * 1000);

      if (nextTime >= AppState.simulation.endTime) {
        stopSimulation(false);
        applySimulationFrame(AppState.simulation.endTime, true);
        setButtonLoading(false, 'Reiniciar simulação');
        return;
      }

      applySimulationFrame(nextTime, false);
    }, CONFIG.simulationTickMs);
  }

  async function onLoadSession() {
    if (!AppState.session) return;

    const sessionKey = AppState.session.session_key;

    if (AppState.sourceBundle && AppState.loadedSessionKey === sessionKey) {
      startSimulation();
      return;
    }

    stopSimulation(false);
    clearTrackLayer();

    setButtonLoading(true);

    u().setStatus('Carregando replay local da corrida...', 'loading');

    try {
      const sourceBundle = await api().getSessionCoreBundle(sessionKey);

      if (CONFIG.loadLocationOnSessionLoad) {
        u().setStatus('Carregando posições históricas locais...', 'loading');

        sourceBundle.location = await api().getLocationForSession(
          sessionKey,
          CONFIG.locationSampleSeconds
        );
      }

      AppState.sourceBundle = sourceBundle;
      AppState.loadedSessionKey = sessionKey;
      AppState.hiddenTeams = new Set();
      AppState.selectedDriverNumber = null;
      AppState.bundle = sourceBundle;

      startSimulation();
    } catch (error) {
      console.error(error);

      u().setStatus('Erro ao carregar a sessão selecionada.', 'error');
      setButtonLoading(false, 'Visualizar');
    }
  }

  function getTelemetryBundle() {
    return AppState.sourceBundle || AppState.bundle;
  }

  function hasCarDataFor(driverNumber) {
    const bundle = getTelemetryBundle();

    return (bundle?.carData || []).some((item) => {
      return Number(item.driver_number) === Number(driverNumber);
    });
  }

  function refreshCurrentSimulationFrame() {
    if (!AppState.sourceBundle) return;

    if (AppState.simulation.currentTime) {
      const finished = !AppState.simulation.running
        && AppState.simulation.currentTime >= AppState.simulation.endTime;

      AppState.bundle = buildBundleAtTime(
        AppState.sourceBundle,
        AppState.simulation.currentTime,
        finished
      );
    } else {
      AppState.bundle = AppState.sourceBundle;
    }
  }

  async function onDriverSelect(driverNumber) {
    if (!AppState.bundle && !AppState.sourceBundle) return;

    AppState.selectedDriverNumber = Number(driverNumber);

    renderAll();

    if (!CONFIG.loadCarDataOnDriverClick || !AppState.session || hasCarDataFor(driverNumber)) {
      return;
    }

    AppState.loadingCarDataFor = Number(driverNumber);

    renderers().renderDriverPanel(AppState);

    try {
      const carData = await api().getCarDataForDriver(
        AppState.session.session_key,
        driverNumber,
        CONFIG.carDataSampleSeconds
      );

      const targetBundle = getTelemetryBundle();

      targetBundle.carData = [
        ...(targetBundle.carData || []).filter((item) => {
          return Number(item.driver_number) !== Number(driverNumber);
        }),
        ...carData
      ];

      if (AppState.sourceBundle && targetBundle !== AppState.sourceBundle) {
        AppState.sourceBundle.carData = targetBundle.carData;
      }

      refreshCurrentSimulationFrame();
    } catch (error) {
      console.warn('Erro ao carregar car_data do piloto.', error);
    } finally {
      AppState.loadingCarDataFor = null;
      renderers().renderDriverPanel(AppState);
    }
  }

  function setupControls() {
    const {
      yearSelect,
      trackSelect,
      sessionSelect,
      loadHistoryBtn,
      resetTeams,
      toggleAll,
      modeDim,
      modeHide
    } = elements();

    yearSelect?.addEventListener('change', onYearChange);
    trackSelect?.addEventListener('change', onTrackChange);
    sessionSelect?.addEventListener('change', onSessionChange);
    loadHistoryBtn?.addEventListener('click', onLoadSession);

    resetTeams?.addEventListener('click', () => {
      AppState.hiddenTeams = new Set();
      renderAll();
    });

    toggleAll?.addEventListener('change', (event) => {
      if (!AppState.bundle) return;

      const allTeams = new Set(
        (AppState.bundle.drivers || []).map((driver) => driver.team_name || 'Sem equipe')
      );

      AppState.hiddenTeams = event.target.checked ? new Set() : allTeams;

      renderAll();
    });

    modeDim?.addEventListener('click', () => {
      AppState.dimMode = 'dim';

      modeDim.classList.add('active');
      modeHide?.classList.remove('active');

      renderAll();
    });

    modeHide?.addEventListener('click', () => {
      AppState.dimMode = 'hide';

      modeHide.classList.add('active');
      modeDim?.classList.remove('active');

      renderAll();
    });
  }


  function renderInitialEmptyState() {
    const util = u();

    document.body.classList.add('empty-state');
    document.body.classList.remove('history-mode', 'simulation-mode');

    util.safeSetText('raceTitle', 'Nenhuma corrida selecionada');
    util.safeSetHTML('raceSubtitle', 'Selecione ano, pista e sessão para visualizar os dados.');

    util.safeSetText('weather-air-temp', '-');
    util.safeSetText('weather-humidity', '-');
    util.safeSetText('weather-wind', '-');

    const weatherTexts = document.querySelectorAll('.weather-panel article span');
    if (weatherTexts[0]) weatherTexts[0].textContent = 'Clima';
    if (weatherTexts[1]) weatherTexts[1].textContent = 'Umidade';
    if (weatherTexts[2]) weatherTexts[2].textContent = 'Vento';

    util.safeSetText('lap-counter', '-');
    util.safeSetText('sector-1-value', '-');
    util.safeSetText('sector-1-gap', '-');
    util.safeSetText('sector-2-value', '-');
    util.safeSetText('sector-2-gap', '-');
    util.safeSetText('sector-3-value', '-');
    util.safeSetText('sector-3-gap', '-');

    const teamList = document.getElementById('team-list');
    if (teamList) teamList.innerHTML = '';

    const standingsList = document.getElementById('standings-list');
    if (standingsList) standingsList.innerHTML = '';

    const driverCard = document.getElementById('driver-card');
    if (driverCard) driverCard.innerHTML = '';

    const footer = document.querySelector('.status-grid');
    if (footer) {
      footer.innerHTML = `
        <article>
          <span class="status-icon purple">◴</span>
          <div>
            <small>Melhor volta</small>
            <strong class="purple-text">-</strong>
            <em>-</em>
          </div>
        </article>

        <article>
          <span class="track-mini"></span>
          <div>
            <small>Status da pista</small>
            <strong class="green-text">-</strong>
            <em>-</em>
          </div>
        </article>

        <article>
          <span class="tyre-icon">-</span>
          <div>
            <small>Pneu dominante</small>
            <strong class="yellow-text">-</strong>
            <em>-</em>
          </div>
        </article>

        <article>
          <span class="status-icon">◎</span>
          <div>
            <small>Controle de corrida</small>
            <strong class="green-text">-</strong>
            <em>-</em>
          </div>
        </article>
      `;
    }

    clearTrackLayer();
  }

  function renderEmptyMapMessage() {
    clearTrackLayer();
  }

  async function boot() {
    if (!window.OpenF1Utils || !window.OpenF1API || !window.OpenF1Renderers) {
      throw new Error('Arquivos do visualizador local não foram carregados na ordem correta.');
    }

    await renderers().prepareCarAsset();

    initYears();
    setupControls();

    setSelectState({
      trackDisabled: true,
      sessionDisabled: true,
      loadDisabled: true
    });

    renderInitialEmptyState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
