(function () {
  'use strict';

  function asNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function asDate(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function itemDate(item) {
    return asDate(item?.date || item?.date_start || item?.date_end || item?.time || 0);
  }

  function latestByDate(items) {
    if (!Array.isArray(items) || !items.length) return null;
    return items.reduce((latest, item) => {
      if (!latest) return item;
      return itemDate(item) > itemDate(latest) ? item : latest;
    }, null);
  }

  function earliestByDate(items) {
    if (!Array.isArray(items) || !items.length) return null;
    return items.reduce((earliest, item) => {
      if (!earliest) return item;
      return itemDate(item) < itemDate(earliest) ? item : earliest;
    }, null);
  }

  function sortByDate(items) {
    return [...(items || [])].sort((a, b) => itemDate(a) - itemDate(b));
  }

  function groupBy(items, keyFn) {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }

  function dedupeBy(items, keyFn) {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function latestMapBy(items, keyFn) {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = keyFn(item);
      const current = map.get(key);
      if (!current || itemDate(item) > itemDate(current)) {
        map.set(key, item);
      }
    });
    return map;
  }

  function minValid(items, getter) {
    const values = (items || [])
      .map(getter)
      .map((value) => asNumber(value))
      .filter((value) => value !== null && value > 0);
    return values.length ? Math.min(...values) : null;
  }

  function maxValid(items, getter) {
    const values = (items || [])
      .map(getter)
      .map((value) => asNumber(value))
      .filter((value) => value !== null);
    return values.length ? Math.max(...values) : null;
  }

  function secondsToLapTime(value) {
    const total = asNumber(value);
    if (total === null) return '-';
    const minutes = Math.floor(total / 60);
    const seconds = total - minutes * 60;
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }

  function formatGap(value) {
    const number = asNumber(value);
    if (number === null) return '-';
    if (Math.abs(number) < 0.0001) return 'Líder';
    if (number > 0) return `+${number.toFixed(3)}`;
    return number.toFixed(3);
  }

  function formatSigned(value, digits = 3) {
    const number = asNumber(value);
    if (number === null) return '-';
    if (Math.abs(number) < 0.0001) return '+0.000';
    return `${number > 0 ? '+' : ''}${number.toFixed(digits)}`;
  }

  function normalizeColor(value, fallback = '#ffffff') {
    if (!value) return fallback;
    const stringValue = String(value).trim();
    if (!stringValue) return fallback;
    return stringValue.startsWith('#') ? stringValue : `#${stringValue}`;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeSetText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? '-';
  }

  function safeSetHTML(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value ?? '';
  }

  function setStatus(message, type = 'info') {
    let element = document.getElementById('local-status-message');
    if (!element) {
      element = document.createElement('div');
      element.id = 'local-status-message';
      element.className = 'local-status-message';
      document.body.appendChild(element);
    }

    element.textContent = message || '';
    element.dataset.type = type;
    element.hidden = !message;
  }

  function countryFlag(countryCode) {
    const code = String(countryCode || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '🏁';
    return code.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
  }

  function sampleTimeSeriesBySeconds(items, seconds = 4, keyField = 'driver_number') {
    if (!Array.isArray(items) || !items.length) return [];
    if (!seconds || seconds <= 0) return items;

    const sorted = sortByDate(items);
    const buckets = new Set();
    const sampled = [];

    sorted.forEach((item) => {
      const bucket = Math.floor(itemDate(item).getTime() / (seconds * 1000));
      const key = `${item[keyField] || 'all'}:${bucket}`;
      if (!buckets.has(key)) {
        buckets.add(key);
        sampled.push(item);
      }
    });

    return sampled;
  }

  function driverLabel(driver) {
    return driver?.name_acronym || driver?.broadcast_name || driver?.full_name || driver?.driver_number || '-';
  }

  function driverName(driver) {
    return driver?.full_name || driver?.broadcast_name || driverLabel(driver);
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }



  function translateSessionName(value) {
    const name = String(value || '').trim();
    const normalized = name.toLowerCase();

    const map = {
      'race': 'Corrida',
      'qualifying': 'Classificação',
      'sprint': 'Sprint',
      'sprint qualifying': 'Classificação sprint',
      'sprint shootout': 'Classificação sprint',
      'practice 1': 'Treino livre 1',
      'practice 2': 'Treino livre 2',
      'practice 3': 'Treino livre 3'
    };

    return map[normalized] || name || 'Sessão';
  }

  function translateCompound(value, mode = 'full') {
    const compound = String(value || '').trim().toUpperCase();

    const full = {
      SOFT: 'Macio',
      MEDIUM: 'Médio',
      HARD: 'Duro',
      INTERMEDIATE: 'Intermediário',
      WET: 'Chuva',
      UNKNOWN: 'Desconhecido'
    };

    const short = {
      SOFT: 'M',
      MEDIUM: 'MÉ',
      HARD: 'D',
      INTERMEDIATE: 'I',
      WET: 'C',
      UNKNOWN: '-'
    };

    if (!compound || compound === '-') return '-';
    return mode === 'short' ? (short[compound] || compound[0]) : (full[compound] || value);
  }

  function translateRaceControlCategory(value) {
    const category = String(value || '').trim().toUpperCase();

    const map = {
      FLAG: 'Bandeira',
      SAFETY_CAR: 'Safety car',
      VIRTUAL_SAFETY_CAR: 'Safety car virtual',
      DRIVETHROUGH: 'Drive-through',
      CAR_EVENT: 'Evento do carro',
      OTHER: 'Status',
      TRACK: 'Pista',
      SESSION: 'Sessão'
    };

    return map[category] || value || 'Status';
  }

  window.F1LocalUtils = {
    asNumber,
    asDate,
    itemDate,
    latestByDate,
    earliestByDate,
    sortByDate,
    groupBy,
    dedupeBy,
    latestMapBy,
    minValid,
    maxValid,
    secondsToLapTime,
    formatGap,
    formatSigned,
    normalizeColor,
    escapeHTML,
    safeSetText,
    safeSetHTML,
    setStatus,
    countryFlag,
    sampleTimeSeriesBySeconds,
    driverLabel,
    driverName,
    slugify,
    translateSessionName,
    translateCompound,
    translateRaceControlCategory
  };
}());
