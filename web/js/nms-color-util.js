"use strict";
/*
 * Some stolen colors that look OK.
 *
 * PS: Stolen from boostrap, because we use bootstrap and these look good
 * and match.
 */

var nmsColor = nmsColor || {
	_cache: [],
	lightblue: "#d9edf7",
	lightgreen: "#dff0d8",
	lightred: "#f2dede",
	lightorange: "#fcf8e3",
	blue: "#337ab7",
	green: "#5cb85c",
	teal: "#5bc0de",
	orange: "#f0ad4e",
	red: "#d9534f",
	white: "#ffffff"
}

/*
 * Return a random-ish color (for testing)
 */
nmsColor.random = function()
{
	var colors = [ "white", nmsColor.red, nmsColor.teal, nmsColor.orange, nmsColor.green, nmsColor.blue ];
	var i = Math.round(Math.random() * (colors.length-1));
	return colors[i];	
}

/*
 * Set up the hidden gradient canvas, using an array as input.
 * 
 * This gives us a flexible way to get gradients between any number of
 * colors (green to red, or blue to green to orange to red to white to pink
 * to black and so on).
 *
 * Typically called when setting up a map handler. Currently "single
 * tenant", since there's just one canvas.
 *
 * XXX: We have to store the gradients in nms.* and restore this when we
 * resize for the moment, because this canvas is also re-sized (which isn't
 * really necessary, but avoids special handling).
 */
nmsColor.drawGradient = function(gradients) {
	var ctx = nmsMap._c.hidden.ctx; // FIXME: Move it away...
	var gradient = ctx.createLinearGradient(0,0,1000,0);
	var stops = gradients.length - 1;
	nmsColor._cache = [];
	nms.gradients = gradients;
	for (var color in gradients) {
		var i = color / stops;
		gradient.addColorStop(i, gradients[color]);
	}
	ctx.beginPath();
	ctx.strokeStyle = gradient;
	ctx.moveTo(0,0);
	ctx.lineTo(1000,0);
	ctx.lineWidth = 10;
	ctx.closePath();
	ctx.stroke();
	ctx.moveTo(0,0);
}

/*
 * Get the color of a gradient, range is from 0 to 999 (inclusive).
 */
nmsColor.getColorStop = function(x) {
	x = parseInt(x);
	if (isNaN(x))
		x = 0;
	if (x > 999)
		x = 999;
	if (x < 0)
		x = 0;
	return nmsColor._getColor(x,0);
}

/*
 * Get the color on the hidden canvas at a specific point. Could easily be
 * made generic.
 */
nmsColor._getColor = function(x,y) {
	if (nmsColor._cache[x] != undefined)
		return nmsColor._cache[x];
	var ctx = nmsMap._c.hidden.ctx; // FIXME: Move it away...
	try {
		var imageData = ctx.getImageData(x, y, 1, 1);
	} catch(e) {
		console.log("x: " + x);
		console.log(e);
	}
	var data = imageData.data;
	if (data.length < 4)
		return false;
	nmsColor._cache[x] = 'rgb(' + data[0] + ',' + data[1] + ',' + data[2] + ')';
	return nmsColor._cache[x];
}
