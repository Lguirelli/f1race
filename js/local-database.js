(function () {
  'use strict';

  const DEFAULT_PATHS = {
    manifest: './data/normalized/index.json',
    meetings: ['./data/normalized/meetings.json', './data/normalized/meetings_master.json', './data/normalized/races.json'],
    sessions: ['./data/normalized/sessions.json', './data/normalized/sessions_master.json'],
    drivers: ['./data/normalized/drivers.json', './data/normalized/drivers_master.json'],
    sessionDrivers: ['./data/normalized/drivers_session.json'],
    teams: ['./data/normalized/teams.json', './data/normalized/teams_master.json'],
    circuits: ['./data/normalized/circuits.json', './data/normalized/circuits_master.json'],
    health: ['./data/normalized/platform_health.json'],
    positions: ['./data/normalized/positions.json', './data/normalized/position.json'],
    intervals: ['./data/normalized/intervals.json'],
    laps: ['./data/normalized/laps.json'],
    weather: ['./data/normalized/weather.json'],
    stints: ['./data/normalized/stints.json'],
    pit: ['./data/normalized/pit.json', './data/normalized/pits.json', './data/normalized/pit_stops.json'],
    raceControl: ['./data/normalized/race_control.json', './data/normalized/raceControl.json'],
    sessionResult: ['./data/normalized/session_result.json', './data/normalized/session_results.json'],
    startingGrid: ['./data/normalized/starting_grid.json'],
    location: ['./data/normalized/location.json', './data/normalized/locations.json'],
    carData: ['./data/normalized/car_data.json', './data/normalized/cardata.json']
  };

  const ENDPOINT_KEYS = [
    'meetings', 'sessions', 'drivers', 'teams', 'circuits', 'health',
    'sessionDrivers', 'positions', 'intervals', 'laps', 'weather', 'stints', 'pit',
    'raceControl', 'sessionResult', 'startingGrid', 'location', 'carData'
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
    } catch {
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

    const manifestOnlyPaths = manifestPaths(key);
    const fallbackPaths = DEFAULT_PATHS[key] || [];
    let list = [];

    if (manifestOnlyPaths.length > 1) {
      const parts = await Promise.all(manifestOnlyPaths.map((path) => fetchJSON(path)));
      list = parts.flatMap(asArray);
    } else {
      const paths = [...manifestOnlyPaths, ...fallbackPaths];
      for (const path of paths) {
        const payload = await fetchJSON(path);
        list = asArray(payload);
        if (list.length) break;
      }
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

  function normalizeMeeting(item, index = 0) {
    const year = numberOrNull(get(item, ['year', 'season', 'season_year'], ''));
    const name = get(item, ['meeting_name', 'race_name', 'grand_prix', 'event_name', 'name'], 'Corrida');
    const circuit = get(item, ['circuit_short_name', 'circuit_name', 'track_name', 'location'], name);
    const key = get(item, ['meeting_key', 'race_id', 'round_id', 'event_id', 'id'], `${year || 'y'}_${escId(name)}_${index}`);

    return {
      ...item,
      meeting_key: key,
      meeting_name: name,
      circuit_short_name: circuit,
      location: get(item, ['location', 'city', 'place'], circuit),
      country_name: get(item, ['country_name', 'country'], ''),
      year: year || get(item, ['year', 'season'], '')
    };
  }

  function normalizeSession(item, meeting = null, index = 0) {
    const name = get(item, ['session_name', 'type', 'session_type', 'name'], 'Race');
    const meetingKey = get(item, ['meeting_key', 'race_id', 'round_id', 'event_id'], meeting?.meeting_key || '');
    const key = get(item, ['session_key', 'session_id', 'id'], `${meetingKey}_${escId(name)}_${index}`);

    return {
      ...item,
      session_key: key,
      meeting_key: meetingKey,
      session_name: name,
      date_start: get(item, ['date_start', 'start_time', 'date', 'datetime'], meeting?.date_start || meeting?.date || '')
    };
  }

  function normalizeDriver(item, index = 0) {
    const name = get(item, ['full_name', 'broadcast_name', 'name', 'driver_name'], `Piloto ${index + 1}`);
    const driverNumber = get(item, ['driver_number', 'number', 'car_number'], index + 1);
    const teamName = get(item, ['team_name', 'current_team', 'constructor_name', 'team'], 'Sem equipe');
    const color = get(item, ['team_colour', 'team_color', 'color'], '56c7ff');

    return {
      ...item,
      driver_id: get(item, ['driver_id', 'id', 'code'], escId(name)),
      driver_number: numberOrNull(driverNumber) ?? driverNumber,
      number: numberOrNull(driverNumber) ?? driverNumber,
      full_name: name,
      name,
      broadcast_name: get(item, ['broadcast_name', 'short_name', 'code'], name),
      team_name: teamName,
      current_team: teamName,
      team_colour: String(color).replace('#', ''),
      team_color: String(color).startsWith('#') ? color : `#${color}`,
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
      length_km: get(item, ['length_km', 'lap_length_km', 'distance_km'], '-'),
      layout_versions: get(item, ['layout_versions', 'layouts'], '-'),
      profile: get(item, ['profile', 'type'], 'Circuito histórico'),
      summary: get(item, ['summary', 'description'], 'Circuito cadastrado na base histórica.')
    };
  }

  function sessionMatches(item, sessionKey) {
    return String(get(item, ['session_key', 'session_id', 'id_session'], '')) === String(sessionKey);
  }

  function driverMatches(item, driverNumber) {
    return String(get(item, ['driver_number', 'number', 'car_number'], '')) === String(driverNumber);
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
    candidates.push(`./data/sessions/${sessionKey}.json`);

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
    const readFromFile = (key) => asArray(sessionFile?.[key]);
    const fromGlobal = async (key) => (await readList(key)).filter((item) => sessionMatches(item, sessionKey));
    const sessionDrivers = await readList('sessionDrivers');
    const driversRaw = readFromFile('drivers').length
      ? readFromFile('drivers')
      : sessionDrivers.filter((item) => sessionMatches(item, sessionKey)).length
        ? sessionDrivers.filter((item) => sessionMatches(item, sessionKey))
        : await fromGlobal('drivers');

    return {
      drivers: driversRaw.map(normalizeDriver),
      positions: readFromFile('positions').length ? readFromFile('positions') : await fromGlobal('positions'),
      intervals: readFromFile('intervals').length ? readFromFile('intervals') : await fromGlobal('intervals'),
      laps: readFromFile('laps').length ? readFromFile('laps') : await fromGlobal('laps'),
      weather: readFromFile('weather').length ? readFromFile('weather') : await fromGlobal('weather'),
      stints: readFromFile('stints').length ? readFromFile('stints') : await fromGlobal('stints'),
      pit: readFromFile('pit').length ? readFromFile('pit') : await fromGlobal('pit'),
      raceControl: readFromFile('raceControl').length ? readFromFile('raceControl') : await fromGlobal('raceControl'),
      sessionResult: readFromFile('sessionResult').length ? readFromFile('sessionResult') : await fromGlobal('sessionResult'),
      startingGrid: readFromFile('startingGrid').length ? readFromFile('startingGrid') : await fromGlobal('startingGrid'),
      location: readFromFile('location').length ? readFromFile('location') : await fromGlobal('location'),
      carData: readFromFile('carData').length ? readFromFile('carData') : readFromFile('car_data')
    };
  }

  async function getLocationForSession(sessionKey) {
    const sessionFile = await loadSessionFile(sessionKey);
    const local = asArray(sessionFile?.location);
    if (local.length) return local;
    return (await readList('location')).filter((item) => sessionMatches(item, sessionKey));
  }

  async function getCarDataForDriver(sessionKey, driverNumber) {
    const sessionFile = await loadSessionFile(sessionKey);
    const local = asArray(sessionFile?.carData || sessionFile?.car_data);
    if (local.length) return local.filter((item) => driverMatches(item, driverNumber));
    return (await readList('carData')).filter((item) => sessionMatches(item, sessionKey) && driverMatches(item, driverNumber));
  }

  async function loadPlatformData() {
    const [drivers, teams, circuits, health] = await Promise.all([
      readList('drivers'),
      readList('teams'),
      readList('circuits'),
      readList('health')
    ]);

    return {
      drivers: drivers.map(normalizeDriver),
      teams: teams.map(normalizeTeam),
      circuits: circuits.map(normalizeCircuit),
      health
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
