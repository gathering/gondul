/*
 * Map handlers/updaters for NMS.
 *
 * These are functions used to determine how the map should look in NMS.
 * They represent vastly different information, but in a uniform way.
 *
 * The idea is that these updaters only parse information that's fetched by
 * NMS - they do not request additional information. E.g., ping data is
 * always present, but until the ping-handler is active, it isn't
 * displayed. This might seem redundant, but it means any handler can
 * utilize information from any aspect of NMS, and thus opens NMS up to the
 * world of intelligent maps base don multiple data sources.
 *
 */

var handler_uplinks = {
	init:uplinkInit,
	getInfo:uplinkInfo,
	tag:"uplink",
	name:"Uplink"
};

var handler_temp = {
	init:tempInit,
	getInfo:tempInfo,
	tag:"temp",
	name:"Temperature"
};

var handler_ping = {
	init:pingInit,
	getInfo:pingInfo,
	tag:"ping",
	name:"Ping"
};

var handler_traffic = {
	init:trafficInit,
	tag:"traffic",
	name:"Uplink traffic"
};

var handler_traffic_tot = {
	init:trafficTotInit,
	tag:"traffictot",
	name:"Switch traffic"
};

var handler_dhcp = {
	init:dhcpInit,
	getInfo:dhcpInfo,
	tag:"dhcp",
	name:"DHCP"
};

var handler_disco = {
	init:discoInit,
	tag:"disco",
	name:"Disco fever"
};

var handler_snmp = {
	init:snmpInit,
	getInfo:snmpInfo,
	tag:"snmp",
	name:"SNMP state"
};

var handler_cpu = {
	init:cpuInit,
	getInfo:cpuInfo,
	tag:"cpu",
	name:"CPU utilization"
};

var handler_memory = {
	init:memoryInit,
	getInfo:memoryInfo,
	tag:"memory",
	name:"Memory utilization"
};

var handler_health = {
	init:healthInit,
	getInfo:healthInfo,
	tag:"health",
	name:"Health"
};

var handler_mgmt = {
	getInfo:mgmtInfo,
	tag:"mgmt",
	name:"Management info"
};
var handler_net = {
	getInfo:networkInfo,
	tag:"net",
	name:"Network info"
};
var handler_snmpup = {
	getInfo:snmpUpInfo,
	tag:"snmpup",
	name:"SNMP Uplink state"
};

var handlerInfo = function(tag,desc) {
	/*
	 * Short name, typically matching the url anchor.
	 */
	this.tag = tag;
	this.description = desc || "Unknown";
	this.data = [
		{ 
			value: undefined,
			description: desc || "Generic info"
		}];
	/*
	 * 0: all good.
	 * 1000: messed up.
	 *
	 * This can be "intelligent". E.g.: pingInfo() takes latency and
	 * the age of the reply into account in addition to having a
	 * special handling of lack of a result.
	 */
	this.score = 0;
	/*
	 * Why the score is what it is. E.g.: If you have multiple
	 * conditions that set the score, what is the final value based on?
	 */
	this.why = "0 score is the default";
};

/*
 * Order matches what's seen in the infobox
 */
var handlers = [
	handler_health,
	handler_mgmt,
	handler_net,
	handler_uplinks,
	handler_temp,
	handler_ping,
	handler_traffic,
	handler_disco,
	handler_traffic_tot,
	handler_dhcp,
	handler_snmp,
	handler_cpu,
	handler_memory,
	handler_snmpup
	];

function uplinkInfo(sw)
{
	var ret = new handlerInfo("snmpup","Uplinks");
	ret.why = "Uplinks";
	ret.score = 0;
	var u = 0;
	var t  = 0;
        var known_t = 0;
	if (testTree(nmsData,['switchstate','switches',sw,'uplinks','live'])) {
		u = parseInt(nmsData.switchstate.switches[sw].uplinks.live);
		t = parseInt(nmsData.switchstate.switches[sw].uplinks.total);
		known_t = t;
		ret.data[0].value = u + " / " + t;
		ret.data[0].description = "Uplinks (live/configured)";
		if (nmsData.switches.switches[sw].subnet4 == undefined ||
		    nmsData.switches.switches[sw].subnet4 == null) {
			if (tagged(sw,'3up')) {
				known_t = 3;
			} else if (tagged(sw,'2up')) {
				known_t = 2;
			} else if (tagged(sw, '1up')) {
				known_t = 1;
			} else if (tagged(sw,'4up')) {
				known_t = 4;
			}
			if (known_t != t) {
				ret.data[0].value += "(Overridden: " + known_t + ")";
			}
			if (u == known_t) {
				ret.score = 0;
				ret.why = "All uplinks up";
			} else if (u == 1) {
				ret.score = 800;
				ret.why = "Only 1 of " + known_t + " uplinks alive";
			} else if (u < known_t && !(t >= 10 && u <5)) {
				ret.score = 450;
				ret.why = u + " of " + known_t + " uplinks alive";
			} else if (u > known_t) {
				ret.score = 350;
				ret.why = u + " of " + known_t + " uplinks alive";
			} else if (u < known_t && (t >= 10 && u < 5)) {
				ret.score = 150;
				ret.why = u + " of " + known_t + " uplinks alive (huge diff suggests WIP - downgrading)";
			}
		}
	}
	if (testTree(nmsData,['switchstate','switches',sw,'clients','total'])) {
		var tu = parseInt(nmsData.switchstate.switches[sw].clients.live);
		var tt = parseInt(nmsData.switchstate.switches[sw].clients.total);
		ret.data[1] = {};
		ret.data[1].value = (tu && tt) ? (tu) + " / " + (tt) : "None configured";
		ret.data[1].description = "Client ports (live/total)";
	}
	if (testTree(nmsData,['switchstate','switches',sw,'totals','live'])) {
		var tu = parseInt(nmsData.switchstate.switches[sw].totals.live);
		var tt = parseInt(nmsData.switchstate.switches[sw].totals.total);
		ret.data[2] = {};
		ret.data[2].value = (tu-u) + " / " + (tt-t);
		ret.data[2].description = "Non-uplink ports (live/total)";
	}
	return ret;
}
/*
 * Update function for uplink map
 */
