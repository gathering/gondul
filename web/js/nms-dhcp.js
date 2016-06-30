"use strict";

var nmsDhcp = nmsDhcp || {

}

nmsDhcp.init = function() {
	nmsData.addHandler("dhcpsummary", "nmsDhcpHandler", nmsDhcp.updateSummary);
}

nmsDhcp.updateSummary = function() {
	var e = document.getElementById("dhcp-summary");
	if (e == undefined) {
		return;
	}
	e.innerHTML = nmsData.dhcpsummary.dhcp.clients + " clients";
}
