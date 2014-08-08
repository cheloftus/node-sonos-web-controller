"use strict";

Socket.topologyChanged = function (shouldRenderVolumes) {
	if (shouldRenderVolumes) renderVolumes();

	reRenderZones();
	updateControllerState();
	updateCurrentStatus();
}

Socket.transportStateChanged = function (player) {
	reRenderZones();
	updateControllerState();
	updateCurrentStatus();
}

Socket.groupVolumeChanged = function (data) {
	if (data.uuid == Sonos.currentState.selectedZone) {
		GUI.masterVolume.setVolume(data.groupState.volume);
	}
	for (var uuid in data.playerVolumes) {
		Sonos.players[data.uuid].state.volume = data.playerVolumes[uuid];
		GUI.playerVolumes[uuid].setVolume(data.playerVolumes[uuid]);
	}
}

Socket.groupMuteChanged = function (data) {
	updateControllerState();
}

Socket.muteChanged = function (data) {
	document.getElementById("mute-" + data.uuid).src = data.state.mute ? 'svg/mute_on.svg' : 'svg/mute_off.svg';
}

Socket.favoritesChanged = function (data) {
	renderFavorites(data);
}

Socket.musicLibraryChanged = function (data) {
	GUI.musicLibrary.breadcrumbs[ GUI.musicLibrary.breadcrumbs.length - 1 ].library = data;
	renderMusicLibrary(data);
}

Socket.queueChanged = function (data) {
	if (data.uuid != Sonos.currentState.selectedZone) return;
	Sonos.queues[Sonos.currentState.selectedZone] = data.queue;
	renderQueue(data.queue);
}

///
/// ACTIONS
///

function updateCurrentStatus() {
	var selectedZone = Sonos.currentZoneCoordinator();
	document.getElementById("current-track-art").src =  selectedZone.state.currentTrack.albumArtURI;
	document.getElementById('page-title').textContent = selectedZone.state.currentTrack.title + ' - Sonos Web Controller';
	document.getElementById("track").textContent = selectedZone.state.currentTrack.title;
	document.getElementById("artist").textContent = selectedZone.state.currentTrack.artist;
	document.getElementById("album").textContent = selectedZone.state.currentTrack.album;

	if (selectedZone.state.nextTrack) {
		var nextTrack = selectedZone.state.nextTrack;
		document.getElementById("next-track").textContent = nextTrack.title + " - " + nextTrack.artist;
	}

	console.log(selectedZone)

	var repeat = document.getElementById("repeat");
	if (selectedZone.playMode.repeat) {
		repeat.src = repeat.src.replace(/_off\.png/, "_on.png");
	} else {
		repeat.src = repeat.src.replace(/_on\.png/, "_off.png");
	}

	var shuffle = document.getElementById("shuffle");
	if (selectedZone.playMode.shuffle) {
		shuffle.src = shuffle.src.replace(/_off\.png/, "_on.png");
	} else {
		shuffle.src = shuffle.src.replace(/_on\.png/, "_off.png");
	}

	var crossfade = document.getElementById("crossfade");
	if (selectedZone.playMode.crossfade) {
		crossfade.src = crossfade.src.replace(/_off\.png/, "_on.png");
	} else {
		crossfade.src = crossfade.src.replace(/_on\.png/, "_off.png");
	}

	GUI.progress.update(selectedZone);

	//Things have changed, rerender the queue
	renderQueue(null);
}

function updateControllerState() {
	var currentZone = Sonos.currentZoneCoordinator();
	var state = currentZone.state.zoneState;
	var playPauseButton = document.getElementById('play-pause');

	if (state == "PLAYING") {
		playPauseButton.src = '/svg/pause.svg';
	} else {
		playPauseButton.src = '/svg/play.svg';
	}

	// Fix volume
	GUI.masterVolume.setVolume(currentZone.groupState.volume);

	// fix mute
	var masterMute = document.getElementById('master-mute');
	if (currentZone.groupState.mute) {
		masterMute.src = "/svg/mute_on.svg";
	} else {
		masterMute.src = "/svg/mute_off.svg";
	}

	// fix volume container

	var allVolumes = {};
	for (var uuid in Sonos.players) {
		// is this in group?
		allVolumes[uuid] = null;
	}

	Sonos.grouping[Sonos.currentState.selectedZone].forEach(function (uuid) {
		document.getElementById("volume-" + uuid).classList.remove("hidden");
		delete allVolumes[uuid];
	});

	// now, hide the ones left
	for (var uuid in allVolumes) {
		document.getElementById("volume-" + uuid).classList.add("hidden");
	}

}

