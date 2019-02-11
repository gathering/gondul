"use strict";

/* WORK
 * IN
 * PROGRESS
 *
 * Interface:
 *
 * nmsMap.init() - start things up
 * nmsMap.setSwitchColor(switch,color)
 * nmsMap.setSwitchInfo(switch,info)
 * nmsMap.setSwitchHighlight(switch,true/false)
 * nmsMap.enableHighlights()
 * nmsMap.disableHighlights()
 */


var nmsMap = nmsMap || {
	_moveInProgress: false,
	stats: {
		colorChange:0,
		colorSame:0,
		earlyDrawAll:0,
		nowDups:0,
		nows:0,
		resizeEvents:0,
		switchInfoSame:0,
		switchInfoUpdate:0,
		highlightChange:0,
		textSwitchDraws:0,
		textInfoDraws:0,
		textInfoClears:0
	},
	contexts: ["bg","link","blur","switch","text","textInfo","top","input","hidden"],
	_info: {},
	_settings: {
		fontLineFactor: 2,
		textMargin: 4,
		xMargin: 10,
		yMargin: 20,
		fontSize: 14,
		fontFace: "sans-serif"
	},
	scale: 1,
	_init: true,
	_orig: { width:1920, height:1032 },
	_canvas: {
		get width() { return nmsMap.scale * nmsMap._orig.width; },
		get height() { return nmsMap.scale * nmsMap._orig.height; }
	},

	_color: { },
	_linknets: {} ,
	_highlight: { },
	_highlightActive: false,
	_c: {},
	_lastName: {},
	_lastInfo: {}
};

nmsMap._loadEvent = function(e) {
	nmsMap._init = false;
	nmsMap._drawAllSwitches();
};

nmsMap.init = function() {
	this._initContexts();
	this._init = true;
	nmsData.addHandler("switches","nmsMap",function(){nmsMap._resizeEvent();});
	window.addEventListener('resize',nmsMap._resizeEvent,true);
	window.addEventListener('load',nmsMap._loadEvent,true);
};

nmsMap.setSwitchColor = function(sw, color) {
	if (this._color[sw] != color) {
		this._color[sw] = color;
		this._drawSwitch(sw);
		this.stats.colorChange++;
	} else {
		this.stats.colorSame++;
	}
};


nmsMap.setSwitchHighlight = function(sw, highlight) {
    if( highlight )
        highlight = true;
    if ( this._highlight[sw] != highlight ) {
        this.stats.highlightChange++;
        this._highlight[sw] = highlight;
    }
    this._drawSwitch(sw);
};


nmsMap.enableHighlights = function() {
    this._highlightActive = true;
};


nmsMap.disableHighlights = function() {
    this._highlightActive = false;
    this._drawAllSwitches();
};


nmsMap.reset = function() {
	for (var sw in this._color) {
		nmsMap.setSwitchColor(sw, undefined);
	}
	for (var sw in this._info) {
		nmsMap.setSwitchInfo(sw, undefined);
	}
};

nmsMap.setSwitchInfo = function(sw,info) {
	if (info != undefined) {
		var textl = info.length;
		if (textl > 15)
			info = info.slice(0,15);
	}
	if (this._info[sw] != info) {
		this._info[sw] = info;
		this._drawSwitchInfo(sw);
		this.stats.switchInfoUpdate++;
	} else {
		this.stats.switchInfoSame++;
	}
};

nmsMap._initContext = function(name) {
	this._c[name] = {};
	this._c[name].c = document.getElementById(name + "Canvas");
	this._c[name].ctx = this._c[name].c.getContext('2d');
};

nmsMap._initContexts = function() {
	for (var context in this.contexts) {
		this._initContext(this.contexts[context]);
	}
};

/*
 * Used to force a resize if a regular event isn't sent. Typically if the
 * window itself isn't resized, but available space for the map is still
 * changed. Example: The menu is toggled. So far this is the same as
 * _resizeEvent, but there is no guarantee that will stay true.
 */
nmsMap.forceResize = function() {
	if (this._init == true) {
		return;
	}
	nmsMap._resizeEvent();
}