function uplinkUpdater()
{
	if (!nmsData.switches)
		return;
	if (!nmsData.switches.switches)
		return;
	if (!nmsData.switchstate)
		return;
	if (!nmsData.switchstate.switches)
		return;
	for (var sw in nmsData.switches.switches) {
		var uplinks=0;
		if (nmsData.switchstate.switches[sw] == undefined || nmsData.switchstate.switches[sw].uplinks == undefined) {
			uplinks=0;
		} else {
			uplinks = nmsData.switchstate.switches[sw].uplinks.live;
			nuplinks = nmsData.switchstate.switches[sw].uplinks.total;
		}

		if (uplinks == 0) {
			nmsMap.setSwitchColor(sw,"white");
		} else if (uplinks == 1) {
			nmsMap. setSwitchColor(sw, nmsColor.red);
		} else if (uplinks == 2) {
			nmsMap.setSwitchColor(sw, nmsColor.green);
		} else if (uplinks == 3) {
			nmsMap.setSwitchColor(sw, nmsColor.orange);
		} else if (uplinks > 3) {
			nmsMap.setSwitchColor(sw, nmsColor.blue);
		}
	}
}


/*
 * Init-function for uplink map
 */
function uplinkInit()
{
	nmsData.addHandler("switches","mapHandler",uplinkUpdater);
	nmsData.addHandler("switchstate","mapHandler",uplinkUpdater);
	setLegend(1,"white","0 uplinks");	
	setLegend(2,nmsColor.red,"1 uplink");	
	setLegend(3,nmsColor.green,"2 uplinks");	
	setLegend(4,nmsColor.orange,"3 uplinks");	
	setLegend(5,nmsColor.blue,"4 uplinks");	
}

/*
 * Init-function for uplink map
 */
function trafficInit()
{
	nmsData.addHandler("switches","mapHandler",trafficUpdater);
	nmsData.addHandler("switchstate","mapHandler",trafficUpdater);
	var m = 1024 * 1024 / 8;
	nmsColor.drawGradient([nmsColor.lightgreen, nmsColor.green, nmsColor.orange, nmsColor.red]);
	setLegend(1,colorFromSpeed(0),"0 (N/A)");	
	setLegend(5,colorFromSpeed(1100 * m) , "1100Mb/s");	
	setLegend(4,colorFromSpeed(600 * m),"600Mb/s");	
	setLegend(3,colorFromSpeed(300 * m),"300Mb/s");	
	setLegend(2,colorFromSpeed(10 * m),"10Mb/s");	
}

function trafficUpdater()
{
	if (!nmsData.switchstate.switches || !nmsData.switchstate.then)
		return;
	for (var sw in nmsData.switchstate.switches) {
		var speed = 0;
		try {
			var t = parseInt(nmsData.switchstate.then[sw].uplinks.ifHCOutOctets);
			var n = parseInt(nmsData.switchstate.switches[sw].uplinks.ifHCOutOctets);
			var tt = parseInt(nmsData.switchstate.then[sw].time);
			var nt = parseInt(nmsData.switchstate.switches[sw].time);
		} catch (e) { continue;};
		var tdiff = nt - tt;
		var diff = n - t;
		speed = diff / tdiff;
                if(!isNaN(speed)) {
                        nmsMap.setSwitchColor(sw,colorFromSpeed(speed));
			nmsMap.setSwitchInfo(sw,byteCount(speed*8,0));
		}
	}
}

function trafficTotInit()
{
	nmsData.addHandler("switches","mapHandler",trafficTotUpdater);
	nmsData.addHandler("switchstate","mapHandler",trafficTotUpdater);
	var m = 1024 * 1024 / 8;
	nmsColor.drawGradient([nmsColor.lightgreen, nmsColor.green, nmsColor.orange, nmsColor.red]);
	setLegend(1,colorFromSpeed(0),"0 (N/A)");	
	setLegend(5,colorFromSpeed(5000 * m,5) , "5000Mb/s");	
	setLegend(4,colorFromSpeed(3000 * m,5),"3000Mb/s");	
	setLegend(3,colorFromSpeed(1000 * m,5),"1000Mb/s");	
	setLegend(2,colorFromSpeed(100 * m,5),"100Mb/s");	
}

