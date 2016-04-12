
/*
 * Some stolen colors that look OK.
 *
 * PS: Stolen from boostrap, because we use bootstrap and these look good
 * and match.
 */
var lightblue = "#d9edf7";
var lightgreen = "#dff0d8";
var lightred = "#f2dede";
var lightorange = "#fcf8e3";
var blue = "#337ab7";
var green = "#5cb85c";
var teal = "#5bc0de"; // Or whatever the hell that is
var orange = "#f0ad4e";
var red = "#d9534f";
var white = "#ffffff";

function gradient_from_latency(latency_ms, latency_secondary_ms)
{
	if (latency_ms == undefined)
		return blue;
	return getColorStop(parseInt(latency_ms) * 10);
}

/*
 * Return a random-ish color (for testing)
 */
function getRandomColor()
{
	var colors = [ "white", red, teal, orange, green, blue ];
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
function drawGradient(gradients)
{
	var ctx = nmsMap._c.hidden.ctx; // FIXME: Move it away...
	var gradient = ctx.createLinearGradient(0,0,1000,0);
	var stops = gradients.length - 1;
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
function getColorStop(x) {
	x = parseInt(x);
	if (x > 999)
		x = 999;
	if (x < 0)
		x = 0;
	return getColor(x,0);
}

/*
 * Get the color on the hidden canvas at a specific point. Could easily be
 * made generic.
 */
function getColor(x,y) {
	var ctx = nmsMap._c.hidden.ctx; // FIXME: Move it away...
	var imageData = ctx.getImageData(x, y, 1, 1);
	var data = imageData.data;
	if (data.length < 4)
		return false;
    return 'rgb(' + data[0] + ',' + data[1] + ',' + data[2] + ')';
}
