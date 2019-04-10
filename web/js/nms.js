"use strict";

/*
 * This is the original nms.js and it's a bit of a mess as much has been
 * moved into separate js-files and cleaned up.
 *
 * Gradual refactoring has begun.
 *
 * On the TODO list:
 *
 * - Move all pure UI stuff into nmsUi: nightMode, vertical mode,
 *   menushowing,
 * - Get rid of "tvmode". As in: complete the merge
 * - nms.timers probably also deserves to die. It used to do a lot more,
 *   now it's just leftovers.
 */
var nms = {
	stats:{}, // Various internal stats
	get nightMode() { return this._nightMode; },
	set nightMode(val) { if (val != this._nightMode) { this._nightMode = val; setNightMode(val); } },
	/*
	 * Various setInterval() handlers. See nmsTimer() for how they are
	 * used.
	 *
	 * FIXME: Should just stop using these.
	 */
	timers: {
		tvmode: false
	},

	menuShowing:true,
	oplogShowing:true,
	get uptime() {
		return (Date.now() - this._startTime)/1000;
	},
	_vertical: 0,
	get vertical() { return this._vertical },
	set vertical(v) {
		this._vertical = v;
		if(v)
			document.body.classList.add("vertical");
		else
			document.body.classList.remove("vertical");
		saveSettings();
	},

	interval: 10,
	_user: undefined,
	get user() { return this._user; },
	set user(u) {
		this._user = u;
		saveSettings();
	},
	/*
	 * This is a list of nms[x] variables that we store in our
	 * settings-cookie when altered and restore on load.
	 */
	settingsList:[
		'nightMode',
		'menuShowing',
		'vertical',
		'interval',
		'oplogShowing',
		'user'
	],
	keyBindings:{
		'-':toggleMenu,
		'n':toggleNightMode,
		'1':setMapModeFromN,
		'2':setMapModeFromN,
		'3':setMapModeFromN,
		'4':setMapModeFromN,
		'5':setMapModeFromN,
		'6':setMapModeFromN,
		'7':setMapModeFromN,
		'8':setMapModeFromN,
		'9':setMapModeFromN,
		'c':toggleConnect,
		'H':moveTimeFromKey,
		'h':moveTimeFromKey,
		'j':moveTimeFromKey,
		'k':moveTimeFromKey,
		'l':moveTimeFromKey,
		'L':moveTimeFromKey,
		'p':moveTimeFromKey,
		'r':moveTimeFromKey,
		'o':toggleOplog,
		'Escape':hideWindow,
		'?':toggleHelp
	},
	tvmode: {
		handlers: [],
		currentIndex: 0,
		interval: 20000,
		active: false,
		vertical: false
	}
};

/*
 * Returns a handler object.
 *
 * FIXME: This is legacy-stuff, should get rid of it. DO NOT use this for
 * new code.
 */
function nmsTimer(handler, interval, name, description) {
	this.handler = handler;
	this.handle = false;
	this.interval = parseInt(interval);
	this.name = name;
	this.description = description;
	this.start = function() {
		if (this.handle) {
			this.stop();
		}
		this.handle = setInterval(this.handler,this.interval);
		};
	this.stop = function() {
		if (this.handle)
			clearInterval(this.handle);
			this.handle = false;
		};

	this.setInterval = function(interval) {
		var started = this.handle != false;
		this.stop();
		this.interval = parseInt(interval);
		if (started)
			this.start();
	};
}


/*
 * Convenience function that doesn't support huge numbers, and it's easier
 * to comment than to fix. But not really, but I'm not fixing it anyway.
 */
function byteCount(bytes,precision) {
	if (precision ==undefined)
		precision = 1;
	var units = ['', 'K', 'M', 'G', 'T', 'P', 'E','Z'];
	var i = 0;
	while (bytes > 1024) {
		bytes = bytes / 1024;
		i++;
	}
	if (i == 0)
		return bytes;
	return bytes.toFixed(precision) + units[i];
}

/*
 * Definitely not a way to toggle night mode. Does something COMPLETELY
 * DIFFERENT.
 */
function toggleNightMode()
{
	nms.nightMode = !nms.nightMode;
	saveSettings();
}

/*
 * There are 4 legend-bars. This is a helper-function to set the color and
 * description/name for each one. Used from handler init-functions.
 */
function setLegend(x,color,name)
{
	var el = document.getElementById("legend-" + x);
	el.style.background = color;
	el.title = name;
	el.textContent = name;
	if (name == "") {
		el.style.display = 'none';
	} else {
		el.style.display = '';
	}
}