function trafficTotUpdater()
{
	if (!nmsData.switchstate.switches || !nmsData.switchstate.then)
		return;
	for (var sw in nmsData.switchstate.switches) {
		var speed = 0;
		try {
			var t = parseInt(nmsData.switchstate.then[sw].totals.ifHCOutOctets);
			var n = parseInt(nmsData.switchstate.switches[sw].totals.ifHCOutOctets);
			var tt = parseInt(nmsData.switchstate.then[sw].time);
			var nt = parseInt(nmsData.switchstate.switches[sw].time);
		} catch (e) { continue;};
		var tdiff = nt - tt;
		var diff = n - t;
		speed = diff / tdiff;
                if(!isNaN(speed))
                        nmsMap.setSwitchColor(sw,colorFromSpeed(speed));
	}
}

function colorFromSpeed(speed,factor)
{
	var m = 1024 * 1024 / 8;
	if (factor == undefined)
		factor = 1.1;
	if (speed == 0)
		return nmsColor.blue;
	speed = speed < 0 ? 0 : speed;
	return nmsColor.getColorStop( 1000 * (speed / (factor * (1000 * m))));
}

/*
 * Tweaked this to scale from roughly 20C to 35C. Hence the -20  and /15
 * thing (e.g., "0" is 20 and "15" is 35 by the time we pass it to
 * rgb_from_max());
 */
function temp_color(t)
{
	if (t == undefined) {
		console.log("Temp_color, but temp is undefined");
		return nmsColor.blue;
	}
	t = parseInt(t) - 12;
	t = Math.floor((t / 23) * 1000);
	return nmsColor.getColorStop(t);
}

function tempUpdater()
{
	if(!nmsData.switches)
		return;

	for ( var sw in nmsData.switches["switches"]) {
		var t = "white";
		var temp = "";
		
		if(!nmsData.switchstate || !nmsData.switchstate.switches || !nmsData.switchstate.switches[sw] || !nmsData.switchstate.switches[sw].temp)
			continue;

		var t = nmsData.switchstate.switches[sw].temp;
		temp = t + "°C";
		t = temp_color(temp);
		nmsMap.setSwitchColor(sw, t);
		nmsMap.setSwitchInfo(sw, temp);

	}
}

function tempInfo(sw)
{
	var ret = new handlerInfo("temp","Temperature");
	ret.why = "Temp";
	ret.score = 0;
	ret.data[0].value = undefined;
	if (testTree(nmsData,['switchstate','switches',sw,'temp'])) {
		var temp = nmsData.switchstate.switches[sw].temp;
		if (temp == undefined) {
			ret.data[0].value = undefined;
		} else {
			temp = parseInt(temp);
			ret.data[0].value = temp + "°C";
		}
		if (temp > 30 && temp < 50) {
			ret.score = temp;
		} else if (temp > 50 && temp < 100) {
			ret.score = temp * 5;
			ret.why = "Very high temperature";
		}
	}
	return ret;
}
function tempInit()
{ 
	//Padded the gradient with extra colors for the upper unused values
	nmsColor.drawGradient(["black", nmsColor.blue, nmsColor.lightblue, nmsColor.lightgreen, nmsColor.green, nmsColor.orange, nmsColor.red]);
	setLegend(1,temp_color(15),"15 °C");	
	setLegend(2,temp_color(20),"20 °C");	
	setLegend(3,temp_color(25),"25 °C");	
	setLegend(4,temp_color(30),"30 °C");	
	setLegend(5,temp_color(35),"35 °C");	
	nmsData.addHandler("switchstate","mapHandler",tempUpdater);
	tempUpdater();
}

function pingUpdater()
{
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined) {
		return;
	}
	for (var sw in nmsData.switches.switches) {
		var c = nmsColor.getColorStop(pingInfo(sw).score);
		if (c == 1000) {
			nmsMap.setSwitchColor(sw, nmsColor.blue);
		} else {
			nmsMap.setSwitchColor(sw, c);
		}
	}
}

