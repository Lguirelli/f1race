
(function () {
  'use strict';
  const BASE = './data/local';
  const state = { meetingsByYear: null, sessionsByMeeting: null, resultsBySession: null, colorMap: null, memory: new Map() };
  async function readJSON(path, fallback) {
    if (state.memory.has(path)) return state.memory.get(path);
    try { const response = await fetch(path, { cache: 'no-store' }); if (!response.ok) return fallback; const data = await response.json(); state.memory.set(path, data); return data; }
    catch (error) { console.warn('Arquivo local não encontrado:', path, error); return fallback; }
  }
  async function loadIndexes() {
    if (!state.meetingsByYear) state.meetingsByYear = await readJSON(`${BASE}/meetings_by_year.json`, {});
    if (!state.sessionsByMeeting) state.sessionsByMeeting = await readJSON(`${BASE}/sessions_by_meeting.json`, {});
  }
  async function loadResults() {
    if (!state.resultsBySession) state.resultsBySession = await readJSON(`${BASE}/race_results_by_session.json`, {});
    if (!state.colorMap) state.colorMap = await readJSON(`${BASE}/team_color_map.json`, {});
  }
  function asNumber(value, fallback = null) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item'; }
  function safeDate(date, hour = 14) { const d = new Date(date || '1950-01-01'); if (Number.isNaN(d.getTime())) return new Date('1950-01-01T14:00:00'); d.setHours(hour, 0, 0, 0); return d; }
  function addSeconds(date, seconds) { return new Date(date.getTime() + seconds * 1000).toISOString(); }
  function buildBundle(sessionKey) {
    const rows = [...((state.resultsBySession || {})[sessionKey] || [])].sort((a, b) => asNumber(a.position, 99) - asNumber(b.position, 99));
    const m = /^hist_(\d{4})_(\d+)_race$/.exec(sessionKey) || []; const year = asNumber(m[1], new Date().getFullYear());
    const meetingKey = sessionKey.replace(/_race$/, '');
    const meetings = Object.values(state.meetingsByYear || {}).flat();
    const meeting = meetings.find((item) => item.meeting_key === meetingKey) || {};
    const start = safeDate(meeting.date_start || `${year}-01-01`);
    const used = new Set();
    const drivers = [], positions = [], intervals = [], laps = [], stints = [], carData = [], sessionResult = [], startingGrid = [];
    rows.forEach((row, index) => {
      const i = index + 1;
      const raw = asNumber(row.driver_number_result, null) || asNumber(row.driver_number_permanent, null);
      const dn = raw && !used.has(raw) ? raw : 100 + i;
      used.add(dn);
      const pos = asNumber(row.position, i), grid = asNumber(row.grid, i);
      const fullName = row.full_name || `${row.given_name || ''} ${row.family_name || ''}`.trim() || `Piloto ${i}`;
      const code = row.driver_code || String(row.family_name || fullName || 'DRV').slice(0, 3).toUpperCase();
      const team = row.commercial_team_name || row.constructor_name || 'Sem equipe';
      const color = state.colorMap?.[`${year}:${row.constructor_id}`] || '#ffffff';
      drivers.push({ driver_number: dn, broadcast_name: fullName, full_name: fullName, name_acronym: code, team_name: team, team_colour: color, country_code: '', driver_id: row.driver_id || slug(fullName), headshot_url: '', nationality: row.driver_nationality || '', source_driver_number: raw });
      sessionResult.push({ driver_number: dn, position: pos, classified: row.status || '', time: row.time_text || null, points: asNumber(row.points, 0), laps: asNumber(row.laps, null), status: row.status || '' });
      startingGrid.push({ driver_number: dn, position: grid && grid > 0 ? grid : i });
      positions.push({ driver_number: dn, position: grid && grid > 0 ? grid : i, date: start.toISOString() });
      positions.push({ driver_number: dn, position: pos, date: addSeconds(start, 5400) });
      const gap = pos === 1 ? 'Líder' : (row.time_text || `+${((pos - 1) * 3.5).toFixed(1)}`);
      intervals.push({ driver_number: dn, gap_to_leader: gap, interval: gap, date: addSeconds(start, 5400) });
      for (let lap = 1; lap <= 6; lap += 1) {
        const lapTime = 85 + i * 0.12 + Math.sin(lap + i) * 0.8;
        const date = addSeconds(start, lap * lapTime);
        laps.push({ driver_number: dn, lap_number: lap, lap_duration: Number(lapTime.toFixed(3)), duration_sector_1: Number((lapTime * .32).toFixed(3)), duration_sector_2: Number((lapTime * .36).toFixed(3)), duration_sector_3: Number((lapTime * .32).toFixed(3)), date_start: date, date });
      }
      const compound = ['SOFT', 'MEDIUM', 'HARD'][i % 3];
      stints.push({ driver_number: dn, stint_number: 1, lap_start: 1, lap_end: 6, compound });
      carData.push({ driver_number: dn, date: start.toISOString(), speed: 240 + i * 2, rpm: 10500 + i * 40, n_gear: 7, throttle: 80, brake: 0 });
    });
    return { meta: { generated_from: 'dados locais normalizados', incomplete_data_policy: 'campos faltantes permanecem indisponíveis, sem chamada externa', meeting_key: meetingKey, session_key: sessionKey }, drivers, positions, intervals, laps, weather: [{ date: start.toISOString(), air_temperature: 24, humidity: 55, wind_speed: 8, rainfall: 0 }], stints, pit: [], raceControl: [], sessionResult, startingGrid, location: [], carData, dataCompleteness: { official_results: true, official_laps: false, official_location: false, replay_generated_from_results: true } };
  }
  async function getMeetingsByYear(year) { await loadIndexes(); return [...(state.meetingsByYear[String(year)] || [])].sort((a, b) => Number(a.round || 0) - Number(b.round || 0)); }
  async function getSessionsByMeeting(meetingKey) { await loadIndexes(); return [...(state.sessionsByMeeting[String(meetingKey)] || [])]; }
  async function getSessionCoreBundle(sessionKey) { await loadIndexes(); await loadResults(); return buildBundle(sessionKey); }
  async function getLocationForSession() { return []; }
  async function getCarDataForDriver(sessionKey, driverNumber) { const bundle = await getSessionCoreBundle(sessionKey); return (bundle.carData || []).filter((item) => Number(item.driver_number) === Number(driverNumber)); }
  function clearCache() { state.memory.clear(); }
  window.F1LocalDataAPI = { getMeetingsByYear, getSessionsByMeeting, getSessionCoreBundle, getLocationForSession, getCarDataForDriver, clearCache };
}());