nmsMap._resizeEvent = function() {
	var width = window.innerWidth - nmsMap._c.bg.c.offsetLeft;
	var height = window.innerHeight - nmsMap._c.bg.c.offsetTop;

	var xScale = (width / (nmsMap._orig.width + nmsMap._settings.xMargin));
	var yScale = (height / (nmsMap._orig.height + nmsMap._settings.yMargin));

	/*
	 * We need to forget this. Because the rescale will blank the text
	 * anyway it is safe to set it to undefined here. This is a special
	 * case, if you set it to 'undefined' anywhere else to "reset" or
	 * force a redraw of the text you will introduce a bug if a handler
	 * then tries to _unset_ the text (which you do by setting the text
	 * to undefined)
	 */
	nmsMap._lastName = {};
	nmsMap._lastInfo = {};
	if (xScale > yScale) {
		nmsMap.scale = yScale;	
	} else {
		nmsMap.scale = xScale;
	}
	for (var a in nmsMap._c) {
		/*
		 * Resizing this to a too small size breaks gradients on smaller screens.
		 */
		if (a == 'hidden' && a != 'blur')
			continue;
		nmsMap._c[a].c.height = nmsMap._canvas.height;
		nmsMap._c[a].c.width = nmsMap._canvas.width;
		if(a == 'bg') {
			nmsMap._drawBG();
		}
	}
	if (nmsMap._init != true) {
		nmsMap._blurDrawn = false;
		nmsMap._drawBG();
		nmsMap._drawAllSwitches();
		nmsMap._drawAllLinknets();
		nmsMap.drawNow();
		nmsMap.stats.resizeEvents++;
	}
};

/*
 * Draw current time-window
 *
 * FIXME: The math here is just wild approximation and guesswork because
 * I'm lazy.
 *
 * FIXME: 2: Should really just use _drawText() instead somehow. Font size
 * being an issue.
 *
 * FIXME 3: Currently assuming that time from api is UTC and converting to
 * local time zone with js. Should find a more robust solution.
 *
 */
nmsMap.drawNow = function ()
{
	var now = nmsData.now;
	var ctx = nmsMap._c.top.ctx;
	if (nmsTime.isRealTime()) {
		if (!nmsMap._nowCleared) {
			ctx.save();
			ctx.scale(this.scale, this.scale);
			ctx.clearRect(0,0,800,100);
			ctx.restore();
			nmsMap._nowCleared = true;
			nmsMap._lastNow = undefined;
		}
		return true;
	}
	nmsMap._nowCleared = false;
	if(String(now).indexOf('T') == -1) { //If now does not contain 'T' we assume its in epoch format
		now = new Date(nmsData.now * 1000);
	} else {
		now = new Date(nmsData.now); //Date assumes UTC
	}
	now = now.toString().split(' ').splice(0,5).join(' '); //Date returns local time
	if (nmsMap._lastNow == now) {
		nmsMap.stats.nowDups++;
		return;
	}
	nmsMap.stats.nows++;

	ctx.save();
	ctx.scale(this.scale, this.scale);
	ctx.font = (2 * this._settings.fontSize) + "px " + this._settings.fontFace;
	ctx.clearRect(0,0,800,100);
	ctx.fillStyle = "white";
	ctx.strokeStyle = "black";
	ctx.translate(200,0);
	ctx.lineWidth = nms.fontLineFactor;
	ctx.strokeText(now, this._settings.textMargin, 25);
	ctx.fillText(now, this._settings.textMargin, 25);
	ctx.restore();
};

nmsMap.setNightMode = function(toggle) {
	if (this._nightmode == toggle)
		return;
	this._nightmode = toggle;
	if (this._init == true) {
		return;
	}
	if (!toggle)
		this._c.blur.c.style.display = "none";
	else {
		this._drawAllBlur();
		this._c.blur.c.style.display = "";
	}
	nmsMap._drawBG();
};

nmsMap._drawBG = function() {
	var imageObj = document.getElementById('source');
	this._c.bg.ctx.drawImage(imageObj, 0, 0, nmsMap._canvas.width, nmsMap._canvas.height);
	if(this._nightmode)
		nmsMap._invertBG();
};

nmsMap._invertBG = function() {
	var imageData = this._c.bg.ctx.getImageData(0, 0, nmsMap._canvas.width, nmsMap._canvas.height);
	var data = imageData.data;

	for(var i = 0; i < data.length; i += 4) {
		data[i] = 255 - data[i];
		data[i + 1] = 255 - data[i + 1];
		data[i + 2] = 255 - data[i + 2];
	}
	this._c.bg.ctx.putImageData(imageData, 0, 0);
};