function pingInfo(sw)
{
	var ret = new handlerInfo("ping","Latency(ms)");
	ret.why = "Latency (?)";
	ret.score =0;
	if (testTree(nmsData,['ping','switches',sw])) {
		var v4 = nmsData.ping.switches[sw].latency4;
		var v6 = nmsData.ping.switches[sw].latency6;
		if (v4 == undefined || v4 == null || isNaN(v4))
			v4 = undefined;
		if (v6 == undefined || v6 == null || isNaN(v6))
			v6 = undefined;
		ret.data[0].value = v4;
		ret.data[0].description = "IPv4 latency(ms)";
		ret.data[1] = {};
		ret.data[1].value = v6;
		ret.data[1].description = "IPv6 latency(ms)";
		if (v4 == undefined && v6 == undefined) {
			ret.score = 1000;
			ret.why = "No IPv4 or IPv6 ping reply";
		} else if(v6 == undefined && !tagged(sw,'ignorev6')) {
			ret.score = 450;
			ret.why = "No IPv6 ping reply";
		} else if (v4 == undefined) {
			ret.score = 800;
			ret.why = "No IPv4 ping reply";
		}

		v4 = parseFloat(v4) ;
		v6 = parseFloat(v6) ;
		if (tagged(sw,'ignorev6')) {
			v6 = 0;
		}
		if (v4 > ret.score || v6 > ret.score) {
			ret.why = "Latency";
			ret.score = parseInt(v4 > v6 ? v4 : v6);
		}
		if (nmsData.ping.switches[sw].age4 > 10 || nmsData.ping.switches[sw].age6 > 10) {
			ret.why = "Old ping";
			ret.score = 900;
		}
	} else {
		ret.data[0].value = "No ping replies";
		ret.why = "No ping replies";
		ret.score = 999;
	}

	if (testTree(nmsData,['smanagement','switches',sw])) {
		try {
			var distro = nmsData['smanagement']['switches'][sw]['distro_name'];
			var phy = nmsData['smanagement']['switches'][sw]['distro_phy_port'];
			if (!(distro == "" || phy == "" || distro == undefined || phy == undefined)) {
				if (testTree(nmsData,['snmp','snmp',distro, 'ports',phy,'ifOperStatus'])) {
					var x = nmsData['snmp']['snmp'][distro]['ports'][phy]['ifOperStatus'];
					var ping = "no";
					var ping6 = "no ";
					try {
						ping = parseFloat(nmsData["ping"]["switches"][sw]["latency4"]);
						ping6 = parseFloat(nmsData["ping"]["switches"][sw]["latency6"]);
					} catch(e) {}
					if (x == "up") {
						ret.data[3] = {};
						ret.data[3].description = "Distro-port";
						ret.data[3].value = "Distro port is live";
						if (isNaN(ping) && isNaN(ping6)) {
							ret.score = 700;
							ret.why = "Distro port is alive, but no IPv4/IPv6 ping. ROLLBACK!";
						}
					}
				}
			}
		} catch(e) {
			console.log("Lazy about errors....");
			console.log(e);
		}
	}
	return ret;
}

function pingInit()
{
	nmsColor.drawGradient([nmsColor.green,nmsColor.lightgreen, nmsColor.orange, nmsColor.red]);
	setLegend(1,nmsColor.getColorStop(10),"1ms");	
	setLegend(2,nmsColor.getColorStop(300),"30ms");	
	setLegend(3,nmsColor.getColorStop(600),"60ms");	
	setLegend(4,nmsColor.getColorStop(1000),"100ms");	
	setLegend(5,nmsColor.blue,"No response");	
	nmsData.addHandler("ping","mapHandler",pingUpdater);
	pingUpdater();
}

function getDhcpColor(stop)
{
	stop = parseInt(stop);
	stop = stop * 0.85;
	if (stop < 0)
		stop = 1000;
	if (stop > 1000)
		stop = 1000;
	return nmsColor.getColorStop(stop);
}