/*
 * Start TV-mode
 *
 * Loops trough a list of views/updaters at a set interval.
 * Arguments: array of views, interval in seconds
 *
 * FIXME: this is getting gradually stripped down from the original, so far
 * we're not quite there yet with merging it with the regular code paths.
 */
nms.tvmode.start = function(views,interval) {
	nms.tvmode.handlers = [];
	for(var view in views) {
		for(var handler in handlers) {
			if(views[view] == handlers[handler].tag) {
				nms.tvmode.handlers.push(handlers[handler]);
			}
		}
	}
	if (nms.tvmode.handlers.length > 1) {
		if(interval > 0)
			nms.tvmode.interval = interval * 1000;
		nms.timers.tvmode = new nmsTimer(nms.tvmode.tick, nms.tvmode.interval, "TV-mode ticker", "Handler used to advance tv-mode");
		nms.timers.tvmode.start();
		nms.tvmode.tick();
		nms.tvmode.active = true;
	}
}
nms.tvmode.tick = function() {
	if(nms.tvmode.currentIndex > nms.tvmode.handlers.length - 1) {
		nms.tvmode.currentIndex = 0;
	}
	setUpdater(nms.tvmode.handlers[nms.tvmode.currentIndex],false);
	nms.tvmode.currentIndex++;
}
nms.tvmode.stop = function() {
	if (nms.tvmode.active) {
		nms.timers.tvmode.stop();
		nms.tvmode.active = false;
	}
}

/*
 * Used when changing handler to ensure that the new handler is listed in
 * the anchor. The anchor can contain a comma-separated list of views and
 * we only overwrite it if the new view isn't present.
 */
function ensureAnchorHas(view) {
	try  {
		var views = document.location.hash.slice(1);
		views = views.split(",");
		if (views.includes(view)) {
			return true;
		}
	} catch(e) { }
	document.location.hash = view;
	return false;
}

/*
 * Change map handler (e.g., change from uplink map to ping map)
 *
 * stopTv esnures that we don't conflict with the tvmode thing. If a
 * user-initiated map is selected, tvmode is disabled.
 */
function setUpdater(fo, stopTv )
{
	if (stopTv == undefined) {
		stopTv = true;
	}
	if (stopTv)
		nms.tvmode.stop();
	nmsMap.reset();
	nmsData.unregisterHandlerWildcard("mapHandler");
	try {
		fo.init();
	} catch (e) {
		/*
		 * This can happen typically on initial load where the data
		 * hasn't been retrieved yet. Instead of breaking the
		 * entire init-process, just bail out here.
		 */
		console.log("Possibly broken handler: " + fo.name);
		console.log(e);
	}
	var foo = document.getElementById("map-mode-title");
	foo.innerHTML = fo.name;
	ensureAnchorHas(fo.tag);
}

function toggleLayer(layer) {
       var l = document.getElementById(layer);
       if (l.style.display == 'none')
               l.style.display = '';
       else
               l.style.display = 'none';
}

function hideLayer(layer) {
       var l = document.getElementById(layer);
       l.style.display = 'none';
}


function toggleConnect() {
	toggleLayer("linkCanvas");
}

/*
 * Returns true if the coordinates (x,y) is inside the box defined by
 * box.{x,y,w.h} (e.g.: placement of a switch).
 */
function isIn(box, x, y)
{
    return ((x >= box.x) && (x <= (box.x + box.width)) && (y >= box.y) && (y <= (box.y + box.height)));
}

/*
 * Return the name of the switch found at coordinates (x,y), or 'undefined'
 * if none is found.
 *
 * FIXME: this belongs in nmsMap.
 */
function findSwitch(x,y) {
	x = parseInt(parseInt(x) / nmsMap.scale);
	y = parseInt(parseInt(y) / nmsMap.scale);

	for (var v in nmsData.switches.switches) {
		if(isIn(nmsData.switches.switches[v]['placement'],x,y)) {
			return v;
		}
	}
	return undefined;
}

/*
 * Set night mode to whatever 'toggle' is.
 *
 * Changes background and nav-bar, then leaves the rest to nmsMap.
 */
function setNightMode(toggle) {
	nms.nightMode = toggle;
	var body = document.getElementById("body");
	body.style.background = toggle ? "black" : "white";
	var nav = document.getElementsByTagName("nav")[0];
	if (toggle) {
		nav.classList.add('navbar-inverse');
		document.body.classList.add("nightmode");
	} else {
		nav.classList.remove('navbar-inverse');
		document.body.classList.remove("nightmode");
	}
	nmsMap.setNightMode(toggle);
	setNightModeChart(toggle);
}

