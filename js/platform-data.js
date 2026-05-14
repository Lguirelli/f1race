(function () {
  'use strict';

  async function loadPlatformData() {
    if (!window.F1LocalDatabase?.loadPlatformData) {
      return { drivers: [], teams: [], circuits: [], health: [], meetings: [], sessions: [] };
    }

    return await window.F1LocalDatabase.loadPlatformData();
  }

  window.F1PlatformData = { loadPlatformData };
}());