nmsMap._getBox = function(sw) {
	var box = nmsData.switches.switches[sw]['placement'];
	box.x = parseInt(box.x);
	box.y = parseInt(box.y);
	box.width = parseInt(box.width);
	box.height = parseInt(box.height);
	return box;
};

nmsMap._drawSwitchBlur = function(sw)
{
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined)
		return;
	var box = this._getBox(sw);
	this._c.blur.ctx.save();
	this._c.blur.ctx.fillStyle = "red";
	this._c.blur.ctx.shadowBlur = 30;
	this._c.blur.ctx.shadowColor = "white";
	this._c.blur.ctx.scale(this.scale, this.scale); // FIXME <- fix what?!
	this._c.blur.ctx.fillRect(box['x'],box['y'],box['width'],box['height']);
	this._c.blur.ctx.restore();
};

nmsMap._drawSwitch = function(sw)
{
	// XXX: If a handler sets a color before switches are loaded... The
	// color will get set fine so this isn't a problem.
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined)
		return;
	var box = this._getBox(sw);
	var color = nmsMap._color[sw];
	if(this._highlightActive) {
		if(nmsMap._highlight[sw]) {
			color = nmsColor.green;
		} else {
			color = nmsColor.white;
		}
	}
	if (color == undefined) {
		color = nmsColor.blue;
	}
	this._c.switch.ctx.fillStyle = color;
	this._drawBox(this._c.switch.ctx, box['x'],box['y'],box['width'],box['height']);
	this._c.switch.ctx.shadowBlur = 0;
	var switchtext = sw;
	var textl = switchtext.length;
	if (textl > 12)
		switchtext = switchtext.slice(0,7) + ".." + switchtext.slice(textl-2,textl);

	if (this._lastName[sw] != switchtext) {
		nmsMap.stats.textSwitchDraws++;
		this._drawText(this._c.text.ctx, switchtext,box);
		this._lastName[sw] = switchtext;
	}

	if(this._info[sw])
		this._drawSwitchInfo(sw);
};

nmsMap._drawSwitchInfo = function(sw) {
	var box = this._getBox(sw);
	if (this._lastInfo[sw] == this._info[sw])
		return;
	this._clearBox(this._c.textInfo.ctx, box, 3);
	nmsMap.stats.textInfoClears++;
	if (this._info[sw] != undefined) {
		this._drawText(this._c.textInfo.ctx, this._info[sw], box, "right");
		nmsMap.stats.textInfoDraws++;
	}
	this._lastInfo[sw] = this._info[sw];
};

nmsMap._clearBox = function(ctx,box,margin) {
	if (margin == undefined)
		margin = 0;
	ctx.save();
	margin = Math.floor(margin * this.scale );
	ctx.scale(this.scale,this.scale);
	ctx.clearRect(box['x'] - margin, box['y'] - margin, box['width'] + margin*2, box['height'] + margin*2);
	ctx.restore();
};

nmsMap._drawText = function(ctx, text, box, align) {
	var rotate = false;

	if ((box['width'] + 10 )< box['height'])
		rotate = true;

	this._clearBox(ctx,box, 1);
	ctx.save();
	ctx.scale(this.scale, this.scale);
	ctx.font = "bold " + this._settings.fontSize + "px " + this._settings.fontFace;
	ctx.lineWidth = nmsMap._settings.fontLineFactor;
	ctx.fillStyle = "white";
	ctx.strokeStyle = "black";
	ctx.translate(box.x + this._settings.textMargin, box.y + box.height - this._settings.textMargin);

	if (rotate) {
		ctx.translate(box.width - this._settings.textMargin * 2,0);
		ctx.rotate(Math.PI * 3/2);
	}

	if (align == "right") {
		ctx.textAlign = "right";
		/*
		 * Margin*2 is to compensate for the margin above.
		 */
		if (rotate)
			ctx.translate(box.height - this._settings.textMargin*2,0);
		else
			ctx.translate(box.width - this._settings.textMargin*2,0);
	}

	ctx.strokeText(text, 0, 0);
	ctx.fillText(text, 0, 0);
	ctx.restore();
};

