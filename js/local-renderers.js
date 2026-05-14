(function () {
  'use strict';

  const CAR_ASSET_PATH = './assets/f1-car-detailed.svg';
  let carSvgInner = '';

  async function prepareCarAsset() {
    if (carSvgInner) return;

    try {
      const response = await fetch(CAR_ASSET_PATH);
      if (!response.ok) throw new Error('asset não encontrado');

      const svgText = await response.text();
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('asset inválido');

      carSvgInner = svg.innerHTML;
    } catch (error) {
      console.warn('Carro detalhado indisponível. Usando fallback vetorial.', error);
      carSvgInner = '';
    }
  }

  function buildCarIcon(color) {
    if (!carSvgInner) {
      return `
        <g class="fallback-car">
          <ellipse cx="0" cy="3" rx="24" ry="10" fill="rgba(0,0,0,.42)"></ellipse>
          <path d="M-28 0 C-16 -11 5 -14 24 -7 C33 -4 38 -1 40 0 C38 1 33 4 24 7 C5 14 -16 11 -28 0 Z" fill="${color}" stroke="rgba(255,255,255,.75)" stroke-width="1.2"></path>
          <ellipse cx="7" cy="0" rx="8" ry="5" fill="#0a1118"></ellipse>
          <rect x="-34" y="-10" width="8" height="20" rx="2" fill="#111"></rect>
          <rect x="34" y="-9" width="8" height="18" rx="2" fill="#111"></rect>
        </g>
      `;
    }

    return `
      <svg
        class="embedded-f1-car"
        x="-24"
        y="-11"
        width="48"
        height="22"
        viewBox="0 0 360 160"
        preserveAspectRatio="xMidYMid meet"
        style="--team-primary:${color};--team-secondary:#11141a;--team-accent:#ffffff;--team-detail:${color};"
      >${carSvgInner}</svg>
    `;
  }

  function utils() {
    return window.F1LocalUtils;
  }

  function getDriver(state, driverNumber) {
    return (state.bundle?.drivers || []).find((driver) => Number(driver.driver_number) === Number(driverNumber));
  }

  function getDriverLabel(driver) {
    return utils().driverLabel(driver);
  }

  function getDriverName(driver) {
    return utils().driverName(driver);
  }

  function setSectorClass(valueId, type) {
    const valueElement = document.getElementById(valueId);
    const card = valueElement?.closest('.sector-card');
    if (!card) return;

    card.classList.remove('green', 'purple', 'yellow');
    card.classList.add(type);
  }

  function renderHeader(state) {
    const u = utils();
    const meeting = state.meeting;
    const session = state.session;
    const weather = u.latestByDate(state.bundle?.weather || []);

    const raceName = meeting?.meeting_name || 'Grand Prix';
    const sessionName = u.translateSessionName(session?.session_name || 'Sessão');
    const circuit = meeting?.circuit_short_name || meeting?.location || meeting?.country_name || 'Circuito';
    const flag = u.countryFlag(meeting?.country_code);

    u.safeSetText('raceTitle', `${raceName} - ${sessionName}`);
    u.safeSetHTML('raceSubtitle', `<span class="flag">${flag}</span> ${u.escapeHTML(circuit)}`);
    document.body.classList.toggle('history-mode', !state.isLive);

    if (weather) {
      const air = u.asNumber(weather.air_temperature);
      const humidity = u.asNumber(weather.humidity);
      const wind = u.asNumber(weather.wind_speed);
      const rainfall = u.asNumber(weather.rainfall, 0);

      u.safeSetText('weather-air-temp', air !== null ? `${Math.round(air)}°C` : '-');
      u.safeSetText('weather-humidity', humidity !== null ? `${Math.round(humidity)}%` : '-');
      u.safeSetText('weather-wind', wind !== null ? `${Math.round(wind)} km/h` : '-');

      const weatherTexts = document.querySelectorAll('.weather-panel article span');
      if (weatherTexts[0]) weatherTexts[0].textContent = rainfall > 0 ? 'Chuva' : 'Clima';
      if (weatherTexts[1]) weatherTexts[1].textContent = 'Umidade';
      if (weatherTexts[2]) weatherTexts[2].textContent = 'Vento';
    } else {
      u.safeSetText('weather-air-temp', '-');
      u.safeSetText('weather-humidity', '-');
      u.safeSetText('weather-wind', '-');
    }
  }

  function getPreferredLap(state) {
    const u = utils();
    const laps = state.bundle?.laps || [];
    const selected = Number(state.selectedDriverNumber);
    const selectedLaps = laps.filter((lap) => Number(lap.driver_number) === selected);
    const validSelected = selectedLaps.filter((lap) => {
      return u.asNumber(lap.duration_sector_1) !== null
        || u.asNumber(lap.duration_sector_2) !== null
        || u.asNumber(lap.duration_sector_3) !== null;
    });

    if (validSelected.length) return u.latestByDate(validSelected);

    const validAll = laps.filter((lap) => {
      return u.asNumber(lap.duration_sector_1) !== null
        || u.asNumber(lap.duration_sector_2) !== null
        || u.asNumber(lap.duration_sector_3) !== null;
    });

    return u.latestByDate(validAll);
  }

  function renderTopMetrics(state) {
    const u = utils();
    const laps = state.bundle?.laps || [];
    const latestLapNumber = u.maxValid(laps, (lap) => lap.lap_number);

    u.safeSetText('lap-counter', latestLapNumber ? `Volta ${latestLapNumber}` : '-');

    const latest = getPreferredLap(state);
    const bestS1 = u.minValid(laps, (lap) => lap.duration_sector_1);
    const bestS2 = u.minValid(laps, (lap) => lap.duration_sector_2);
    const bestS3 = u.minValid(laps, (lap) => lap.duration_sector_3);

    const sectors = [
      { valueId: 'sector-1-value', gapId: 'sector-1-gap', value: latest?.duration_sector_1, best: bestS1 },
      { valueId: 'sector-2-value', gapId: 'sector-2-gap', value: latest?.duration_sector_2, best: bestS2 },
      { valueId: 'sector-3-value', gapId: 'sector-3-gap', value: latest?.duration_sector_3, best: bestS3 }
    ];

    sectors.forEach((sector) => {
      const value = u.asNumber(sector.value);
      const best = u.asNumber(sector.best);
      const gap = value !== null && best !== null ? value - best : null;

      u.safeSetText(sector.valueId, value !== null ? value.toFixed(3) : '-');
      u.safeSetText(sector.gapId, gap !== null ? u.formatSigned(gap, 3) : '-');

      let type = 'yellow';
      if (gap !== null && Math.abs(gap) < 0.001) type = 'purple';
      else if (gap !== null && gap <= 0.15) type = 'green';
      setSectorClass(sector.valueId, type);
    });
  }

  function buildStandings(state) {
    const u = utils();
    const drivers = state.bundle?.drivers || [];
    const latestPositions = state.bundle?.positions?.length
      ? u.latestMapBy(state.bundle.positions || [], (item) => item.driver_number)
      : u.latestMapBy(state.bundle?.laps || [], (item) => item.driver_number);
    const sessionResults = new Map((state.bundle?.sessionResult || []).map((item) => [Number(item.driver_number), item]));
    const startingGrid = new Map((state.bundle?.startingGrid || []).map((item) => [Number(item.driver_number), item]));

    return drivers.map((driver) => {
      const driverNumber = Number(driver.driver_number);
      const latestPosition = latestPositions.get(driver.driver_number) || latestPositions.get(driverNumber);
      const result = sessionResults.get(driverNumber);
      const grid = startingGrid.get(driverNumber);
      const position = u.asNumber(latestPosition?.position ?? latestPosition?.lap_position ?? latestPosition?.computed_lap_position ?? result?.position ?? grid?.position, 99);

      return { driver, position, result, grid };
    }).sort((a, b) => a.position - b.position || Number(a.driver.driver_number) - Number(b.driver.driver_number));
  }

  function renderLeftColumn(state, handlers = {}) {
    const u = utils();
    const teamList = document.getElementById('team-list');
    const standingsList = document.getElementById('standings-list');
    const drivers = state.bundle?.drivers || [];

    if (teamList) {
      const teams = new Map();

      drivers.forEach((driver) => {
        const teamName = driver.team_name || 'Sem equipe';
        if (!teams.has(teamName)) {
          teams.set(teamName, {
            team_name: teamName,
            team_colour: driver.team_colour,
            drivers: []
          });
        }
        teams.get(teamName).drivers.push(driver);
      });

      teamList.innerHTML = Array.from(teams.values()).map((team) => {
        const checked = !state.hiddenTeams.has(team.team_name);
        const color = u.normalizeColor(team.team_colour, '#ffffff');

        return `
          <label class="team-option" style="--team-color:${color}">
            <input type="checkbox" ${checked ? 'checked' : ''} data-team="${u.escapeHTML(team.team_name)}">
            <span class="fake-check"></span>
            <strong>${u.escapeHTML(team.team_name)}</strong>
            <em>${team.drivers.length}</em>
          </label>
        `;
      }).join('');

      teamList.querySelectorAll('[data-team]').forEach((input) => {
        input.addEventListener('change', () => {
          if (input.checked) state.hiddenTeams.delete(input.dataset.team);
          else state.hiddenTeams.add(input.dataset.team);

          if (handlers.onTeamFilterChange) handlers.onTeamFilterChange();
        });
      });
    }

    if (standingsList) {
      const standings = buildStandings(state);
      const intervals = u.latestMapBy(state.bundle?.intervals || [], (item) => item.driver_number);
      const stintsByDriver = u.groupBy(state.bundle?.stints || [], (item) => Number(item.driver_number));

      standingsList.innerHTML = standings.map((item) => {
        const driver = item.driver;
        const driverNumber = Number(driver.driver_number);
        const teamName = driver.team_name || 'Sem equipe';
        const color = u.normalizeColor(driver.team_colour, '#ffffff');
        const interval = intervals.get(driver.driver_number) || intervals.get(driverNumber);
        const stintList = stintsByDriver.get(driverNumber) || [];
        const latestStint = [...stintList].sort((a, b) => Number(b.stint_number || 0) - Number(a.stint_number || 0))[0];
        const hidden = state.hiddenTeams.has(teamName);
        const selected = Number(state.selectedDriverNumber) === driverNumber;
        const gap = interval?.gap_to_leader ?? interval?.interval;

        return `
          <article
            class="standing-row ${hidden ? 'is-filtered' : ''} ${selected ? 'is-selected selected' : ''}"
            data-driver-number="${driverNumber}"
            data-team="${u.escapeHTML(teamName)}"
            style="--team-color:${color}"
          >
            <span>${item.position !== 99 ? item.position : '-'}</span>
            <span class="driver-code"><i></i>${u.escapeHTML(getDriverLabel(driver))}</span>
            <span>${u.escapeHTML(u.formatGap(gap))}</span>
            <span class="tyre ${u.escapeHTML(latestStint?.compound || '')}">${u.escapeHTML(u.translateCompound(latestStint?.compound, 'short'))}</span>
          </article>
        `;
      }).join('');

      standingsList.querySelectorAll('[data-driver-number]').forEach((row) => {
        row.addEventListener('click', () => {
          if (handlers.onDriverSelect) handlers.onDriverSelect(Number(row.dataset.driverNumber));
        });
      });

      if (!state.selectedDriverNumber && standings[0]) {
        state.selectedDriverNumber = Number(standings[0].driver.driver_number);
      }
    }
  }

  function getLocationBounds(points) {
    const u = utils();
    const xs = points.map((point) => u.asNumber(point.x)).filter((value) => value !== null);
    const ys = points.map((point) => u.asNumber(point.y)).filter((value) => value !== null);

    if (!xs.length || !ys.length) return null;

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  function scaleLocationPoint(point, bounds) {
    const u = utils();
    const x = u.asNumber(point.x);
    const y = u.asNumber(point.y);

    if (x === null || y === null || !bounds) return { x: 500, y: 310 };

    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;

    return {
      x: 100 + ((x - bounds.minX) / width) * 800,
      y: 100 + ((y - bounds.minY) / height) * 420
    };
  }

  function getLocationAngle(driverLocations, latestPoint) {
    const u = utils();
    const list = u.sortByDate(driverLocations);
    if (list.length < 2) return 0;

    const latestIndex = list.findIndex((item) => item.date === latestPoint.date);
    const previous = list[Math.max(0, latestIndex - 1)] || list[list.length - 2];

    const dx = u.asNumber(latestPoint.x, 0) - u.asNumber(previous.x, 0);
    const dy = u.asNumber(latestPoint.y, 0) - u.asNumber(previous.y, 0);

    if (Math.abs(dx) + Math.abs(dy) < 0.001) return 0;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  function buildCarMarkerHTML({ x, y, angle, color, label, driverNumber, teamName, hidden, selected }) {
    const u = utils();

    return `
      <g
        class="car-marker ${hidden ? 'is-filtered' : ''} ${selected ? 'is-selected' : ''}"
        data-driver-number="${driverNumber}"
        data-team="${u.escapeHTML(teamName)}"
        transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"
        style="--team-color:${color}"
      >
        <circle class="car-marker-glow" cx="0" cy="0" r="20" fill="${color}"></circle>
        <g class="car-marker-car" transform="rotate(${angle.toFixed(1)})">
          ${buildCarIcon(color)}
        </g>
        <circle class="car-marker-dot" cx="0" cy="0" r="5" fill="${color}"></circle>
        <g class="car-label" transform="translate(16 -32)">
          <rect x="0" y="0" width="76" height="28" rx="7"></rect>
          <rect class="label-chip" x="4" y="4" width="24" height="20" rx="5" fill="${color}"></rect>
          <text class="car-label-text" x="36" y="18">${u.escapeHTML(label)}</text>
        </g>
      </g>
    `;
  }

  function renderTrackMapFromLocation(state, handlers) {
    const u = utils();
    const carsLayer = document.getElementById('cars-layer');
    if (!carsLayer) return;
    const location = state.bundle?.location || [];
    const fullLocation = state.sourceBundle?.location?.length ? state.sourceBundle.location : location;
    const drivers = state.bundle?.drivers || [];
    const latestLocation = u.latestMapBy(location, (item) => item.driver_number);
    const points = Array.from(latestLocation.values());
    const bounds = getLocationBounds(fullLocation);
    const locationsByDriver = u.groupBy(fullLocation, (item) => Number(item.driver_number));

    carsLayer.innerHTML = points.map((point) => {
      const driver = drivers.find((item) => Number(item.driver_number) === Number(point.driver_number));
      const position = scaleLocationPoint(point, bounds);
      const color = u.normalizeColor(driver?.team_colour, '#ffffff');
      const teamName = driver?.team_name || 'Sem equipe';
      const hidden = state.hiddenTeams.has(teamName);
      const selected = Number(state.selectedDriverNumber) === Number(point.driver_number);
      const angle = getLocationAngle(locationsByDriver.get(Number(point.driver_number)) || [], point);

      return buildCarMarkerHTML({
        x: position.x,
        y: position.y,
        angle,
        color,
        label: getDriverLabel(driver) || point.driver_number,
        driverNumber: point.driver_number,
        teamName,
        hidden,
        selected
      });
    }).join('');
  }

  function estimateLapSeconds(state) {
    const u = utils();
    const valid = (state.bundle?.laps || [])
      .map((lap) => u.asNumber(lap.lap_duration))
      .filter((value) => value !== null && value > 45 && value < 220)
      .sort((a, b) => a - b);

    if (!valid.length) return 90;
    return valid[Math.floor(valid.length / 2)] || 90;
  }

  function getDriverReplayProgress(state, driverNumber, index, total) {
    const u = utils();
    const elapsedSeconds = u.asNumber(state.simulation?.elapsedSeconds, 0);
    const simulationProgress = u.asNumber(state.simulation?.progress, 0);
    const currentTime = u.asNumber(state.simulation?.currentTime, null);
    const lapSeconds = estimateLapSeconds(state);
    const driverLaps = (state.bundle?.laps || [])
      .filter((lap) => Number(lap.driver_number) === Number(driverNumber))
      .sort((a, b) => u.itemDate(a) - u.itemDate(b));

    const latestLap = driverLaps[driverLaps.length - 1];
    const lapNumber = u.asNumber(latestLap?.lap_number, 0);
    const positionOffset = (index / Math.max(total, 1)) * 0.028;

    if (lapNumber > 0) {
      const lapStartMs = u.itemDate(latestLap).getTime();
      const lapDurationSeconds = u.asNumber(latestLap?.lap_duration, lapSeconds) || lapSeconds;
      const rawFraction = currentTime && lapStartMs > 0
        ? (currentTime - lapStartMs) / Math.max(1, lapDurationSeconds * 1000)
        : elapsedSeconds / lapSeconds;
      const lapFraction = Math.max(0, Math.min(0.985, rawFraction));
      return (lapFraction + 1 - positionOffset) % 1;
    }

    return ((elapsedSeconds / lapSeconds) + simulationProgress * 0.12 + 1 - positionOffset) % 1;
  }

  function renderTrackMapFallback(state) {
    const u = utils();
    const carsLayer = document.getElementById('cars-layer');
    if (!carsLayer) return;
    const path = document.getElementById('race-path-base') || document.getElementById('racingLine');
    const standings = buildStandings(state);

    if (!path || !standings.length) {
      carsLayer.innerHTML = '';
      return;
    }

    const length = path.getTotalLength();
    carsLayer.innerHTML = standings.map((item, index) => {
      const driver = item.driver;
      const driverNumber = Number(driver.driver_number);
      const progress = getDriverReplayProgress(state, driverNumber, index, standings.length);
      const point = path.getPointAtLength(progress * length);
      const next = path.getPointAtLength(((progress + 0.004) % 1) * length);
      const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
      const teamName = driver.team_name || 'Sem equipe';
      const color = u.normalizeColor(driver.team_colour, '#ffffff');

      return buildCarMarkerHTML({
        x: point.x,
        y: point.y,
        angle,
        color,
        label: getDriverLabel(driver),
        driverNumber,
        teamName,
        hidden: state.hiddenTeams.has(teamName),
        selected: Number(state.selectedDriverNumber) === driverNumber
      });
    }).join('');
  }

  function renderTrackMap(state, handlers = {}) {
    const carsLayer = document.getElementById('cars-layer');
    if (!carsLayer) return;

    const location = state.bundle?.location || [];
    if (location.length) renderTrackMapFromLocation(state, handlers);
    else renderTrackMapFallback(state);

    carsLayer.querySelectorAll('[data-driver-number]').forEach((marker) => {
      marker.addEventListener('click', () => {
        if (handlers.onDriverSelect) handlers.onDriverSelect(Number(marker.dataset.driverNumber));
      });
    });
  }

  function renderDriverPanel(state) {
    const u = utils();
    const card = document.getElementById('driver-card');
    if (!card) return;

    const driverNumber = Number(state.selectedDriverNumber);
    const driver = getDriver(state, driverNumber);

    if (!driver) {
      card.innerHTML = '<p class="empty-driver-card">Selecione uma sessão e um piloto para visualizar os dados.</p>';
      return;
    }

    const driverLaps = (state.bundle?.laps || []).filter((lap) => Number(lap.driver_number) === driverNumber);
    const validLaps = driverLaps.filter((lap) => u.asNumber(lap.lap_duration) !== null);
    const fastestLap = u.minValid(validLaps, (lap) => lap.lap_duration);
    const latestLap = u.latestByDate(validLaps);
    const driverCarData = (state.bundle?.carData || []).filter((item) => Number(item.driver_number) === driverNumber);
    const latestCarData = u.latestByDate(driverCarData);
    const stints = (state.bundle?.stints || []).filter((stint) => Number(stint.driver_number) === driverNumber);
    const latestStint = [...stints].sort((a, b) => Number(b.stint_number || 0) - Number(a.stint_number || 0))[0];
    const pits = (state.bundle?.pit || []).filter((pit) => Number(pit.driver_number) === driverNumber);
    const intervals = u.latestMapBy(state.bundle?.intervals || [], (item) => item.driver_number);
    const interval = intervals.get(driver.driver_number) || intervals.get(driverNumber);
    const color = u.normalizeColor(driver.team_colour, '#ffffff');
    const headshot = driver.headshot_url || '';
    const loadingTelem = Number(state.loadingCarDataFor) === driverNumber;

    card.style.setProperty('--team-color', color);

    card.innerHTML = `
      <div class="driver-card-header" style="--driver-color:${color}">
        <div class="driver-photo-wrap">
          ${headshot ? `<img src="${u.escapeHTML(headshot)}" alt="${u.escapeHTML(getDriverName(driver))}">` : `<span>${u.escapeHTML(getDriverLabel(driver))}</span>`}
        </div>

        <div>
          <span>${u.escapeHTML(driver.team_name || '-')}</span>
          <h2>${u.escapeHTML(getDriverName(driver))}</h2>
          <strong>${u.escapeHTML(getDriverLabel(driver))} · Nº ${u.escapeHTML(driver.driver_number)}</strong>
        </div>
      </div>

      <div class="driver-stats">
        <article><small>Melhor volta</small><strong>${fastestLap ? u.secondsToLapTime(fastestLap) : '-'}</strong></article>
        <article><small>Última volta</small><strong>${latestLap?.lap_duration ? u.secondsToLapTime(latestLap.lap_duration) : '-'}</strong></article>
        <article><small>Diferença</small><strong>${u.escapeHTML(u.formatGap(interval?.gap_to_leader ?? interval?.interval))}</strong></article>
        <article><small>Pneu</small><strong>${u.escapeHTML(u.translateCompound(latestStint?.compound))}</strong></article>
        <article><small>Paradas</small><strong>${pits.length}</strong></article>
        <article><small>Velocidade</small><strong>${latestCarData?.speed ? `${u.escapeHTML(latestCarData.speed)} km/h` : loadingTelem ? '...' : '-'}</strong></article>
        <article><small>Marcha</small><strong>${latestCarData?.n_gear ?? (loadingTelem ? '...' : '-')}</strong></article>
        <article><small>Acelerador</small><strong>${latestCarData?.throttle ?? (loadingTelem ? '...' : '-')}${latestCarData?.throttle !== undefined ? '%' : ''}</strong></article>
        <article><small>Freio</small><strong>${latestCarData?.brake ?? (loadingTelem ? '...' : '-')}</strong></article>
        <article><small>DRS</small><strong>${latestCarData?.drs ?? (loadingTelem ? '...' : '-')}</strong></article>
      </div>
    `;
  }

  function renderFooterStatus(state) {
    const u = utils();
    const footer = document.querySelector('.status-grid');
    if (!footer) return;

    const laps = state.bundle?.laps || [];
    const weather = u.latestByDate(state.bundle?.weather || []);
    const stints = state.bundle?.stints || [];
    const pit = state.bundle?.pit || [];
    const raceControl = state.bundle?.raceControl || [];

    const fastest = laps
      .filter((lap) => u.asNumber(lap.lap_duration) !== null)
      .sort((a, b) => Number(a.lap_duration) - Number(b.lap_duration))[0];

    const fastestDriver = fastest ? getDriver(state, fastest.driver_number) : null;

    const compoundCount = stints.reduce((acc, stint) => {
      const compound = stint.compound || 'UNKNOWN';
      acc[compound] = (acc[compound] || 0) + 1;
      return acc;
    }, {});

    const dominantCompound = Object.entries(compoundCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const rainfall = u.asNumber(weather?.rainfall, 0);
    const isWet = rainfall > 0;
    const lastRaceControl = u.latestByDate(raceControl || []);
    const trackTemp = u.asNumber(weather?.track_temperature);
    const trackCondition = weather ? (isWet ? 'Molhada' : 'Seca') : '-';

    footer.innerHTML = `
      <article>
        <span class="status-icon purple">◴</span>
        <div>
          <small>Melhor volta</small>
          <strong class="purple-text">${fastest ? u.secondsToLapTime(fastest.lap_duration) : '-'}</strong>
          <em>${fastestDriver ? u.escapeHTML(getDriverLabel(fastestDriver)) : '-'} · Volta ${fastest?.lap_number || '-'}</em>
        </div>
      </article>

      <article>
        <span class="track-mini"></span>
        <div>
          <small>Status da pista</small>
          <strong class="${isWet ? 'yellow-text' : 'green-text'}">${trackCondition}</strong>
          <em>Pista: ${trackTemp !== null ? `${Math.round(trackTemp)}°C` : '-'}</em>
        </div>
      </article>

      <article>
        <span class="tyre-icon">${u.escapeHTML(u.translateCompound(dominantCompound, 'short'))}</span>
        <div>
          <small>Pneu dominante</small>
          <strong class="yellow-text">${u.escapeHTML(u.translateCompound(dominantCompound))}</strong>
          <em>Períodos: ${stints.length}</em>
        </div>
      </article>

      <article>
        <span class="status-icon">◎</span>
        <div>
          <small>Controle de corrida</small>
          <strong class="green-text">${u.escapeHTML(u.translateRaceControlCategory(lastRaceControl?.category || 'Status'))}</strong>
          <em>${u.escapeHTML(lastRaceControl?.message || `${pit.length} paradas registradas`)}</em>
        </div>
      </article>
    `;
  }

  function renderAll(state, handlers = {}) {
    renderHeader(state);
    renderTopMetrics(state);
    renderLeftColumn(state, handlers);
    renderTrackMap(state, handlers);
    renderDriverPanel(state);
    renderFooterStatus(state);

    document.body.dataset.teamFilterMode = state.dimMode;
  }

  window.F1LocalRenderers = {
    prepareCarAsset,
    renderHeader,
    renderTopMetrics,
    renderLeftColumn,
    renderTrackMap,
    renderDriverPanel,
    renderFooterStatus,
    renderAll,
    buildStandings,
    getDriver
  };
}());