function dhcpUpdater()
{
	if (!testTree(nmsData,['dhcp','dhcp4']) || !testTree(nmsData,['dhcp','dhcp6']) || !testTree(nmsData,['switches','switches']) || !testTree(nmsData,['smanagement','switches'])) {
		return;
	}
	var now = nmsData.dhcp.time;
	for (var sw in nmsData.switches.switches) {
		var c = nmsColor.blue;
		var sv4 = nmsData.dhcp.dhcp4[nmsData.smanagement.switches[sw].traffic_vlan];
		var sv6 = nmsData.dhcp.dhcp6[nmsData.smanagement.switches[sw].traffic_vlan]; 
		if (sv4 == undefined || sv6 == undefined) {
			nmsMap.setSwitchColor(sw,c);
			continue;
		}	
		var thenv4 = parseInt(sv4);
		var thenv6 = parseInt(sv6);
		var then = Math.max(thenv4, thenv6)
		c = getDhcpColor(now - then);
		nmsMap.setSwitchColor(sw, c);
	}
}
function dhcpInfo(sw) {
	var ret = new handlerInfo("dhcp","DHCP state");
	ret.why = "No DHCP data";
	ret.data[0].description = "DHCPv4 age";

	ret.data[1] = {};
	ret.data[1].description = "DHCPv6 age";

        if (!testTree(nmsData,['dhcp','dhcp4']) || !testTree(nmsData,['dhcp','dhcp6']) || !testTree(nmsData,['switches','switches']) || !testTree(nmsData,['smanagement','switches'])) {
                return ret.data[1] = {};
        }
	var dhcpClients = 0;
	var clientPortsUp = 0;
	var clientPortsUp = setTree(nmsData,['switchstate','switches',sw,'clients','live'],0);
	var clientPortsTotal = setTree(nmsData,['switchstate','switches',sw,'clients','total'],0);
	if (testTree(nmsData,['smanagement','switches',sw,'traffic_vlan'])) {
		if (testTree(nmsData,['dhcp','networks',nmsData.smanagement.switches[sw].traffic_vlan,'clients'])) {
			dhcpClients = nmsData.dhcp.networks[nmsData.smanagement.switches[sw].traffic_vlan].clients;
		}
	}
	if (testTree(nmsData,['dhcp','dhcp4',nmsData.smanagement.switches[sw].traffic_vlan])) {
		var now = nmsData.dhcp.time;
		var then = nmsData.dhcp.dhcp4[nmsData.smanagement.switches[sw].traffic_vlan];
		var diff = now - then;
		var divider = 6;
		if (dhcpClients < 10) {
			divider = 12;
		}
		if(tagged(sw,'slowdhcp')) {
			divider = 12;
		}

		ret.data[0].value = secondsToTime(diff);
		ret.why = "DHCP freshness";
		ret.score = diff/divider> 350 ? 350 : parseInt(diff/divider);
	} else {
		ret.data[0].value = "No DHCPv4 data";
		if (testTree(nmsData,['smanagement','switches',sw])) {
			if (nmsData.smanagement.switches[sw].traffic_vlan == undefined ||
				nmsData.smanagement.switches[sw].traffic_vlan == "") {
				ret.data[0].value = "No associated networks";
				ret.score = 0;
				ret.why = "No network associated";
			} else {
				if (!(clientPortsUp < 2 && clientPortsTotal > 20)) {
					ret.score = 350;
					ret.why = "No DHCPv4 data";
				} else {
					ret.data[0].value = "No DHCPv4 data, but too few clients anyway";
				}
			}
		} else {
			ret.score = 100;
			ret.why = "No management data for DHCP";
		}
	}
        if (testTree(nmsData,['dhcp','dhcp6',nmsData.smanagement.switches[sw].traffic_vlan])) {
                var now = nmsData.dhcp.time;
                var then = nmsData.dhcp.dhcp6[nmsData.smanagement.switches[sw].traffic_vlan];
                var diff = now - then;
                var divider = 6;
                if (dhcpClients < 10) {
                        divider = 12;
                }
                if(tagged(sw,'slowdhcp')) {
                        divider = 12;
                }

                ret.data[1].value = secondsToTime(diff);
                ret.why = "DHCP freshness";
                ret.score = diff/divider> 350 ? 350 : parseInt(diff/divider);
        } else {
                ret.data[1].value = "No DHCPv6 data";
                if (testTree(nmsData,['smanagement','switches',sw])) {
                        if (nmsData.smanagement.switches[sw].traffic_vlan == undefined ||
                                nmsData.smanagement.switches[sw].traffic_vlan == "") {
                                ret.data[1].value = "No associated networks";
                                ret.score = 0;
                                ret.why = "No network associated";
                        } else {
                                if (!(clientPortsUp < 2 && clientPortsTotal > 20)) {
                                        ret.score = 350;
                                        ret.why = "No DHCPv6 data";
                                } else {
                                        ret.data[1].value = "No DHCPv6 data, but too few clients anyway";
                                }
                        }
                } else {
                        ret.score = 100;
                        ret.why = "No management data for DHCP";
                }
        }
	if (testTree(nmsData,['dhcp','networks',nmsData.smanagement.switches[sw].traffic_vlan,'clients'])) {
		var dhcpClients = nmsData.dhcp.networks[nmsData.smanagement.switches[sw].traffic_vlan].clients;
		ret.data[2] = {};
		ret.data[2].value = nmsData.dhcp.networks[nmsData.smanagement.switches[sw].traffic_vlan].clients;
		ret.data[2].description = "DHCP clients";
		if (testTree(nmsData,['switchstate','switches',sw,'clients','live'])) {
			var tu = parseInt(nmsData.switchstate.switches[sw].clients.live);
			var tt = parseInt(nmsData.switchstate.switches[sw].clients.total);
			if (tu - dhcpClients > 12) {
				if (ret.score < 450) {
					ret.score = 450;
					ret.why = "Far more client ports than dhcp clients";
				}
			}
		}
	}
	if (testTree(nmsData,['switches','switches',sw, 'tags'])) {
		if (tagged(sw,'ignoredhcp')) {
			ret.score = 0;
			ret.why += "(Ignored)";
			ret.data[0].value += "(Ignored)";
		}
	}
	return ret;
}

function dhcpInit()
{
	nmsColor.drawGradient([nmsColor.green, nmsColor.lightgreen, nmsColor.orange, nmsColor.red]);
	nmsData.addHandler("dhcp","mapHandler",dhcpUpdater);
	setLegend(1,"white","Undefined");
	setLegend(2,getDhcpColor(1),"1 Second old");
	setLegend(3,getDhcpColor(300),"300 Seconds old");
	setLegend(4,getDhcpColor(900),"900 Seconds old");
	setLegend(5,getDhcpColor(1200),"1200 Seconds old");
	dhcpUpdater();
}

/*
 * Testing-function to randomize colors of linknets and switches
 */