nmsMap._setLinknetColor = function(l, color1, color2)
{
	var oldcolor1;
	var oldcolor2;
	try {
		oldcolor1 = nmsMap._linknets[l].sysname1;
		oldcolor2 = nmsMap._linknets[l].sysname2;
		if (oldcolor1 == color1 && oldcolor2 == color2) {
			return ;
		}
	} catch (e) {}
	nmsMap._linknets[l] = {};
	nmsMap._linknets[l].sysname1 = color1;
	nmsMap._linknets[l].sysname2 = color2;
	nmsMap._drawLinknet(l)
}

nmsMap._drawLinknet = function(l) {
	try {
		var color1 = nmsColor.blue;
		var color2 = nmsColor.blue;
		try {
			color1 = nmsMap._linknets[l].sysname1;
			color2 = nmsMap._linknets[l].sysname2;
		} catch(e) { }
		nmsMap._connectSwitches(nmsData.switches.linknets[l].sysname1, nmsData.switches.linknets[l].sysname2, color1, color2);
	} catch(e) { }
}

nmsMap._drawAllLinknets = function() {
	for (var l in nmsData.switches.linknets) {
		nmsMap._drawLinknet(l);
	}
}
nmsMap._drawAllSwitches = function() {
	if (nmsData.switches == undefined) {
		this.stats.earlyDrawAll++;
		return;
	}
	for (var sw in nmsData.switches.switches) {
		this._drawSwitch(sw);
	}
	if (this._nightmode)
		this._drawAllBlur();
};

nmsMap._drawAllBlur = function() {
	if (nmsMap._blurDrawn == true)
		return;
	nmsMap._blurDrawn = true;
	for (var sw in nmsData.switches.switches) {
		nmsMap._drawSwitchBlur(sw);
	}
};

nmsMap._drawBox = function(ctx, x, y, boxw, boxh) {
	ctx.save();
	ctx.scale(this.scale, this.scale); // FIXME <- what?!
	ctx.fillRect(x,y, boxw, boxh);
	ctx.lineWidth = 1;
	ctx.strokeStyle = "#000000";
	ctx.strokeRect(x,y, boxw, boxh);
	ctx.restore();
};

nmsMap._connectSwitches = function(sw1, sw2, color1, color2) {
	nmsMap._connectBoxes(nmsMap._getBox(sw1), nmsMap._getBox(sw2),
			     color1, color2);
};

/*
 * Draw a line between two boxes, with a gradient going from color1 to
 * color2.
 */
nmsMap._connectBoxes = function(box1, box2,color1, color2) {
	var ctx = nmsMap._c.link.ctx;
	if (color1 == undefined)
		color1 = nmsColor.blue;
	if (color2 == undefined)
		color2 = nmsColor.blue;
	var x0 = Math.floor(box1.x + box1.width/2);
	var y0 = Math.floor(box1.y + box1.height/2);
	var x1 = Math.floor(box2.x + box2.width/2);
	var y1 = Math.floor(box2.y + box2.height/2);
	ctx.save();
	ctx.scale(nmsMap.scale, nmsMap.scale);
	var gradient = ctx.createLinearGradient(x1,y1,x0,y0);
	gradient.addColorStop(0, color1);
	gradient.addColorStop(1, color2);
	ctx.strokeStyle = gradient;
	ctx.beginPath();
	ctx.moveTo(x0,y0);
	ctx.lineTo(x1,y1); 
	ctx.lineWidth = 5;
	ctx.stroke();
	ctx.closePath();
	ctx.restore();
};

nmsMap.moveSet = function(toggle) {
	nmsMap._moveInProgress = toggle;
	if (!toggle)
		nmsMap._moveStopListen();
};

/*
 * onclick handler for the canvas.
 *
 * Currently just shows info for a switch.
 */
nmsMap.canvasClick = function(e)
{
	var sw = findSwitch(e.pageX - e.target.offsetLeft, e.pageY - e.target.offsetTop);
	if (sw != undefined) {
		if (nmsMap._moveInProgress) {
			nmsMap._moveStart(sw, e);
		} else {
			nmsInfoBox.click(sw);
		}
	} else {
		nmsInfoBox.hide();
	}
};

nmsMap._clearOld = function(box) {
	if (box) {
		nmsMap._c.top.ctx.save();
		nmsMap._c.top.ctx.fillStyle = "#000000";
		nmsMap._c.top.ctx.scale(nmsMap.scale, nmsMap.scale); // FIXME
		nmsMap._c.top.ctx.clearRect(box['x'] - 5, box['y'] - 5, box['width'] + 10, box['height'] + 10);
		nmsMap._c.top.ctx.restore();
	}
};

