(function () {
  'use strict';

  function requireLocalDatabase() {
    if (!window.F1LocalDatabase) {
      throw new Error('Base local não carregada. Confirme se js/local-database.js foi importado antes deste arquivo.');
    }
    return window.F1LocalDatabase;
  }

  function sortByStart(a, b) {
    return new Date(a.date_start || a.date || 0) - new Date(b.date_start || b.date || 0);
  }

  function localOnlyWarning(endpoint) {
    console.warn(`Consulta externa bloqueada. O visualizador usa apenas a base local: ${endpoint}`);
  }

  function configure() {
    // Mantido apenas para compatibilidade. Não há API externa configurável nesta versão.
  }

  async function request(endpoint) {
    localOnlyWarning(endpoint);
    return [];
  }

  async function safeRequest(endpoint) {
    localOnlyWarning(endpoint);
    return [];
  }

  function clearCache() {
    // Não há cache de API externa nesta versão.
  }

  async function getMeetingsByYear(year) {
    const utils = window.OpenF1Utils;
    const local = await requireLocalDatabase().getMeetingsByYear(year);
    return utils.dedupeBy(local, (item) => `${item.year}-${item.meeting_key}`).sort(sortByStart);
  }

  async function getSessionsByMeeting(meetingKey) {
    const utils = window.OpenF1Utils;
    const local = await requireLocalDatabase().getSessionsByMeeting(meetingKey);
    return utils.dedupeBy(local, (item) => `${item.meeting_key}-${item.session_key}`).sort(sortByStart);
  }

  async function getSessionCoreBundle(sessionKey) {
    const utils = window.OpenF1Utils;
    const local = await requireLocalDatabase().getSessionCoreBundle(sessionKey);

    return {
      drivers: utils.dedupeBy(local.drivers || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}`),
      positions: utils.dedupeBy(local.positions || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`),
      intervals: utils.dedupeBy(local.intervals || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`),
      laps: utils.dedupeBy(local.laps || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.lap_number}`),
      weather: utils.dedupeBy(local.weather || [], (item) => `${item.session_key || sessionKey}-${item.date || item.time || item.timestamp}`),
      stints: utils.dedupeBy(local.stints || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.stint_number || item.lap_start}`),
      pit: utils.dedupeBy(local.pit || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.lap_number}-${item.date || item.time || item.timestamp}`),
      raceControl: utils.dedupeBy(local.raceControl || [], (item) => `${item.session_key || sessionKey}-${item.date || item.time || item.timestamp}-${item.message || item.type}`),
      sessionResult: utils.dedupeBy(local.sessionResult || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}`),
      startingGrid: utils.dedupeBy(local.startingGrid || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}`),
      location: utils.dedupeBy(local.location || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`),
      carData: utils.dedupeBy(local.carData || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`)
    };
  }

  async function getLocationForSession(sessionKey, sampleSeconds = 4) {
    const utils = window.OpenF1Utils;
    const data = await requireLocalDatabase().getLocationForSession(sessionKey);
    const deduped = utils.dedupeBy(data || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`);
    const sampled = utils.sampleTimeSeriesBySeconds(deduped, sampleSeconds, 'driver_number');
    const latestByDriver = Array.from(utils.latestMapBy(deduped, (item) => item.driver_number).values());
    return utils.dedupeBy([...sampled, ...latestByDriver], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`);
  }

  async function getCarDataForDriver(sessionKey, driverNumber, sampleSeconds = 4) {
    const utils = window.OpenF1Utils;
    const data = await requireLocalDatabase().getCarDataForDriver(sessionKey, driverNumber);
    const deduped = utils.dedupeBy(data || [], (item) => `${item.session_key || sessionKey}-${item.driver_number}-${item.date || item.time || item.timestamp}`);
    return utils.sampleTimeSeriesBySeconds(deduped, sampleSeconds, 'driver_number');
  }

  window.OpenF1API = {
    configure,
    request,
    safeRequest,
    clearCache,
    getMeetingsByYear,
    getSessionsByMeeting,
    getSessionCoreBundle,
    getLocationForSession,
    getCarDataForDriver
  };
}());