/*
 * Only used to fetch the initial config for anything that needs to be
 * handled prior to regular "boot up".
 *
 * For the moment, that only means detecting if we're being run on a public
 * vhost or not. This has to be done in synch because it affects what
 * sources we register for nmsData[]. If we wait for nmsData['config'],
 * it's too late because all other things have been initialized already.
 *
 * If you add a configuration setting, use nmsData['config'] as much as
 * possible. Avoid adding to this function.
 *
 * FIXME: If anyone has a way to remove the deprecation warnings, either by
 * just silencing them or by moving this off the main thread, then go
 * ahead and fix it. I don't consider it a real problem, though.
 */
function getInitialConfig() {
	$.ajax({
		type: "GET",
		url: "/api/public/config",
		async: false,
		dataType: "json",
		success: function (data, textStatus, jqXHR) {
			if (data["config"]["public"] == "true") {
				nms._public = true;
				document.body.classList.add("gondul-public");
			} else {
				nms._public = false;
				document.body.classList.add("gondul-private");
				nmsTemplate.getTemplates();
			}
		}
	});
}

/*
 * Boot up "fully fledged" NMS.
 *
 * This can be re-written to provide different looks and feels but using
 * the same framework. Or rather: that's the goal. We're not quite there
 * yet.
 */
function initNMS() {
	// Only used for dev-purposes now. Accessible through nms.uptime.
	nms._startTime = Date.now();

	// Public
	nmsData.registerSource("config","/api/public/config");
	nmsData.registerSource("ping", "/api/public/ping");
	nmsData.registerSource("switches","/api/public/switches");
	nmsData.registerSource("switchstate","/api/public/switch-state");
	nmsData.registerSource("dhcpsummary","/api/public/dhcp-summary");
	nmsData.registerSource("dhcp","/api/public/dhcp");

	// Fetch initial config. Basically just populates nms._public.
	// All other settings are kept in nmsData['config'].
	getInitialConfig();

	// This is a magic dummy-source, it's purpose is to give a unified
	// way to get ticks every second. It is mainly meant to allow map
	// handlers to register for ticks so they will execute without data
	// (and thus notice stale data instead of showing a green ping-map
	// despite no pings)
	nmsData.registerSource("ticker","bananabananbanana");

	if (!nms._public) {
		// Private
		nmsData.registerSource("snmp","/api/read/snmp");
		nmsData.registerSource("smanagement","/api/read/switches-management");
		nmsData.registerSource("oplog", "/api/read/oplog");
		nmsData.registerSource("networks","/api/read/networks");
		nmsOplog.init();
	}
	restoreSettings();
	nmsMap.init();
	detectHandler();
	setupKeyhandler();
	nmsSearch.init();
	nmsDhcp.init();
}

function detectHandler() {
	var views = document.location.hash.slice(1);
	var interval = nms.interval;
	if (views == undefined || views == "")
		views = "health";
		if (nms._public)
			views = "ping";
	views = views.split(",");

	if (views.length > 1) {
		nms.tvmode.start(views,interval);
		return;
	} else {
		for (var i in handlers) {
			if (handlers[i].tag == views[0]) {
				setUpdater(handlers[i]);
				return;
			}
		}
	}
	setUpdater(handler_health);
}

function getUrlVars() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&#]*)/gi, function(m,key,value) {
		vars[key] = value;
	});
	return vars;
}

function setMenu()
{
	var nav = document.getElementsByTagName("nav")[0];
	nav.style.display = nms.menuShowing ? '' : 'none';
	nmsMap.forceResize();
}

function setOplog()
{
	if(nms._public == false)
		nms.oplog.mini.show(nms.oplogShowing)
}

function toggleMenu()
{
	nms.menuShowing = ! nms.menuShowing;
	setMenu();
	saveSettings();
}
function toggleOplog()
{
	nms.oplogShowing = ! nms.oplogShowing;
	setOplog();
	saveSettings();
}
function hideWindow(e,key)
{
	nmsInfoBox.hide();
}
function toggleHelp(e,key) {
	toggleLayer('aboutKeybindings');
}

function setMapModeFromN(e,key)
{
	switch(key) {
		case '1':
			setUpdater(handler_health);
			break;
		case '2':
			setUpdater(handler_uplinks);
			break;
		case '3':
			setUpdater(handler_dhcp);
			break;
		case '4':
			setUpdater(handler_ping);
			break;
		case '5':
			setUpdater(handler_temp);
			break;
		case '6':
			setUpdater(handler_traffic);
			break;
		case '7':
			setUpdater(handler_traffic_tot);
			break;
		case '8':
			setUpdater(handler_snmp);
			break;
		case '9':
			setUpdater(handler_cpu);
			break;
		case '0':
			setUpdater(handler_disco);
			break;
	}
	return true;
}

