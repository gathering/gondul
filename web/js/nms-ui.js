"use strict";


/*
 * The idea is to gradually move pure UI stuff into nmsUi.
 */
var nmsUi = nmsUi || {
	_active: "map"
};

nmsUi.setActive = function(pane) {
	var old = document.getElementById(nmsUi._active);
	var newp = document.getElementById(pane);
	old.style.display = "none";
	newp.style.display = "block";
	
	var oldlink = document.getElementById(nmsUi._active + "-link");
	var newlink = document.getElementById(pane + "-link");
	oldlink.classList.remove("active");
	newlink.classList.add("active");

	nmsUi._active = pane;
}

nmsUi.toggleVertical = function(x) {
	nms.vertical = !nms.vertical;
}
