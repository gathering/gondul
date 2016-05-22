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
	tag:"uplink",
	name:"Uplink"
};

var handler_temp = {
	init:tempInit,
	tag:"temp",
	name:"Temperature"
};

var handler_ping = {
	init:pingInit,
	getInfo:pingInfo,
	tag:"ping",
	name:"IPv4 Ping"
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
	tag:"cpu",
	name:"CPU utilization"
};

var handler_combo = {
	init:comboInit,
	getInfo:comboInfo,
	tag:"combo",
	name:"Aggregated health"
};

var handler_mgmt = {
	getInfo:mgmtInfo,
	name:"Management info"
};

var handlerInfo = function(tag,desc) {
	/*
	 * Short name, typically matching the url anchor.
	 */
	this.tag = tag;
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
	handler_combo,
	handler_uplinks,
	handler_temp,
	handler_ping,
	handler_traffic,
	handler_disco,
	handler_traffic_tot,
	handler_dhcp,
	handler_snmp,
	handler_cpu,
	handler_mgmt
	];

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
			nmsMap.setSwitchColor(sw, nmsColor.orange);
		} else if (uplinks == 3) {
			nmsMap.setSwitchColor(sw, nmsColor.green);
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
	setLegend(3,nmsColor.orange,"2 uplinks");	
	setLegend(4,nmsColor.green,"3 uplinks");	
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
}

function pingUpdater()
{
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined) {
		return;
	}
	for (var sw in nmsData.switches.switches) {
		try {
			var c = nmsColor.getColorStop(pingInfo(sw).score);
			if (c == 1000) {
				nmsMap.setSwitchColor(sw, nmsColor.blue);
			} else {
				nmsMap.setSwitchColor(sw, c);
			}
		} catch (e) {
			nmsMap.setSwitchColor(sw, nmsColor.blue);
		}
	}
}

function pingInfo(sw)
{
	var ret = new handlerInfo("ping","Latency(ms)");
	ret.why = "Latency";
	try {
		ret.data[0].value = nmsData.ping.switches[sw].latency;
		ret.score = parseInt(ret.data[0].value) * 10;
		if (nmsData.ping.switches[sw].age > 5) {
			ret.why = "Old ping";
			ret.score = 900;
		}
	} catch(e) {
		ret.data[0].value = "N/A - no ping replies";
		ret.why = "No ping replies";
		ret.score = 999;
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
	nmsData.addHandler("switches","mapHandler",pingUpdater);
	nmsData.addHandler("ticker", "mapHandler", pingUpdater);
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
	if (nmsData.dhcp == undefined || nmsData.dhcp.dhcp == undefined) {
		return
	}
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined) {
		return;
	}
	var now = nmsData.dhcp.time;
	try {
	for (var sw in nmsData.switches.switches) {
		var c = nmsColor.blue;
		if (nmsData.dhcp.dhcp[sw] == undefined) {
			nmsMap.setSwitchColor(sw,c);
			continue;
		}
		var s = nmsData.dhcp.dhcp[sw];
		var then = parseInt(s);
		c = getDhcpColor(now - then);
		nmsMap.setSwitchColor(sw, c);
	}
	} catch(e) {
		console.log(e);
	}
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
function snmpInfo(sw) {
	var ret = new handlerInfo("snmp","SNMP data");
	ret.why = "No data";
	if (nmsData.snmp == undefined || nmsData.snmp.snmp == undefined || nmsData.snmp.snmp[sw] == undefined || nmsData.snmp.snmp[sw].misc == undefined) {
		ret.score = 800;
		ret.why = "No data";
		ret.data[0].value = "No data";
	} else if (nmsData.snmp.snmp[sw].misc.sysName[0] != sw) {
		ret.score = 300;
		ret.why = "SNMP sysName doesn't match Gondul sysname";
		ret.data[0].value = ret.why;
	} else {
		ret.score = 0;
		ret.data[0].value = "SNMP freshly updated";
		ret.why = "SNMP all good";
	}
	try {
		var uptime = nmsData.snmp.snmp[this.sw]["misc"]["sysUpTimeInstance"][""] / 60 / 60 / 100;
		uptime = Math.floor(uptime) + " t";
		ret.data.push({value: uptime, description: "System uptime"});
	} catch(e){}
	return ret;
}

function snmpInit() {
	nmsData.addHandler("snmp", "mapHandler", snmpUpdater);
	
	setLegend(1,nmsColor.green,"OK");	
	setLegend(2,nmsColor.orange, "Sysname mismatch");
	setLegend(3,nmsColor.red,"No SNMP data");
	setLegend(4,nmsColor.green, "");
	setLegend(5,nmsColor.green,"");

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

function mgmtInfo(sw) {
	var ret = new handlerInfo("mgmt","Management info");
	try {
		var mg = nmsData.smanagement.switches[sw];
		ret.data =
			[{
				value: mg.mgmt_v4_addr || "N/A",
				description: "Management IP (v4)"
			}, {
				value: mg.mgmt_v6_addr || "N/A",
				description: "Management IP (v6)"
			}, {
				value: mg.subnet4 || "N/A",
				description: "Subnet (v4)"
			}, {
				value: mg.subnet6 || "N/A",
				description: "Subnet (v6)"
			}];
		if (mg.mgmt_v4_addr == undefined || mg.mgmt_v4_addr == "") {
			ret.why = "No IPv4 mamagement IP";
			ret.score = 1000;
		}
	} catch(e) {
		ret.score = 800;
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
}

function comboInfo(sw) {
	var worst = new handlerInfo("combo");
	worst.score = -1;
	for (var h in handlers) {
		try {
			if (handlers[h].tag== "combo")
				continue;
			var ret = handlers[h].getInfo(sw);
			if (ret.score > worst.score) {
				worst = ret;
			}
		} catch(e) { }
	}
	worst.data = [{
		description: "Worst: " + worst.data[0].description,
		value: worst.why
	}];
	return worst;
}

function comboUpdater() {
	if (nmsData.switches == undefined || nmsData.switches.switches == undefined)
		return;
	for (var sw in nmsData.switches.switches) {
		var worst = comboInfo(sw);
		nmsMap.setSwitchColor(sw, nmsColor.getColorStop(worst.score));
		nmsMap.setSwitchInfo(sw, worst.tag);
	}
}

function comboInit() {
	nmsData.addHandler("ping", "mapHandler", comboUpdater);
	nmsColor.drawGradient([nmsColor.green,nmsColor.orange,nmsColor.red]);
	setLegend(1,nmsColor.getColorStop(0),"All good");
	setLegend(2,nmsColor.getColorStop(250),"Ok-ish");
	setLegend(3,nmsColor.getColorStop(600),"Ick-ish");
	setLegend(4,nmsColor.getColorStop(800),"Nasty");
	setLegend(5,nmsColor.getColorStop(1000),"WTF?");
}
