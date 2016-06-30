"use strict";

/*
 * This file/module/whatever is an attempt to gather all data collection in
 * one place.
 *
 * The basic idea is to have all periodic data updates unified here, with
 * stats, tracking of "ajax overflows" and general-purpose error handling
 * and callbacks and whatnot, instead of all the custom stuff that we
 * started out with.
 *
 * Sources are identified by a name, which is then available in
 * nmsData[name] in full. A copy of the previous data set is kept in
 * nmsData.old[name]. You can use getNow / setNow() to append a 'now='
 * string.
 *
 * nmsData[name] - actual data
 * nmsData.old[name] - previous copy of data
 * nmsData.registerSource() - add a source, will be polled periodicall
 * nmsData.addHandler()
 * nmsData.updateSource() - issue a one-off update, outside of whatever
 * 			    periodic polling might take place
 * nmsData.invalidate() - Invalidate browser-cache.
 */


var nmsData = nmsData || {
	old: {}, // Single copy of previous data. Automatically populated.
	stats: {
		identicalFetches:0,
		outstandingAjaxRequests:0,
		ajaxOverflow:0,
		pollClearsEmpty:0,
		pollClears:0,
		pollSets:0,
		newSource:0,
		oldSource:0
	},
	_pulseBeat: 0,
	/*
	 * The last time stamp of any data received, regardless of source.
	 *
	 * Used as a fallback for blank now, but can also be used to check
	 * "freshness", I suppose.
	 */
	_last: undefined,
	_now: undefined,

	/*
	 * These are provided so we can introduce error checking when we
	 * have time.
	 * 
	 * now() represents the data, not the intent. That means that if
	 * you want to check if we are traveling in time you should not
	 * check nmsData.now. That will always return a value as long as
	 * we've had a single piece of data.
	 */
	get now() { return this._now || this._last; },
	set now(val) {
		if (val == undefined || !val) {
			nmsData._now = undefined;
		} else {
			// FIXME: Check if now is valid syntax.
			nmsData._now = val;
		}
	},
	/*
	 * List of sources, name, handler, etc
	 */
	_sources: {},

	/*
	 * Maximum number of AJAX requests in transit before we start
	 * skipping updates.
	 *
	 * A problem right now is that it will typically always hit the
	 * same thing since everything starts at the same time...
	 */
	_ajaxThreshold: 10
};


nmsData._dropData = function (name) {
	delete this[name];
	delete this.old[name];
};

nmsData.removeSource = function (name) {
	if (this._sources[name] == undefined) {
		this.stats.pollClearsEmpty++;
		return true;
	}
	if (this._sources[name]['handle']) {
		this.stats.pollClears++;
		clearInterval(this._sources[name]['handle']);
	}
	delete this._sources[name];
};

/*
 * Register a source.
 *
 * name: "Local" name. Maps to nmsData[name]
 * target: URL of the source
 *
 * This can be called multiple times to add multiple handlers. There's no
 * guarantee that they will be run in order, but right now they do.
 *
 * Update frequency _might_ be adaptive eventually, but since we only
 * execute callbacks on change and backend sends cache headers, the browser
 * will not issue actual HTTP requests.
 *
 * FIXME: Should be unified with nmsTimers() somehow.
 */
nmsData.registerSource = function(name, target) {
	if (this._sources[name] == undefined) {
		this._sources[name] = { target: target, cbs: {}, fresh: true };
		this._sources[name]['handle'] = setInterval(function(){nmsData.updateSource(name)}, 1000);
		this.stats.newSource++;
	} else {
		this.stats.oldSource++;
	}
	this.stats.pollSets++;
};

/*
 * Show sign-of-life to the user.
 *
 * Now that we don't show the date field constantly it is nice to indicate
 * to the user that things are still running in some discreet manner.
 *
 * The actual html might not be the best choice, but I think the general
 * idea of some sort of heartbeat is needed.
 */
nmsData._pulse = function() {
	if (nmsData._pulseElement == undefined) {
		try {
			nmsData._pulseElement = document.getElementById("heartbeat");
		} catch(e) {
			nmsData._pulseElement = null;
		}
	}
	if (nmsData._pulseElement == null)
		return;
	if (nmsData._pulseBeat > 20) {
		if (nmsData._pulseElement.classList.contains("pulse-on")) {
			nmsData._pulseElement.classList.remove("pulse-on");
		} else {
			nmsData._pulseElement.classList.add("pulse-on");
		}
		nmsData._pulseBeat = 0;
	}
	nmsData._pulseBeat++;
}
/*
 * Add a handler (callback) for a source, using an id.
 *
 * This is idempotent: if the id is the same, it will just overwrite the
 * old id, not add a copy.
 */
