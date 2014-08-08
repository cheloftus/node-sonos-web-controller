"use strict";

///
/// GUI events
///
document.addEventListener('DOMContentLoaded', function (e) {
	renderMusicLibraryRoot();
	//togglePartyMode();
});

document.getElementById('zone-container').addEventListener('click', function (e) {
	// Find the actual UL
	function findZoneNode(currentNode) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == "UL") return currentNode;
		return findZoneNode(currentNode.parentNode);
	}

	var zone = findZoneNode(e.target);

	if (!zone) return;

	var previousZone = document.getElementById(Sonos.currentState.selectedZone);
	if (previousZone) previousZone.classList.remove('selected');

	Sonos.currentState.selectedZone = zone.id;
	zone.classList.add('selected');
	// Update controls with status
	updateControllerState();
	updateCurrentStatus();

	// fetch queue
	Socket.socket.emit('queue', {uuid: Sonos.currentState.selectedZone});

}, true);

document.getElementById('master-mute').addEventListener('click', function () {

	var action;
	// Find state of current player
	var player = Sonos.currentZoneCoordinator();

	// current state
	var mute = player.groupState.mute;
	Socket.socket.emit('group-mute', {uuid: player.uuid, mute: !mute});

	// update
	if (mute)
		this.src = this.src.replace(/_on\.svg/, '_off.svg');
	else
		this.src = this.src.replace(/_off\.svg/, '_on.svg');

});

document.getElementById('party-mode').addEventListener('click', function () {

	togglePartyMode();

});

document.getElementById('play-pause').addEventListener('click', function () {

	var action;
	// Find state of current player
	var player = Sonos.currentZoneCoordinator();
	if (player.state.zoneState == "PLAYING" ) {
		action = 'pause';
	} else {
		action = 'play';
	}

	console.log(action, Sonos.currentState)
	Socket.socket.emit('transport-state', { uuid: Sonos.currentState.selectedZone, state: action });
});

document.getElementById('next').addEventListener('click', function () {
	var action = "nextTrack";
	console.log(action, Sonos.currentState)
	Socket.socket.emit('transport-state', { uuid: Sonos.currentState.selectedZone, state: action });
});
document.getElementById('prev').addEventListener('click', function () {
	var action = "previousTrack";
	console.log(action, Sonos.currentState)
	Socket.socket.emit('transport-state', { uuid: Sonos.currentState.selectedZone, state: action });
});

document.getElementById('music-sources-container').addEventListener('dblclick', function (e) {
	function findLiNode(currentNode) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == "LI") return currentNode;
		return findLiNode(currentNode.parentNode);
	}
	var li = findLiNode(e.target);
	if (!li) return;
	if (li.dataset.type == 'track') {
		queueTrack(li.dataset.uri);
	}
	else {
		Socket.socket.emit('play-favorite', {uuid: Sonos.currentState.selectedZone, favorite: li.dataset.title});
	}
});

document.getElementById('music-sources-container').addEventListener('click', function (e) {
	function findElementOfType(currentNode, elmType) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == elmType) return currentNode;
		return findElementOfType(currentNode.parentNode, elmType);
	}
	var li = findElementOfType(e.target, "LI");
	if (!li) return;
	var addQ = findElementOfType(e.target, "DIV");
	if (addQ && addQ.className == 'btnQueueTrack') {
		addQ.classList.add('hidden');
		queueTrack(li.dataset.uri);
		return;
	}
	if (li.dataset.type == 'filterButton') {
		if (li.dataset.filteron == "true")
			navigateMusicLibrary(null, li.dataset.selector);
	}
	else if (li.dataset.type == 'ROOT' || li.dataset.type == 'ALBUMARTIST' || li.dataset.type == 'ALBUM' || li.dataset.type == 'TRACK') {
		navigateMusicLibrary(li.dataset.search, null);
	}
});

document.getElementById('library-back').addEventListener('click', function(e) {
	navigateMusicLibraryBack();
});
document.getElementById('library-music').addEventListener('click', function(e) {
	navigateMusicLibraryBackToRoot();
});

document.getElementById('status-container').addEventListener('dblclick', function (e) {
	function findQueueNode(currentNode) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == "LI") return currentNode;
		return findQueueNode(currentNode.parentNode);
	}
	var li = findQueueNode(e.target);
	if (!li) return;
	Socket.socket.emit('seek', {uuid: Sonos.currentState.selectedZone, trackNo: li.dataset.trackNo});
});

document.getElementById('position-info').addEventListener('click', function (e) {
	function findActionNode(currentNode) {
		if (currentNode == this) return;
		if (currentNode.className == "playback-mode") return currentNode;
		return findActionNode(currentNode.parentNode);
	}

	var actionNode = findActionNode(e.target);
	if (!actionNode) return;

	var action = actionNode.id;
	var data = {};
	var state = /off/.test(actionNode.src) ? true : false;
	data[action] = state;

	var selectedZone = Sonos.currentZoneCoordinator();
	// set this directly for instant feedback
	selectedZone.playMode[action] = state;
	updateCurrentStatus();
	Socket.socket.emit('playmode', {uuid: Sonos.currentState.selectedZone, state: data});

});

document.getElementById('player-volumes-container').addEventListener('click', function (e) {
	var muteButton = e.target;
	if (!muteButton.classList.contains('mute-button')) return;



	// this is a mute button, go.
	var player = Sonos.players[muteButton.dataset.id];
	var state = !player.state.mute;
	Socket.socket.emit('mute', {uuid: player.uuid, mute: state});

	// update GUI
		// update
	if (state)
		muteButton.src = muteButton.src.replace(/_off\.svg/, '_on.svg');
	else
		muteButton.src = muteButton.src.replace(/_on\.svg/, '_off.svg');

});

document.getElementById("current-track-art").addEventListener('load', function (e) {
	// new image loaded. update favicon
	// This prevents duplicate requests!
	console.log('albumart loaded', this.src)
	var oldFavicon = document.getElementById("favicon");
	var newFavicon = oldFavicon.cloneNode();
	newFavicon.href = this.src;
	newFavicon.type = "image/png";
	oldFavicon.parentNode.replaceChild(newFavicon, oldFavicon);

});

document.getElementById("music-library-page-prev").addEventListener('click', function(e) {
	var container = document.getElementById("music-library-container");
	container.scrollByPages(-1);
});

document.getElementById("music-library-page-next").addEventListener('click', function(e) {
	var container = document.getElementById("music-library-container");
	container.scrollByPages(+1);
});