function toFormattedTime(seconds) {
		var chunks = [];
		var modulus = [60^2, 60];
		var remainingTime = seconds;
		// hours
		var hours = Math.floor(remainingTime/3600);

		if (hours > 0) {
			chunks.push(zpad(hours, 1));
			remainingTime -= hours * 3600;
		}

		// minutes
		var minutes = Math.floor(remainingTime/60);
		chunks.push(zpad(minutes, 1));
		remainingTime -= minutes * 60;
		// seconds
		chunks.push(zpad(Math.floor(remainingTime), 2))
		return chunks.join(':');
}

function zpad(number, width) {
	var str = number + "";
	if (str.length >= width) return str;
	var padding = new Array(width - str.length + 1).join('0');
	return padding + str;
}





var zoneManagement = function() {

	var dragItem;

	function findZoneNode(currentNode) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == "UL") return currentNode;
		return findZoneNode(currentNode.parentNode);
	}

	function handleDragStart(e) {
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/html', e.target.innerHTML);
		dragItem = e.target;
		dragItem.classList.add('drag');
	}

	function handleDragEnd(e) {
		dragItem.classList.remove('drag');
	}

	function handleDrop(e) {
		if (e.target == this) {
			// detach
			console.log("detach");
			Socket.socket.emit('group-management', {player: dragItem.dataset.id, group: null});
			return;
		}

		var zone = findZoneNode(e.target);
		if (!zone || zone == this.parentNode) return;

		console.log(dragItem.dataset.id, zone.id);
		Socket.socket.emit('group-management', {player: dragItem.dataset.id, group: zone.id});

	}

	function handleDragOver(e) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';

	}

	document.getElementById('zone-container').addEventListener('dragstart', handleDragStart);
	document.getElementById('zone-container').addEventListener('dragend', handleDragEnd);
	document.getElementById('zone-container').addEventListener('dragover', handleDragOver);
	document.getElementById('zone-container').addEventListener('drop', handleDrop);

}();

function renderVolumes() {
	var oldWrapper = document.getElementById('player-volumes');
	var newWrapper = oldWrapper.cloneNode(false);
	var masterVolume = document.getElementById('master-volume');
	var masterMute = document.getElementById('master-mute');

	var playerNodes = [];

	for (var i in Sonos.players) {
		var player = Sonos.players[i];
		var playerVolumeBar = masterVolume.cloneNode(true);
		var playerVolumeBarContainer = document.createElement('div');
		playerVolumeBarContainer.id = "volume-" + player.uuid;
		playerVolumeBar.id = "";
		playerVolumeBar.dataset.uuid = player.uuid;
		var playerName = document.createElement('h6');
		var playerMute = masterMute.cloneNode(true);
		playerMute.id = "mute-" + player.uuid;
		playerMute.className = "mute-button";
		playerMute.src = player.state.mute ? "/svg/mute_on.svg" : "/svg/mute_off.svg";
		playerMute.dataset.id = player.uuid;
		playerName.textContent = player.roomName;
		playerVolumeBarContainer.appendChild(playerName);
		playerVolumeBarContainer.appendChild(playerMute);
		playerVolumeBarContainer.appendChild(playerVolumeBar);
		newWrapper.appendChild(playerVolumeBarContainer);
		playerNodes.push({uuid: player.uuid, node: playerVolumeBar});
	}

	oldWrapper.parentNode.replaceChild(newWrapper, oldWrapper);

	// They need to be part of DOM before initialization
	playerNodes.forEach(function (playerPair) {
		var uuid = playerPair.uuid;
		var node = playerPair.node;
		GUI.playerVolumes[uuid] = new VolumeSlider(node, function (vol) {
			Socket.socket.emit('volume', {uuid: uuid, volume: vol});
		});

		console.log(uuid, Sonos.players[uuid].state.volume);

		GUI.playerVolumes[uuid].setVolume(Sonos.players[uuid].state.volume);
	});

	newWrapper.classList.add('hidden');
	newWrapper.classList.remove('loading');
}

