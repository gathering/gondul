"use strict";

var nmsNightMode = nmsNightMode || {

}

var prefersColorSchemeMediaQuery = "(prefers-color-scheme: dark)";

nmsNightMode.toggle = function() {
	var active = window.matchMedia(prefersColorSchemeMediaQuery).matches;
	nms.nightMode = active;
}

nmsNightMode.init = function() {
	var preferColorScheme = window.matchMedia(prefersColorSchemeMediaQuery);
	preferColorScheme.addListener(() => nmsNightMode.toggle());
	nmsNightMode.toggle(); // trigger initial
}