function moveTimeFromKey(e,key)
{
	switch(key) {
		case 'H':
			nmsTime.stepKey(-1440);
			break;
		case 'h':
			nmsTime.stepKey(-60);
			break;
		case 'j':
			nmsTime.stepKey(-5);
			break;
		case 'k':
			nmsTime.stepKey(5);
			break;
		case 'l':
			nmsTime.stepKey(60);
			break;
		case 'L':
			nmsTime.stepKey(1440);
			break;
		case 'p':
			nmsTime.togglePause();
			break;
		case 'r':
			nmsTime.realTime();
			break;
	}
	return true;
}

function keyPressed(e)
{
	if (e.target.nodeName == "INPUT" || e.target.nodeName == "TEXTAREA") {
		return false;
	}
	if(e.key) {
		var key = e.key;
	} else {
		var key = e.keyCode;
		switch(key) {
			case 187:
				key = '?';
				break;
			case 189:
				key = '-';
				break;
			case 27:
				key = 'Escape';
				break;
			default:
				key = String.fromCharCode(key);
				key = key.toLowerCase();
				break;
		}
	}
	if (nms.keyBindings[key])
		return nms.keyBindings[key](e,key);
	if (nms.keyBindings['default'])
		return nms.keyBindings['default'](e,key);
	return false;
}

function setupKeyhandler()
{
	var b = document.getElementsByTagName("body")[0];
	$( "body" ).keyup(function(e) {
		keyPressed(e);
	});
}


function getCookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i=0; i<ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ')
			c = c.substring(1);
		if (c.indexOf(name) == 0)
			return c.substring(name.length,c.length);
	}
	return "";
}

/*
 * Store relevant settings to a cookie.
 *
 * Also prints the value of the cookie on the console. This can then be
 * used as part of the URL instead.
 */
function saveSettings()
{
	var foo={};
	for ( var v in nms.settingsList ) {
		foo[ nms.settingsList[v] ] = nms[ nms.settingsList[v] ];
	}
	var string = btoa(JSON.stringify(foo));
	document.cookie = 'nms='+string;
	console.log("Add this to the URL to use these settings: nms="+string);
}

/*
 * Restore settings from a cookie or from the url, using the "GET
 * paramater" nms.
 * Url paramater overrides the cookie.
 */
function restoreSettings()
{
	try {
		var retrieve = JSON.parse(atob(getCookie("nms")));
	} catch(e) {
	}
	try {
		var retrieve2 = getUrlVars()['nms'];
		if (retrieve2 != "") {
			retrieve = JSON.parse(atob(retrieve2));

		}
	} catch (e) {
	}

	for (var v in retrieve) {
		nms[v] = retrieve[v];
	}
	setMenu();
	setOplog();
}

/*
 * Updates a simple legend-free graph, located on the navbar.
 *
 * The idea is to give a general "feeling" of the event. And that it's
 * neat.
 *
 * The timer-thing to bust a cache divides by 10 seconds, so updating more
 * than once every 10 seconds is pointless.
 */
function nmsUpdateNavbarGraph() {
	var img = document.getElementById("navbar-graph");
	var w = 200;

	img.src = "/render/?target=movingAverage(averageSeries(ping.*.*.ipv4),%225min%22)&target=secondYAxis(averageSeries(perSecond(snmp.*.*.ports.*.{ifHCInOctets,ifHCOutOctets})))&bgcolor=%23ffffff00&width=" + w + "&height=20&format=svg&from=-30min&until=now&graphOnly=true";
}
/*
 * Test if the entire path specified in the arrary "ar" exists under the
 * specified root.
 *
 * E.g.:
 * if (!testTree(nmsData,['snmp','snmp',sw,'misc'])) {
 * 	do stuff with nmsData.snmp.snmp[sw].misc
 * }
 *
 * New: setTree(root, array, default):
 * same thing, but instead of just returing true/false, return the value found
 * or the provided default.
 */
function setTree(root, ar, def) {
	if (ar == undefined || root == undefined) {
		return def;
	} else {
		for (var i in ar) {
			root = root[ar[i]];
			if (root == undefined)
				return def;
		}
	}
	return root;
}
function testTree(root, ar) {
	var x = setTree(root,ar,false);
	if (x != false)
		return true;
}