function reRenderZones() {
	var oldWrapper = document.getElementById('zone-wrapper');
	var newWrapper = oldWrapper.cloneNode(false);

	for (var groupUUID in Sonos.grouping) {
		var ul = document.createElement('ul');
		ul.id = groupUUID;

		if (ul.id == Sonos.currentState.selectedZone)
			ul.className = "selected";

		Sonos.grouping[groupUUID].forEach(function (playerUUID) {
			var player = Sonos.players[playerUUID];
			var li = document.createElement('li');
			var span = document.createElement('span');
			span.textContent = player.roomName;
			li.appendChild(span);
			li.draggable = true;
			li.dataset.id = playerUUID;
			ul.appendChild(li);
		});

		newWrapper.appendChild(ul);
	}
	oldWrapper.parentNode.replaceChild(newWrapper, oldWrapper);
}

function renderFavorites(favorites) {
	var oldContainer = document.getElementById('favorites-container');
	var newContainer = oldContainer.cloneNode(false);

	var i = 0;

	favorites.forEach(function (favorite) {
		var li = document.createElement('li');
		li.dataset.title = favorite.title;
		var span = document.createElement('span');
		span.textContent = favorite.title;
		var albumArt = document.createElement('img');
		albumArt.src = favorite.albumArtURI;
		li.appendChild(albumArt);
		li.appendChild(span);
		li.tabIndex = i++;
		newContainer.appendChild(li);
	});


	oldContainer.parentNode.replaceChild(newContainer, oldContainer);
}

function renderQueue(queue) {

	//Get current queue if one not passed in
	var selectedZone = Sonos.currentZoneCoordinator();
	if (queue == null) {
		queue = Sonos.queues[Sonos.currentState.selectedZone];
		if(!queue) return;
	}

	//Is queue in use?
	document.getElementById('queueInUseText').textContent = (selectedZone.state.queueInUse ? '' : '(Not in Use)');
	//Queue size
	document.getElementById('queueSizeText').textContent = (selectedZone.state.numOfTracks - selectedZone.state.trackNo + 1) + ' of ' + selectedZone.state.numOfTracks + ' track' + (selectedZone.state.numOfTracks > 1 ? 's': '');
	
	var tempContainer = document.createDocumentFragment();
	var scrollTimeout;
	var trackIndex = queue.startIndex + 1;

	//In party mode, only show upcoming queue items
	var queueItems = queue.items;
	var showPreviousQueueItems = (GUI.partyMode ? false : true);
	if (showPreviousQueueItems == false) {
		queueItems = queueItems.slice(selectedZone.state.trackNo - 1);
		trackIndex += selectedZone.state.trackNo;
	}

	
	queueItems.forEach(function (q) {
		
		var li = document.createElement('li');
		li.dataset.title = q.uri;
		li.dataset.trackNo = trackIndex++;
		li.tabIndex = trackIndex;

		var albumArt = document.createElement('img');
		//albumArt.src = q.albumArtURI;
		albumArt.dataset.src = q.albumArtURI;
		if (q.uri == selectedZone.state.currentTrack.uri) {
			albumArt.dataset.src = 'images/queue_play.png';
			albumArt.src = albumArt.dataset.src;
			albumArt.className = "loaded";
		}

		li.appendChild(albumArt);

		var trackInfo = document.createElement('div');
		var title = document.createElement('p');
		title.className = 'title';
		title.textContent = q.title;
		trackInfo.appendChild(title);
		var artist = document.createElement('p');
		artist.className = 'artist';
		artist.textContent = q.artist;
		trackInfo.appendChild(artist);

		li.appendChild(trackInfo);
		tempContainer.appendChild(li);

	});

	var oldContainer = document.getElementById('queue-container');
	if (queue.startIndex == 0) {
		// This is a new queue
		var newContainer = oldContainer.cloneNode(false);
		newContainer.addEventListener('scroll', function (e) {
			clearTimeout(scrollTimeout);
			var _this = this;
			scrollTimeout = setTimeout(function () {
				lazyLoadImages(_this);
			},150);

		});
		newContainer.appendChild(tempContainer);
		oldContainer.parentNode.replaceChild(newContainer, oldContainer);
		lazyLoadImages(newContainer); //run once on demand
	} else {
		// This should be added! we assume they come in the correct order
		oldContainer.appendChild(tempContainer);
		lazyLoadImages(tempContainer); //run once on demand
	}

}

