(function () {
  'use strict';

  const DEFAULT_PATHS = {
    manifest: './data/normalized/index.json',
    meetings: ['./data/normalized/meetings_master.json', './data/normalized/meetings.json', './data/normalized/races.json'],
    sessions: ['./data/normalized/sessions_master.json', './data/normalized/sessions.json'],
    drivers: ['./data/normalized/drivers_master.json', './data/normalized/drivers.json'],
    teams: ['./data/normalized/teams_master.json', './data/normalized/teams.json'],
    circuits: ['./data/normalized/circuits_master.json', './data/normalized/circuits.json'],
    health: ['./data/normalized/platform_health.json']
  };

  const ENDPOINT_KEYS = [
    'meetings', 'sessions', 'drivers', 'teams', 'circuits', 'health'
  ];

  const state = {
    manifestLoaded: false,
    manifest: null,
    cache: new Map(),
    sessionCache: new Map()
  };

  const escId = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'item';

  function asArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.records)) return payload.records;
    return [];
  }

  async function fetchJSON(path) {
    if (!path) return null;
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('[F1LocalDatabase] Falha ao ler JSON:', path, error);
      return null;
    }
  }

  async function loadManifest() {
    if (state.manifestLoaded) return state.manifest;
    state.manifestLoaded = true;
    state.manifest = await fetchJSON(DEFAULT_PATHS.manifest) || null;
    return state.manifest;
  }

  function manifestPaths(key) {
    const manifest = state.manifest;
    if (!manifest || typeof manifest !== 'object') return [];

    const candidates = [
      manifest[key],
      manifest.files && manifest.files[key],
      manifest.endpoints && manifest.endpoints[key]
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return [value];
    }

    return [];
  }

  async function readList(key) {
    await loadManifest();
    if (state.cache.has(key)) return state.cache.get(key);

    const paths = [...manifestPaths(key), ...(DEFAULT_PATHS[key] || [])];
    let list = [];

    for (const path of paths) {
      const payload = await fetchJSON(path);
      list = asArray(payload);
      if (list.length) break;
    }

    state.cache.set(key, list);
    return list;
  }

  function get(item, keys, fallback = '') {
    for (const key of keys) {
      if (item && item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key];
    }
    return fallback;
  }

  function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeColor(value, fallback = '56c7ff') {
    const raw = String(value || fallback).replace('#', '').trim();
    return raw || fallback;
  }

  function normalizeMeeting(item, index = 0) {
    const year = numberOrNull(get(item, ['year', 'season', 'season_year'], ''));
    const round = get(item, ['round', 'round_number'], '');
    const name = get(item, ['meeting_name', 'race_name', 'grand_prix', 'event_name', 'name'], 'Corrida');
    const circuit = get(item, ['circuit_short_name', 'circuit_name', 'track_name', 'location'], name);
    const key = get(item, ['meeting_key', 'race_id', 'round_id', 'event_id', 'id'], `${year || 'y'}_${round || index + 1}_${escId(name)}`);

    return {
      ...item,
      meeting_key: key,
      meeting_name: name,
      circuit_short_name: circuit,
      location: get(item, ['location', 'city', 'place'], circuit),
      country_name: get(item, ['country_name', 'country'], ''),
      country_code: get(item, ['country_code'], ''),
      year: year || get(item, ['year', 'season'], '')
    };
  }

  function normalizeSession(item, meeting = null, index = 0) {
    const name = get(item, ['session_name', 'session_type', 'type', 'name'], 'Race');
    const meetingKey = get(item, ['meeting_key', 'race_id', 'round_id', 'event_id'], meeting?.meeting_key || '');
    const key = get(item, ['session_key', 'session_id', 'id'], `${meetingKey}_${escId(name)}_${index}`);

    return {
      ...item,
      session_key: key,
      meeting_key: meetingKey,
      session_name: name,
      session_type: get(item, ['session_type', 'type'], name),
      date_start: get(item, ['date_start', 'start_time', 'date', 'datetime'], meeting?.date_start || meeting?.date || '')
    };
  }

  function normalizeDriver(item, index = 0) {
    const name = get(item, ['full_name', 'broadcast_name', 'name', 'driver_name'], `Piloto ${index + 1}`);
    const driverNumber = get(item, ['driver_number', 'number', 'car_number'], index + 1);
    const teamName = get(item, ['team_name', 'current_team', 'constructor_name', 'team'], 'Sem equipe');
    const color = normalizeColor(get(item, ['team_colour', 'team_color', 'color'], '56c7ff'));
    const code = get(item, ['name_acronym', 'code', 'broadcast_name', 'short_name'], name);

    return {
      ...item,
      driver_id: get(item, ['driver_id', 'id', 'code'], escId(name)),
      driver_number: numberOrNull(driverNumber) ?? driverNumber,
      number: numberOrNull(driverNumber) ?? driverNumber,
      full_name: name,
      name,
      broadcast_name: get(item, ['broadcast_name', 'short_name', 'code'], name),
      name_acronym: String(code) === 'None' ? name : code,
      team_name: teamName,
      current_team: teamName,
      team_colour: color,
      team_color: `#${color}`,
      country_code: get(item, ['country_code', 'country', 'nationality'], ''),
      country: get(item, ['country', 'nationality', 'country_code'], '')
    };
  }

  function normalizeTeam(item, index = 0) {
    const name = get(item, ['name', 'team_name', 'constructor_name'], `Equipe ${index + 1}`);
    const color = get(item, ['color', 'team_color', 'team_colour'], '#56c7ff');
    return {
      ...item,
      team_id: get(item, ['team_id', 'constructor_id', 'id'], escId(name)),
      name,
      color: String(color).startsWith('#') ? color : `#${color}`,
      country: get(item, ['country', 'nationality'], ''),
      summary: get(item, ['summary', 'description'], 'Equipe cadastrada na base histórica.'),
      titles: get(item, ['titles', 'championships'], '-'),
      wins: get(item, ['wins', 'victories'], '-'),
      era: get(item, ['era', 'years', 'years_active'], '-')
    };
  }

  function normalizeCircuit(item, index = 0) {
    const name = get(item, ['name', 'circuit_name', 'track_name'], `Circuito ${index + 1}`);
    return {
      ...item,
      circuit_id: get(item, ['circuit_id', 'track_id', 'id'], escId(name)),
      name,
      country: get(item, ['country', 'country_name'], ''),
      location: get(item, ['location', 'city'], ''),
      length_km: get(item, ['length_km', 'lap_length_km', 'distance_km'], '-'),
      layout_versions: get(item, ['layout_versions', 'layouts'], '-'),
      profile: get(item, ['profile', 'type'], 'Circuito histórico'),
      summary: get(item, ['summary', 'description'], 'Circuito cadastrado na base histórica.')
    };
  }

  async function loadSessionFile(sessionKey) {
    await loadManifest();
    if (!sessionKey) return null;
    if (state.sessionCache.has(sessionKey)) return state.sessionCache.get(sessionKey);

    const candidates = [];
    const manifest = state.manifest;

    if (manifest?.sessions && typeof manifest.sessions === 'object' && !Array.isArray(manifest.sessions)) {
      const direct = manifest.sessions[sessionKey];
      if (typeof direct === 'string') candidates.push(direct);
    }

    candidates.push(`./data/normalized/sessions/${sessionKey}.json`);

    let data = null;
    for (const path of candidates) {
      const payload = await fetchJSON(path);
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        data = payload;
        break;
      }
    }

    state.sessionCache.set(sessionKey, data);
    return data;
  }

  function withSessionKey(items, sessionKey) {
    return asArray(items).map((item) => ({ session_key: item.session_key || sessionKey, ...item }));
  }

  function buildPositionsFromLaps(laps, sessionResults, startingGrid, sessionKey) {
    if (!laps.length) {
      const resultMap = new Map(sessionResults.map((item) => [Number(item.driver_number), numberOrNull(item.position)]));
      return startingGrid.map((item) => ({
        session_key: sessionKey,
        driver_number: item.driver_number,
        position: resultMap.get(Number(item.driver_number)) || item.position || 99,
        date: item.date || item.date_start || ''
      }));
    }

    return laps.map((lap) => ({
      session_key: lap.session_key || sessionKey,
      driver_number: lap.driver_number,
      position: numberOrNull(lap.position ?? lap.lap_position ?? lap.computed_lap_position) || 99,
      lap_number: lap.lap_number,
      date: lap.date || lap.date_start || lap.time || lap.timestamp
    }));
  }

  function buildIntervalsFromPositions(positions, sessionKey) {
    return positions.map((item) => {
      const position = numberOrNull(item.position, 99);
      const gap = position <= 1 ? 0 : Number(((position - 1) * 1.35).toFixed(3));
      return {
        session_key: item.session_key || sessionKey,
        driver_number: item.driver_number,
        position,
        gap_to_leader: gap,
        interval: gap,
        date: item.date || item.time || item.timestamp
      };
    });
  }

  function buildStintsFromDrivers(drivers, laps, sessionKey) {
    const maxLap = laps.reduce((max, lap) => Math.max(max, numberOrNull(lap.lap_number, 0) || 0), 1);
    const compounds = ['MEDIUM', 'HARD', 'SOFT'];
    return drivers.map((driver, index) => ({
      session_key: sessionKey,
      driver_number: driver.driver_number,
      stint_number: 1,
      lap_start: 1,
      lap_end: maxLap || 1,
      compound: compounds[index % compounds.length]
    }));
  }

  function buildCarDataFromLaps(laps, drivers, sessionKey) {
    const driverOrder = new Map(drivers.map((driver, index) => [Number(driver.driver_number), index]));
    return laps.map((lap) => {
      const index = driverOrder.get(Number(lap.driver_number)) || 0;
      const speed = Math.max(120, Math.round(305 - (numberOrNull(lap.lap_duration, 90) - 75) * 1.4 - index * 0.5));
      return {
        session_key: lap.session_key || sessionKey,
        driver_number: lap.driver_number,
        date: lap.date || lap.date_start || lap.time || lap.timestamp,
        speed,
        rpm: 9800 + (index % 8) * 180,
        n_gear: 6 + (index % 2),
        throttle: 78 + (index % 18),
        brake: 0,
        drs: 0
      };
    });
  }

  function defaultWeather(sessionFile, sessionKey) {
    const meta = sessionFile?.metadata || sessionFile?.meta || {};
    const date = get(meta, ['date_start', 'date', 'start_time'], '');
    return [{
      session_key: sessionKey,
      date,
      air_temperature: null,
      humidity: null,
      wind_speed: null,
      rainfall: 0,
      track_temperature: null
    }];
  }

  async function getMeetingsByYear(year) {
    const raw = await readList('meetings');
    const meetings = raw.map(normalizeMeeting).filter((item) => String(item.year) === String(year));

    if (meetings.length) return meetings;

    const sessions = await readList('sessions');
    const fromSessions = sessions
      .filter((item) => String(get(item, ['year', 'season', 'season_year'], '')) === String(year))
      .map((item, index) => normalizeMeeting(item, index));

    const seen = new Set();
    return fromSessions.filter((item) => {
      if (seen.has(String(item.meeting_key))) return false;
      seen.add(String(item.meeting_key));
      return true;
    });
  }

  async function getSessionsByMeeting(meetingKey) {
    const sessions = await readList('sessions');
    const meeting = (await readList('meetings')).map(normalizeMeeting).find((item) => String(item.meeting_key) === String(meetingKey));
    return sessions
      .filter((item) => String(get(item, ['meeting_key', 'race_id', 'round_id', 'event_id'], meetingKey)) === String(meetingKey))
      .map((item, index) => normalizeSession(item, meeting, index));
  }

  async function getSessionCoreBundle(sessionKey) {
    const sessionFile = await loadSessionFile(sessionKey);

    if (!sessionFile) {
      return {
        drivers: [], positions: [], intervals: [], laps: [], weather: [], stints: [], pit: [],
        raceControl: [], sessionResult: [], startingGrid: [], location: [], carData: []
      };
    }

    const readFromFile = (key) => withSessionKey(sessionFile?.[key], sessionKey);

    const drivers = readFromFile('drivers').map(normalizeDriver);
    const laps = readFromFile('laps');
    const sessionResult = readFromFile('sessionResult');
    const startingGrid = readFromFile('startingGrid');

    let positions = readFromFile('positions');
    if (!positions.length) positions = buildPositionsFromLaps(laps, sessionResult, startingGrid, sessionKey);

    let intervals = readFromFile('intervals');
    if (!intervals.length) intervals = buildIntervalsFromPositions(positions, sessionKey);

    let stints = readFromFile('stints');
    if (!stints.length && drivers.length) stints = buildStintsFromDrivers(drivers, laps, sessionKey);

    let carData = readFromFile('carData');
    if (!carData.length) carData = readFromFile('car_data');
    if (!carData.length && laps.length) carData = buildCarDataFromLaps(laps, drivers, sessionKey);

    let weather = readFromFile('weather');
    if (!weather.length) weather = defaultWeather(sessionFile, sessionKey);

    return {
      drivers,
      positions,
      intervals,
      laps,
      weather,
      stints,
      pit: readFromFile('pit'),
      raceControl: readFromFile('raceControl'),
      sessionResult,
      startingGrid,
      location: readFromFile('location'),
      carData
    };
  }

  async function getLocationForSession(sessionKey) {
    const sessionFile = await loadSessionFile(sessionKey);
    return withSessionKey(sessionFile?.location, sessionKey);
  }

  async function getCarDataForDriver(sessionKey, driverNumber) {
    const bundle = await getSessionCoreBundle(sessionKey);
    return (bundle.carData || []).filter((item) => Number(item.driver_number) === Number(driverNumber));
  }

  async function loadPlatformData() {
    const [drivers, teams, circuits, health, meetings, sessions] = await Promise.all([
      readList('drivers'),
      readList('teams'),
      readList('circuits'),
      readList('health'),
      readList('meetings'),
      readList('sessions')
    ]);

    return {
      drivers: drivers.map(normalizeDriver),
      teams: teams.map(normalizeTeam),
      circuits: circuits.map(normalizeCircuit),
      health,
      meetings: meetings.map(normalizeMeeting),
      sessions: sessions.map(normalizeSession)
    };
  }

  async function hasLocalData(key) {
    const list = await readList(key);
    return list.length > 0;
  }

  window.F1LocalDatabase = {
    readList,
    loadPlatformData,
    getMeetingsByYear,
    getSessionsByMeeting,
    getSessionCoreBundle,
    getLocationForSession,
    getCarDataForDriver,
    hasLocalData,
    normalizeDriver,
    normalizeTeam,
    normalizeCircuit,
    normalizeMeeting,
    normalizeSession,
    ENDPOINT_KEYS
  };
}());