nmsData.addHandler = function(name, id, cb, cbdata) {
	var cbob = {
		id: id,
		name: name,
		cb: cb,
		fresh: true,
		cbdata: cbdata
	};
	if (id == undefined) {
		return;
	}
	this._sources[name].cbs[id] = cbob;
	this.updateSource(name);
};

/*
 * Unregister all handlers with the "id" for all sources.
 *
 * Mainly used to avoid fini() functions in the map handlers. E.g.: just
 * reuse "mapHandler" as id.
 */
nmsData.unregisterHandlerWildcard = function(id) {
	for (var v in nmsData._sources) {
		this.unregisterHandler(v, id);
	}
};

nmsData.unregisterHandler = function(name, id) {
	delete this._sources[name].cbs[id];
};

/*
 * Updates a source.
 *
 * Called on interval, but can also be used to update a source after a
 * known action that updates the underlying data (e.g: update comments
 * after a comment is posted).
 */
nmsData.updateSource = function(name) {
	/*
	 * See comment in nms.js nmsINIT();
	 */
	if (name == "ticker" ) {
		for (var i in nmsData._sources[name].cbs) {
			var tmp = nmsData._sources[name].cbs[i];
			if (tmp.cb != undefined) {
				tmp.cb(tmp.cbdata);
			}
		}
		return;
	}
	this._genericUpdater(name, true);
};

nmsData.invalidate = function(name) {
	this._genericUpdater(name, false);
};
/*
 * Reset a source, deleting all data, including old.
 *
 * Useful if traveling in time, for example.
 */
nmsData.resetSource = function(name) {
	this[name] = {};
	this.old[name] = {};
	this.updateSource(name);
};

/*
 * Updates nmsData[name] and nmsData.old[name], issuing any callbacks where
 * relevant.
 *
 * Do not use this directly. Use updateSource().
 *
 */
nmsData._genericUpdater = function(name, cacheok) {
	if (this.stats.outstandingAjaxRequests++ > this._ajaxThreshold) {
		this.stats.outstandingAjaxRequests--;
		this.stats.ajaxOverflow++;
		return;
	}
	var now = "";
	if (this._now != undefined)
		now = "now=" + this._now;
	if (now != "") {
		if (this._sources[name].target.match("\\?"))
			now = "&" + now;
		else
			now = "?" + now;
	}
	var heads = {};
	if (cacheok == false) {
		heads['Cache-Control'] = "max-age=0, no-cache, stale-while-revalidate=0";
	}

	/*
	 * Note that we intentionally set dataType: "text" here.
	 *
	 * We can be smarter than jQuery here. We know that the ETag can be
	 * used to evaluate against our cached copy. If the ETag is a
	 * match, we never have to do the potentially extensive JSON
	 * parsing.
	 *
	 * Also note that we accept weakened ETags too (ETags with W/
	 * prefixed). This is typically if the intermediate cache has
	 * compressed the content for us, so this is fine.
	 *
	 * This is particularly important because we poll everything even
	 * though we _know_ it will hit both browser cache and most likely
	 * Varnish. JSON.Parse was one of the biggest CPU hogs before this.
	 */
	$.ajax({
		type: "GET",
		headers: heads,
		url: this._sources[name].target + now,
		dataType: "text",
		success: function (indata, textStatus, jqXHR) {
			var etag = jqXHR.getResponseHeader("ETag");
			if (nmsData[name] == undefined ||  (nmsData[name]['hash'] != etag && nmsData[name]['hash'] != etag.slice(2))) {
				var data = JSON.parse(indata);
				if (name == "ping") {
					nmsData._last = data['time'];
					nmsMap.drawNow();
				}
				nmsData.old[name] = nmsData[name];
				nmsData[name] = data;
				for (var i in nmsData._sources[name].cbs) {
					var tmp2 = nmsData._sources[name].cbs[i];
					if (tmp2.cb != undefined) {
						tmp2.cb(tmp2.cbdata);
					}
				}
			} else {
				for (var j in nmsData._sources[name].cbs) {
					var tmp = nmsData._sources[name].cbs[j];
					if (tmp.cb != undefined && tmp.fresh) {
						nmsData._sources[name].cbs[j].fresh = false;
						tmp.cb(tmp.cbdata);
					}
				}
				nmsData.stats.identicalFetches++;
			}
			nmsData._pulse();
		},
		complete: function(jqXHR, textStatus) {
			nmsData.stats.outstandingAjaxRequests--;
		}
	});
};