function renderMusicLibrary(library, pattern, showAll) {

	if (library == null) library = GUI.musicLibrary.breadcrumbs[ GUI.musicLibrary.breadcrumbs.length - 1 ].library;
	if (library == null) return;

	//First, do a search to see if we should display the library or the filter panel
	var filterResult = prepareMusicFiltered(library, pattern);
	if (!showAll && GUI.partyMode && filterResult.library.length > 16) {
		renderMusicFilter(filterResult, pattern);
		return;
	}

	//Now show the list
	var oldContainer = document.getElementById('music-library-container');
	var newContainer = oldContainer.cloneNode(false);

	var i = 0;

	library = filterResult.library;
	library.forEach(function (libraryitem) {

		var li = document.createElement('li');
		var trackInfo = document.createElement('div');
		var title = document.createElement('p');
		title.className = 'title';
		title.textContent = libraryitem.title;
		if (libraryitem.artist) {
			var artist = document.createElement('p');
			artist.className = 'artist';
			artist.textContent = libraryitem.artist;
			if (libraryitem.album) {
				artist.textContent += ' (' + libraryitem.album + ')';
			}
		}
		var albumArt = document.createElement('img');
		//Handle artists/albums and tracks differently
		if (libraryitem.attr) {
			li.dataset.type = /:([A-Z]+)\//.exec(libraryitem.attr.id)[1];
			li.dataset.search = libraryitem.attr.id;
			albumArt.src = 'images/browse_generic_multi_track.png';
		} else {
			li.dataset.type = 'track';
			albumArt.src = 'images/browse_missing_album_art.png';
			//If its a track, add the queue button
			var queueTrack = document.createElement('div');
			queueTrack.className = 'btnQueueTrack';
			li.appendChild(queueTrack);
		}
		li.dataset.title = libraryitem.title;
		if (libraryitem.artist) li.dataset.artist = libraryitem.artist;
		if (libraryitem.album) li.dataset.album = libraryitem.album;
		if (libraryitem.uri) li.dataset.uri = libraryitem.uri;
		if (libraryitem.albumArtURI) albumArt.dataset.src = libraryitem.albumArtURI;
		trackInfo.appendChild(title);
		if (artist) trackInfo.appendChild(artist);
		li.appendChild(albumArt);
		li.appendChild(trackInfo);
		li.tabIndex = i++;
		newContainer.appendChild(li);
	});

	//Show paging?
	if (i > 20) {
		document.getElementById('music-library-pager').classList.remove('hidden');
	} else {
		document.getElementById('music-library-pager').classList.add('hidden');
	}

	//Render
	var scrollTimeout;
	newContainer.addEventListener('scroll', function (e) {
		clearTimeout(scrollTimeout);
		var _this = this;
		scrollTimeout = setTimeout(function () {
			lazyLoadImages(_this);
		},150);
	});
	oldContainer.parentNode.replaceChild(newContainer, oldContainer);
	lazyLoadImages(newContainer);

	//Status
	GUI.musicLibrary.isLoading = false;
}

function prepareMusicFiltered(library, pattern) {

	if (library == null) library = Sonos.musicLibrary;
	if (library == null) return;	

	var _selectors = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_', '#'];

	//Prepare the selectors for this search term
	var selectors = {};
	_selectors.forEach(function (selector) {
		selectors[ (pattern ? pattern : '') + selector ] = 0;
	});
	var selectorLength = pattern ? pattern.length + 1 : 1;

	var filteredLibrary = [];

	//Update the selectors with counts and produce filtered library
	library.forEach(function (libraryitem) {
		var sel = libraryitem.title.substring(0, selectorLength);
		sel = sel.replace(/[^A-Za-z ]/g, '#');
		sel = sel.replace(/ /g, '_');
		sel = sel.toUpperCase();
		if (sel in selectors) {
			selectors[sel]++;
			filteredLibrary.push(libraryitem);
		}
	});

	//Return the filtered library & the selectors for use in renderMusicLibrary() or renderMusicSearch()
	return {library: filteredLibrary, selectors: selectors};
}