function randomizeColors()
{
/*	for (var i in nms.switches_now.linknets) {
		setLinknetColors(i, getRandomColor(), getRandomColor());
	}
*/
	if (nmsData.switches == undefined  || nmsData.switches.switches == undefined) {
		return;
	}
	for (var sw in nmsData.switches.switches) {
		nmsMap.setSwitchColor(sw, nmsColor.random());
	}
}

function discoDo() {
	randomizeColors();
}
function discoInit()
{
	nmsData.addHandler("ticker", "mapHandler", discoDo);
	
	setNightMode(true);
	setLegend(1,nmsColor.blue,"Y");	
	setLegend(2,nmsColor.red, "M");
	setLegend(3,nmsColor.orange,"C");
	setLegend(4,nmsColor.green, "A");
	setLegend(5,"white","!");
	discoDo();
}

function snmpUpdater() {
	for (var sw in nmsData.switches.switches) {
		if (nmsData.snmp.snmp[sw] == undefined || nmsData.snmp.snmp[sw].misc == undefined) {
			nmsMap.setSwitchColor(sw, nmsColor.red);
		} else if (nmsData.snmp.snmp[sw].misc.sysName[0] != sw) {
			nmsMap.setSwitchColor(sw, nmsColor.orange);
		} else {
			nmsMap.setSwitchColor(sw, nmsColor.green);
		}
	}
}

function secondsToTime(input) {
	var d, h, m, s;
	d = Math.floor(input / 60 / 60 / 24);
	h = Math.floor((input - (d * 24 * 3600)) / 60 / 60);
	m = Math.floor((input%3600)/60);
	s = Math.floor(input%60);
	var string = "";
	if (d > 0)
		string = d + " days ";
	if (h > 0)
		string += h + " hours ";
	if (h > 0 || m > 0)
		string += m + " minutes ";
	if (string == "")
		string += s + " seconds";
	return string;
}

function snmpInfo(sw) {
	var ret = new handlerInfo("snmp","SNMP data");
	ret.why = "No SNMP data";
	if (!testTree(nmsData,['snmp','snmp',sw,'misc'])) {
		ret.score = 500;
		ret.why = "No SNMP data";
		ret.data[0].value = "No data";
		if (testTree(nmsData,['smanagement','switches',sw])) {
			if (nmsData.smanagement.switches[sw].community  == undefined ||
			    nmsData.smanagement.switches[sw].community  == "disable") {
				ret.score = 0;
				ret.why = "SNMP disabled";
				ret.data[0].value = "SNMP disabled";
			}
		}
	} else if (nmsData.snmp.snmp[sw].misc.sysName[0].indexOf(sw) != 0) {
		ret.score = 200;
		ret.why = "SNMP sysName doesn't match Gondul sysname";
		ret.data[0].value = ret.why;
		ret.data[1] = { description: "SNMP sysName", value: nmsData.snmp.snmp[sw].misc.sysName[0] };
	} else {
		ret.score = 0;
		ret.data[0].value = "Available";
		ret.why = "SNMP all good";
	}
	if (testTree(nmsData,['snmp','snmp',sw,'misc','sysUpTimeInstance',''])) {
		var uptime = parseInt(nmsData.snmp.snmp[sw]["misc"]["sysUpTimeInstance"][""]) / 100;
		var upstring = secondsToTime(uptime);
		ret.data.push({value: upstring, description: "System uptime"});
		if (uptime < 60*5 && ret.score < 300) {
			ret.score = 300;
			ret.why = "System rebooted last 5 minutes";
		}
		if (uptime < 60*15 && ret.score < 250) {
			ret.score = 250;
			ret.why = "System rebooted last 15 minutes";
		}
	}
	return ret;
}


function snmpInit() {
	nmsData.addHandler("snmp", "mapHandler", snmpUpdater);
	
	setLegend(1,nmsColor.green,"OK");	
	setLegend(2,nmsColor.orange, "Sysname mismatch");
	setLegend(3,nmsColor.red,"No SNMP data");
	setLegend(4,nmsColor.green, "");
	setLegend(5,nmsColor.green,"");
	snmpUpdater();
}

function snmpUpInfo(sw) {
	var ret = new handlerInfo("uplink","SNMP uplink data");
	ret.why = "No SNMP data";
	ret.score = 0;

	if (testTree(nmsData,['snmp','snmp',sw, 'ports'])) {
		var total_up = 0;
		var seen_up = 0;
		for (var port in nmsData.snmp.snmp[sw].ports) {
			var x = nmsData.snmp.snmp[sw].ports[port];
			if(x["ifAlias"] != null) {
				if (x["ifAlias"].match(/B:/i) && x["ifOperStatus"] == "up") {
					total_up += parseInt(x["ifHighSpeed"]);
				}
				if (x["ifAlias"].match(/G:/i) && x["ifOperStatus"] == "up") {
					seen_up += parseInt(x["ifHighSpeed"]);
				}
			}
		}
		ret.data[0].value = "LAG member speed and total speed is " + seen_up;
		if (total_up != seen_up) {
			ret.score = 500;
			if (tagged(sw,'ignoreuplink')) {
				ret.score = 0;
			}

			ret.why = "LAG member (ge/xe/et) speed is " + seen_up + " but logical (ae) is " + total_up;
			ret.data[0].value = ret.why;
		}
	}
	return ret;
}