nmsMap._moveMove = function(e) {
	nmsMap._moveX = (e.pageX - e.target.offsetLeft) / nmsMap.scale;
	nmsMap._moveY = (e.pageY - e.target.offsetTop) / nmsMap.scale;
	var diffx = nmsMap._moveX - nmsMap._moveXstart;
	var diffy = nmsMap._moveY - nmsMap._moveYstart;
	var box = {};
	nmsMap._clearOld(nmsMap._moveOldBox);
	box['x'] = nmsMap._moveBox['x'] + diffx;
	box['y'] = nmsMap._moveBox['y'] + diffy;
	box['height'] = nmsMap._moveBox['height'];
	box['width'] = nmsMap._moveBox['width'];
	nmsMap._moveOldBox = box;
	nmsMap._c.top.ctx.save();
	nmsMap._c.top.ctx.fillStyle = "red";
	nmsMap._drawBox(nmsMap._c.top.ctx, box['x'], box['y'], box['width'], box['height']);
	nmsMap._c.top.ctx.restore();
};

nmsMap._moveSubmit = function() {
	var data = {
		sysname: nmsMap._moving,
		placement: nmsMap._moveOldBox
	};
	var myData = JSON.stringify([data]);
	$.ajax({
		type: "POST",
		url: "/api/write/switches",
		dataType: "text",
		data:myData,
		success: function (data, textStatus, jqXHR) {
			nmsData.invalidate("switches");
		}
	});
};

nmsMap._moveStopListen = function() {
	nmsMap._c.input.c.removeEventListener('mousemove',nmsMap._moveMove, true);
	nmsMap._c.input.c.removeEventListener('mouseup',nmsMap._moveDone, true);
};

nmsMap._moveDone = function(e) {
	nmsMap._moveStopListen();
	if(nmsMap._moveOldBox == false) {
		return;
	}
	nmsMap._moveSubmit();
	nmsMap._clearOld(nmsMap._moveOldBox);
};

nmsMap._moveStart = function(sw, e)
{
	nmsMap._moving = sw;
	nmsMap._moveOldBox = false;
	nmsMap._moveXstart = (e.pageX - e.target.offsetLeft) / nmsMap.scale;
	nmsMap._moveYstart = (e.pageY - e.target.offsetTop) / nmsMap.scale;
	nmsMap._moveBox = nmsData.switches.switches[sw].placement;
	nmsMap._c.input.c.addEventListener('mousemove',nmsMap._moveMove,true);
	nmsMap._c.input.c.addEventListener('mouseup',nmsMap._moveDone,true);
};


/*
 * STUFF NOT YET INTEGRATED, BUT MOVED AWAY FROM nms.js TO TIDY.
 *
 * Consider this a TODO list.
 */

/*
 * Draw a linknet with index i.
 *
 * XXX: Might have to change the index here to match backend
 */
function drawLinknet(i)
{
	var c1 = nms.linknet_color[i] && nms.linknet_color[i].c1 ? nms.linknet_color[i].c1 : blue;
	var c2 = nms.linknet_color[i] && nms.linknet_color[i].c2 ? nms.linknet_color[i].c2 : blue;
	if (nmsData.switches.switches[nmsData.switches.linknets[i].sysname1] && nmsData.switches.switches[nmsData.switches.linknets[i].sysname2]) {
		connectSwitches(nmsData.switches.linknets[i].sysname1,nmsData.switches.linknets[i].sysname2, c1, c2);
	}
}

/*
 * Draw all linknets
 */
function drawLinknets()
{
	if (nmsData.switches && nmsData.switches.linknets) {
		for (var i in nmsData.switches.linknets) {
			drawLinknet(i);
		}
	}
}

/*
 * Change both colors of a linknet.
 *
 * XXX: Probably have to change this to better match the backend data
 */
function setLinknetColors(i,c1,c2)
{
	if (!nms.linknet_color[i] || 
 	     nms.linknet_color[i].c1 != c1 ||
	     nms.linknet_color[i].c2 != c2) {
		if (!nms.linknet_color[i])
			nms.linknet_color[i] = {};
		nms.linknet_color[i]['c1'] = c1;
		nms.linknet_color[i]['c2'] = c2;
		drawLinknet(i);
	}
}