function renderMusicFilter(preparedFilter, pattern) {

	var oldContainer = document.getElementById('music-library-container');
	var newContainer = oldContainer.cloneNode(false);

	//Display the selectors
	var i = 0;
	Object.keys(preparedFilter.selectors).forEach(function (selector) {

		var li = document.createElement('li');
		li.className = 'filterButton';
		li.dataset.selector = selector;
		li.dataset.type = 'filterButton';
		if (preparedFilter.selectors[selector] == 0) {
			li.classList.add('muted');
			li.dataset.filteron = false;
		} else { 
			li.dataset.filteron = true;
		}
		var span = document.createElement('span');
		span.textContent = selector;
		li.appendChild(span);
		li.tabIndex = i++;
		newContainer.appendChild(li);
	});

	var li = document.createElement('li');
	li.classList.add('filterButton');
	li.dataset.selector = 'ALL';
	li.dataset.type = 'filterButton';
	li.dataset.filteron = true;
	var special = document.createElement('span');
	special.textContent = 'Show All';
	special.classList.add('blue-button');
	special.classList.add('filterButtonSpecial');
	li.appendChild(special);
	li.tabIndex = i++;
	newContainer.appendChild(li);

	//Render
	newContainer.dataset['searchTerm'] = pattern ? pattern : '';
	oldContainer.parentNode.replaceChild(newContainer, oldContainer);
	document.getElementById('music-library-pager').classList.add('hidden');
	//Status
	GUI.musicLibrary.isLoading = false;
}

function navigateMusicLibrary(search, selector) {
	logUserInteraction();

	//Status
	if (GUI.musicLibrary.isLoading) return;
	GUI.musicLibrary.isLoading = true;

	//Not a real navigation - just get rid of filter
	if (selector == 'ALL') {
		renderMusicLibrary(null, '', true);
		return;
	}

	//Populate search & library
	var library = null;
	if (selector) {
		search = GUI.musicLibrary.breadcrumbs[ GUI.musicLibrary.breadcrumbs.length - 1 ].search;
		library = GUI.musicLibrary.breadcrumbs.length > 0 ? GUI.musicLibrary.breadcrumbs[ GUI.musicLibrary.breadcrumbs.length - 1 ].library : null;
	}

	//Get breadcrumb text
	var text = null;
	if (!selector) {
		var splitter = /:([A-Z]+)(?:\/(.*))?/.exec(search);
		if (splitter && splitter[2]) {
			var parts = splitter[2].split('/');
			if (parts[parts.length - 1] == "") text = "All";	//special case
			else text = htmlDecode(parts[parts.length - 1]);
		} else if (splitter && splitter[1]) {
			if (splitter[1] == 'ALBUMARTIST') text = 'Artists';
			if (splitter[1] == 'ALBUM') text = 'Albums';
			if (splitter[1] == 'TRACKS') text = 'Tracks';
		}
	}
	var breadcrumb = {
		text: text,
		selector: selector
	}

	//Update breadcrumbs
	GUI.musicLibrary.breadcrumbs.push({search: search, filter: selector, library: library, breadcrumb: breadcrumb});

	//Update header text
	var breadcrumbs = [];
	GUI.musicLibrary.breadcrumbs.forEach(function (item) {
		if (item.breadcrumb.text)
			breadcrumbs.push(item.breadcrumb.text);		
	});
	if (GUI.musicLibrary.breadcrumbs[GUI.musicLibrary.breadcrumbs.length - 1].breadcrumb.selector) {
		//We are currently filtering, add this
		breadcrumbs.push('(' + GUI.musicLibrary.breadcrumbs[GUI.musicLibrary.breadcrumbs.length - 1].breadcrumb.selector + '...)');
	}
	/* I put a lot of effort above into building a proper breadcrumb chain (A -> B -> C).
	   But it doesn't fit on the page a lot of the time. So I'm going to use a simple one instead.
	   TODO: work out where/how to display the long chain
	   */
	var simpleBreadcrumb = true;

	if (breadcrumbs.length > 0) {
		if (simpleBreadcrumb) {
			document.getElementById("music-library-headertext").innerText = ' - ' + breadcrumbs[breadcrumbs.length-1];
		} else {
			document.getElementById("music-library-headertext").innerText = htmlDecode(' &#8594; ') + breadcrumbs.join(htmlDecode(' &#8594; '));	
		}
		document.getElementById("library-back").classList.remove('hidden');
		document.getElementById("library-music").classList.remove('hidden');
	} else {
		document.getElementById("music-library-headertext").innerText = '';
	}
	

	//Get results
	if (selector) {
		renderMusicLibrary(null, selector);
	} else if (search) {
		Socket.socket.emit('search-library', {uuid: Sonos.currentState.selectedZone, search: search});
	}
}

function navigateMusicLibraryBack() {
	logUserInteraction();

	//Status
	if (GUI.musicLibrary.isLoading) return;

	var gone = GUI.musicLibrary.breadcrumbs.pop();
	var last = GUI.musicLibrary.breadcrumbs.pop();
	if (last) {
		navigateMusicLibrary(last.search, last.filter);
	} else {
		renderMusicLibraryRoot();
	}
}

