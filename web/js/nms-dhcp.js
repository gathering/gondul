"use strict";

var nmsDhcp = nmsDhcp || {};

nmsDhcp.init = function () {
  //nmsData.addHandler("dhcpsummary", "nmsDhcpHandler", nmsDhcp.updateSummary);
};

nmsDhcp.updateSummary = function () {
  let el = document.getElementById("dhcp-summary");
  if (!el) return;

  el.innerHTML = "";

  let components = [
    `${nmsData.dhcpsummary.dhcp[4] || "unknown"} IPv4 clients`,
    `${nmsData.dhcpsummary.dhcp[6] || "unknown"} IPv6 clients`,
  ];

  el.innerHTML = components.join(" | ");
};