function cpuInfo(sw) {
	var ret = new handlerInfo("cpu","CPU utilization");
	ret.why = "No CPU info";
	ret.score = 0;

	if (testTree(nmsData,['snmp','snmp',sw, 'misc','jnxOperatingCPU'])) {
		var cpu = 0;
		for (var u in nmsData.snmp.snmp[sw].misc.jnxOperatingCPU) {
			var local = nmsData.snmp.snmp[sw].misc['jnxOperatingCPU'][u];
			cpu = Math.max(nmsData.snmp.snmp[sw].misc.jnxOperatingCPU[u],cpu);
		}
		if (cpu < 30) {
			ret.score = 0;
		} else if (cpu < 50) {
			ret.score = 100;
		} else if (cpu < 70 ) {
			ret.score = cpu * 3;
		} else {
			ret.score = cpu * 7;
		}
		ret.why = "CPU utilization: " + cpu + "%";
		ret.data[0].value = cpu + "%";
	}
	return ret;
}

function cpuUpdater() {
	for (var sw in nmsData.switches.switches) {
		try {
			var cpu = 0;
			for (var u in nmsData.snmp.snmp[sw].misc.jnxOperatingCPU) {
				var local = nmsData.snmp.snmp[sw].misc['jnxOperatingCPU'][u];
				cpu = Math.max(nmsData.snmp.snmp[sw].misc.jnxOperatingCPU[u],cpu);
			}
			nmsMap.setSwitchColor(sw, nmsColor.getColorStop(cpu * 10));
			nmsMap.setSwitchInfo(sw, cpu + " % ");
		} catch (e) {
			nmsMap.setSwitchColor(sw, "white");
			nmsMap.setSwitchInfo(sw, "N/A");
		}
	}
}
function memoryUpdater() {
	for (var sw in nmsData.switches.switches) {
		try {
			var buffer = 0;
			for (var u in nmsData.snmp.snmp[sw].misc.jnxOperatingBuffer) {
				var local = nmsData.snmp.snmp[sw].misc['jnxOperatingBuffer'][u];
				buffer = Math.max(nmsData.snmp.snmp[sw].misc.jnxOperatingBuffer[u],buffer);
			}
			nmsMap.setSwitchColor(sw, nmsColor.getColorStop(buffer * 10));
			nmsMap.setSwitchInfo(sw, buffer + " % ");
		} catch (e) {
			nmsMap.setSwitchColor(sw, "white");
			nmsMap.setSwitchInfo(sw, "N/A");
		}
	}
}
function memoryInfo(sw) {
	var ret = new handlerInfo("memory","Memory utilization");
	ret.why = "No Memory info";
	ret.score = 0;

	if (testTree(nmsData,['snmp','snmp',sw, 'misc','jnxOperatingBuffer'])) {
		var memory = 0;
		for (var u in nmsData.snmp.snmp[sw].misc.jnxOperatingBuffer) {
			var local = nmsData.snmp.snmp[sw].misc['jnxOperatingBuffer'][u];
			memory = Math.max(nmsData.snmp.snmp[sw].misc.jnxOperatingBuffer[u],memory);
		}
		if (memory < 70) {
			ret.score = 0;
		} else if (memory < 80) {
			ret.score = 100;
		} else if (memory < 90) {
			ret.score = memory * 2;
		} else {
			ret.score = memory * 6;
		}
		ret.why = "Memory utilization: " + memory + "%";
		ret.data[0].value = memory + "%";
	}
	return ret;
}

function tagged(sw, tag) {
	try {
		if (testTree(nmsData,['switches','switches',sw, 'tags'])) {
			if (nmsData.switches.switches[sw].tags.includes(tag)) {
				return true;
			}
		}
	} catch(e) {
		console.log("Tried to find tags for " + sw + "but tags-datastructure is probably not an array?");
	}
	return false;
}