function navigateMusicLibraryBackToRoot() {
	logUserInteraction();

	//Status
	if (GUI.musicLibrary.isLoading) return;

	GUI.musicLibrary.breadcrumbs = [];
	renderMusicLibraryRoot();
}

function renderMusicLibraryRoot() {

	//Status
	if (GUI.musicLibrary.isLoading) return;
	GUI.musicLibrary.isLoading = true;

	var rows = [
		{name: 'Artists', search: 'A:ALBUMARTIST'},
		{name: 'Albums', search: 'A:ALBUM'},
		//{name: 'Tracks', search: 'A:TRACKS'},
	]

	document.getElementById("music-library-headertext").innerText = '';
	document.getElementById("library-back").classList.add('hidden');
	document.getElementById("library-music").classList.add('hidden');

	var oldContainer = document.getElementById('music-library-container');
	var newContainer = oldContainer.cloneNode(false);

	var i = 0;
	rows.forEach(function(row) {
		var li = document.createElement('li');
		li.dataset.type = "ROOT";
		li.dataset.title = row.name;
		li.dataset.search = row.search;
		li.tabindex = i++;
		var img = document.createElement('img');
		img.src = "images/browse_generic_folder.png";
		var p = document.createElement('p');
		p.textContent = row.name;
		li.appendChild(img);
		li.appendChild(p);
		newContainer.appendChild(li);
	});
	//Render
	oldContainer.parentNode.replaceChild(newContainer, oldContainer);
	document.getElementById('music-library-pager').classList.add('hidden');
	//Status
	GUI.musicLibrary.isLoading = false;
}

function lazyLoadImages(container) {
	// Find elements that are in viewport
	var containerViewport = container.getBoundingClientRect();
	// best estimate of starting point
	var trackHeight = container.firstChild.scrollHeight;
	// for reasons I have no idea, the above doesn't always work. So fixup.
	if (container.children.length > 1)
		trackHeight = (container.children[container.children.length-1].getBoundingClientRect().top - container.children[0].getBoundingClientRect().top) / container.children.length

	// startIndex
	var startIndex = Math.floor(container.scrollTop / trackHeight);
	var currentNode = container.childNodes[startIndex];

	while (currentNode && currentNode.getBoundingClientRect().top < containerViewport.bottom) {
		var img = currentNode.firstChild;
		if (img.className == 'btnQueueTrack') img = img.nextSibling;
		currentNode = currentNode.nextSibling;
		if (img.className == 'loaded') {
			continue;
		}

		// get image
		if (img.dataset.src) {
			img.src = img.dataset.src;
		}
		img.className = 'loaded';
	}
}

function htmlDecode(input){
	var e = document.createElement('div');
	e.innerHTML = input;
	return unescape(e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue);
}

function queueTrack(trackURI) {
	var queueit = true;
	//In party mode, prevent doubly queuing the same track
	if (GUI.partyMode) {
		var queue = Sonos.queues[Sonos.currentState.selectedZone];
		if(!queue) {
			//Can't get the queue, will have to assume the user is being sensible
		}
		else if(queue.items.length > 0) {
			if(queue.items[queue.items.length-1].uri == trackURI) {
				//block it!
				queueit = false;
			}
		}
	}
	if (queueit) {
		Socket.socket.emit('queue-track', {uuid: Sonos.currentState.selectedZone, uri: trackURI});
	}
}

function logUserInteraction() {
	if (GUI.partyMode) {
		if (GUI.userInteractionTimeout) clearTimeout(GUI.userInteractionTimeout);
		GUI.userInteractionTimeout = setTimeout(function() {
			navigateMusicLibraryBackToRoot();
		}, 120000);
	}
}

function togglePartyMode() {
	// Find current state of web controller (party mode or not)
	var partymode = GUI.partyMode;

	// Change it
	partymode = !(GUI.partyMode);
	GUI.partyMode = partymode;

	var elements = [
		document.getElementById('column-container'),
		document.getElementById('top-control'),
		document.getElementById('body'),
	]
	elements.forEach(function(elm) {
		if (partymode) {
			elm.classList.add('party-mode');
		}
		else {
			elm.classList.remove('party-mode');
		}	
	});
	updateCurrentStatus();

	// update
	if (partymode)
		document.getElementById('party-mode').src = this.src.replace(/_on\.svg/, '_off.svg');
	else
		document.getElementById('party-mode').src = this.src.replace(/_off\.svg/, '_on.svg');
}