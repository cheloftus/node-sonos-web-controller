"use strict";

var Sonos = {
	currentState: {
		selectedZone: null,
		zoneInfo: null,
	},
	grouping: {},
	players: {},
	queues: {},
	groupVolume: {
		disableUpdate: false,
		disableTimer: null
	},
	musicLibrary: null,
	currentZoneCoordinator: function () {
		return Sonos.players[Sonos.currentState.selectedZone];
	}
};
