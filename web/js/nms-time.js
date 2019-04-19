"use strict";

/*
 * Deals with controlling time.
 *
 * More specifically: replaying of past events, fast forwarding, pausing,
 * etc.
 *
 * The interface is a bit bloated at the moment, though.
 */
var nmsTime = nmsTime || {
	_now: undefined,
	_handle: undefined,
	_stopTime: undefined
}

nmsTime.replayEvent = function() {
	var eStart = setTree(nmsData,["config","config","data","start"],"2018-03-23T00:00:00+0200");
	nmsTime._stopTime = new Date(setTree(nmsData,["config","config","data","end"],"2018-04-01T14:30:00+0200"));
	nmsTime.setNow(eStart);
	nmsTime.startPlayback(60);
}

nmsTime.isRealTime = function() {
	if (nmsTime._now == undefined && nmsTime._handle == undefined)
		return true;
	return false;
}

nmsTime.startNowPicker = function () {
	$.datetimepicker.setLocale('no');
	$('#nowPicker').datetimepicker('destroy');
	var now;
	if (nmsTime._now == undefined)
		now = new Date();
	else
		now = nmsTime._now;
	now.setSeconds(0);
	now.setMilliseconds(0);
	var datepicker = $('#nowPicker').datetimepicker({
		value: now,
		step: 1,
		mask:false,
		inline:true,
		todayButton: true,
		validateOnBlur:false,
		dayOfWeekStart:1,
		maxDate:'+1970/01/01',
		onSelectDate: function(ct,$i){
			document.getElementById('nowPicker').dataset.iso = new Date(ct.valueOf());
		},
		onSelectTime: function(ct,$i){
			document.getElementById('nowPicker').dataset.iso = new Date(ct.valueOf());
		},
		onGenerate: function(ct,$i){
			document.getElementById('nowPicker').dataset.iso = new Date(ct.valueOf());
		}
	});
}

nmsTime.setNow = function(now) {
	var newDate = new Date(now);
	newDate.setSeconds(0);
	newDate.setMilliseconds(0);
	newDate.setMinutes(newDate.getMinutes() - newDate.getMinutes()%1);
	nmsTime._now = newDate;
	nmsTime._updateData();
}

nmsTime._updateData = function() {
	nmsData.now = nmsTime._now.getTime() / 1000;
}

nmsTime.realTime = function() {
	nmsTime.stopPlayback();
	nmsTime._now = undefined;
	nmsData.now = undefined;
}

/*
 * Step a fixed amount of time, measured in minutes.
 *
 * Try to align this to whole 5 minutes. It will be enforced in future
 * backend versions to avoid bloating the cache and thus also stressing the
 * database
 */
nmsTime.step = function(amount) {
	if (nmsTime._now == null)
		throw "Stepping without nmsTime._now";
	if (amount == 0 || amount == undefined)
		throw "Invalid step";
	if (nmsTime._now.getTime() + (amount * 1000 * 60 ) > Date.now()) {
		nmsTime.realTime();
		return;
	}
	if (nmsTime._stopTime != undefined && nmsTime._now.getTime() >= nmsTime._stopTime.getTime()) {
		nmsTime.stopPlayback();
		nmsTime._stopTime = undefined;
	}
	nmsTime._now.setMinutes(nmsTime._now.getMinutes() + amount);
	nmsTime._updateData();
}

/*
 * Step based on key-press. Same as step() but stops playback if it's
 * active and allows you to rewind from a "live" map.
 */
nmsTime.stepKey = function(amount) {
	nmsTime.stopPlayback();
	if (nmsTime._now == undefined) {
		nmsTime.setNow(Date.now());
	}
	nmsTime.step(amount);
}

/*
 * Target of setInterval() when replaying.
 */
nmsTime._tick = function() {
	nmsTime.step(nmsTime._speed);
}

/*
 * We now have a time (presumably), start playback.
 *
 * Aborts if the time provided is greater than real time.
 *
 * Gondul does not _yet_ support fast forwarding into the future.
 */
nmsTime.startPlayback = function(speed) {
	if (nmsTime._handle)
		nmsTime.stopPlayback();
	if (nmsTime._now.getTime() > Date.now()) {
		nmsTime.stopPlayback();
		return;
	}
	nmsTime._speed = speed;
	nmsTime._handle = setInterval(nmsTime._tick,2000);
}

nmsTime.togglePause = function() {
	if (nmsTime._handle) {
		nmsTime.stopPlayback();
	} else {
		if (nmsTime.isRealTime()) {
			nmsTime.setNow(Date.now());
		} else {
			nmsTime.startPlayback(nmsTime._speed ? nmsTime._speed : 60);
		}
	}
}

nmsTime.stopPlayback = function() {
	if (nmsTime._handle)
		clearInterval(nmsTime._handle);
	nmsTime._handle = undefined;
}
	
