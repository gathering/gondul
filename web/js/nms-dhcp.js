"use strict";

var nmsDhcp = nmsDhcp || {};

nmsDhcp.init = function () {
  //nmsData.addHandler("dhcpsummary", "nmsDhcpHandler", nmsDhcp.updateSummary);
};

nmsDhcp.updateSummary = function () {
  var e = document.getElementById("dhcp-summary");
  if (e == undefined) {
    return;
  }
  e.innerHTML = "";
  if (nmsData.dhcpsummary.dhcp[4] != undefined) {
    e.innerHTML = e.innerHTML + nmsData.dhcpsummary.dhcp[4] + " IPv4 clients";
  }
  if (
    nmsData.dhcpsummary.dhcp[4] != undefined &&
    nmsData.dhcpsummary.dhcp[6] != undefined
  ) {
    e.innerHTML = e.innerHTML + " | ";
  }
  if (nmsData.dhcpsummary.dhcp[6] != undefined) {
    e.innerHTML = e.innerHTML + nmsData.dhcpsummary.dhcp[6] + " IPv6 clients";
  }
};