function networkInfo(sw) {
	var ret = new handlerInfo("net","Network info");
	ret.score = 0;
	ret.why = "All good";
	if (testTree(nmsData,['smanagement','switches',sw])) {
		var i = 0;
		var mg = nmsData.smanagement.switches[sw];
		var objs = [{
			d: "Management",
			v: setTree(nmsData,['networks','networks',mg.mgmt_vlan],undefined)
			},{
			d: "Traffic",
			v: setTree(nmsData,['networks','networks',mg.traffic_vlan],undefined)
			}
			];
		for (var x in objs) {
			a = objs[x];
			if (a.v == undefined) {
				ret.data[i++] = {
					value: 'Not set',
					description: a.d + ' network'
				};	
				continue;
			}
			
			ret.data[i++] = {
				value: a.v.name || "Not set",
				description: a.d + " network"
			}
			ret.data[i++] = {
				value: a.v.vlan || "Not set",
				description: a.d + " vlan"
			}
			ret.data[i++]  = {
				value: a.v.subnet4 || "Not set",
				description: a.d + " subnet IPv4"
			}
			ret.data[i++]  = {
				value: a.v.gw4 || "Not set",
				description: a.d + " gw IPv4"
			}
			ret.data[i++]  = {
				value: a.v.subnet6 || "Not set",
				description: a.d + " subnet IPv6"
			}
			ret.data[i++]  = {
				value: a.v.gw6 || "Not set",
				description: a.d + " gw IPv6"
			}
			ret.data[i++]  = {
				value: a.v.router || "Not set",
				description: a.d + " net router"
			}
		}
	}
	return ret;
}
function mgmtInfo(sw) {
	var ret = new handlerInfo("mgmt","Management info");
	ret.score = 0;
	ret.why = "All good";
	if (testTree(nmsData,['smanagement','switches',sw])) {
		var mg = nmsData.smanagement.switches[sw];
		ret.data =
			[{
				value: mg.mgmt_v4_addr || "N/A",
				description: "Management IP (v4)"
			}, {
				value: mg.mgmt_v6_addr || "N/A",
				description: "Management IP (v6)"
			}, {
				value: mg.distro_name || "N/A",
				description: "Distro"
			}
			];
		if ((mg.mgmt_v4_addr == undefined || mg.mgmt_v4_addr == "") && (mg.mgmt_v6_addr == undefined || mg.mgmt_v6_addr == "")) {
			ret.why = "No IPv4 or IPv6 management IP";
			ret.score = 1000;
		} else if (mg.mgmt_v4_addr == undefined || mg.mgmt_v4_addr == "") {
			ret.why = "No IPv4 management IP";
			ret.score = 550;
		} else if (mg.mgmt_v6_addr == undefined || mg.mgmt_v6_addr == "") {
			ret.why = "No IPv6 management IP";
			ret.score = 550;
			if (tagged(sw,'ignorev6')) {
				ret.score = 0;
			}
		}
	} else {
		ret.score = 1000;
		ret.why = "No management info";
		ret.data = [{}];
		ret.data[0].value = "N/A";
		ret.data[0].description = "Management info";
	};
	return ret;
}

function cpuInit() {
	nmsData.addHandler("snmp", "mapHandler", cpuUpdater);
	nmsColor.drawGradient([nmsColor.green,nmsColor.orange,nmsColor.red]);
	setLegend(1,getColorStop(0),"0 %");
	setLegend(2,getColorStop(250),"25 %");
	setLegend(3,getColorStop(600),"60 %");
	setLegend(4,getColorStop(1000),"100 %");
	setLegend(5,"white","N/A");
	cpuUpdater();
}
function memoryInit() {
	nmsData.addHandler("snmp", "mapHandler", memoryUpdater);
	nmsColor.drawGradient([nmsColor.green,nmsColor.orange,nmsColor.red]);
	setLegend(1,getColorStop(0),"0 %");
	setLegend(2,getColorStop(250),"25 %");
	setLegend(3,getColorStop(600),"60 %");
	setLegend(4,getColorStop(1000),"100 %");
	setLegend(5,"white","N/A");
	memoryUpdater();
}

function healthInfo(sw) {
	var worst = new handlerInfo("health", "Health");
	var realdata = {};
	worst.score = 0;
	worst.why = "All good";
	for (var h in handlers) {
		if (handlers[h].tag== "health")
			continue;
		if (handlers[h].getInfo == undefined)
			continue;
		var ret = handlers[h].getInfo(sw);
		realdata[handlers[h].tag] = ret.data;
		if (ret.score > worst.score) {
			worst = ret;
		}
	}
	worst.data = [{
		description: "Health (lower is better)",
		value: worst.score + " (" + worst.why + ")"
	}];
	realdata['health'] = worst.data;
	worst.realdata = realdata;
	return worst;
}

function healthUpdater() {
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined)
		return;
	for (var sw in nmsData.switches.switches) {
		var worst = healthInfo(sw);
		nmsMap.setSwitchColor(sw, nmsColor.getColorStop(worst.score));
		if (worst.score > 200)
			nmsMap.setSwitchInfo(sw, worst.tag);
		else {
			if (nms.legendPick != undefined && 
				testTree(worst.realdata,[nms.legendPick.handler,nms.legendPick.idx])) {
				nmsMap.setSwitchInfo(sw,worst.realdata[nms.legendPick.handler][nms.legendPick.idx].value);
			} else {
				nmsMap.setSwitchInfo(sw, undefined);
			}
		}
	}
}

function healthInit() {
	nmsData.addHandler("ticker", "mapHandler", healthUpdater);
	nmsColor.drawGradient([nmsColor.green,nmsColor.lightgreen, nmsColor.orange,nmsColor.red]);
	setLegend(1,nmsColor.getColorStop(0),"All good");
	setLegend(2,nmsColor.getColorStop(250),"Ok-ish");
	setLegend(3,nmsColor.getColorStop(600),"Ick-ish");
	setLegend(4,nmsColor.getColorStop(800),"Nasty");
	setLegend(5,nmsColor.getColorStop(1000),"WTF?");
	healthUpdater();
}
