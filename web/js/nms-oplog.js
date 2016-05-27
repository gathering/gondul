"use strict";

var nmsOplog = nmsOplog || {

}

nmsOplog.init = function() {
	nmsData.addHandler("oplog", "nmsOplogHandler", nmsOplog.updateComments);
}

nmsOplog._reset = function() {
	document.getElementById('logbox-id').value = "";
	document.getElementById('logbox').value = "";
	document.getElementById('searchbox').value = "";
	document.getElementById('searchbox').oninput();
}

nmsOplog.getUser = function(force = false) {
	var user = nms.user;
	if (user == undefined || force) {
		user = prompt("Who are you? Short nick for the record.");
		if (user == null || user == undefined || user == "") {
			console.log("empty prompt");
			alert("No cake for you.");
			return false;
		}
		nms.user = user;
		saveSettings();
	}
	return nms.user;
}

nmsOplog.commit = function() {
	var s = document.getElementById('logbox-id').value;
	var d = document.getElementById('logbox').value;
	var user = nmsOplog.getUser();
	if (user == undefined) {
		nmsOplog._reset();
		return;
	}

	var myData = {"user": user, "systems": s, "log": d};
	myData = JSON.stringify(myData);
	$.ajax({
		type: "POST",
		url: "/api/write/oplog",
		dataType: "text",
		data:myData,
		success: function (data, textStatus, jqXHR) {
			nmsData.invalidate("oplog");
		}
	});
	nmsOplog._reset();
}

nmsOplog.updateComments = function() {
	nmsOplog._updateComments(5,"-mini","time");
	nmsOplog._updateComments(0,"","timestamp");
}

nmsOplog.getSwitchLogs = function(sw) {
	var logs = [];
	if (nmsData.oplog == undefined || nmsData['oplog']['oplog'] == undefined)
		return [];
	for (var v in nmsData['oplog']['oplog']) {
		var log = nmsData['oplog']['oplog'][v];
		if (nmsSearch.searchTest(log['systems'],sw)) {
			logs.push(log);
		}
	}
	return logs;
}

nmsOplog._updateComments = function(limit,prefix,timefield) {
	var table = document.createElement("table");
	var tr;
	var td1;
	var td2;
	var td3;
	table.className = "table";
	table.classList.add("table");
	table.classList.add("table-condensed");
	var i = 0;
	for (var v in nmsData['oplog']['oplog']) {
		tr = table.insertRow(-1);
		td1 = tr.insertCell(0);
		td2 = tr.insertCell(1);
		td1.textContent = nmsData['oplog']['oplog'][v][timefield];
		td2.textContent = "[" + nmsData['oplog']['oplog'][v]['username'] + "] " + nmsData['oplog']['oplog'][v]['log'];
		td2.hiddenthing = v;
		td2.onclick = function(e){ var x = document.getElementById("searchbox"); var v = e.path[0].hiddenthing; x.value = nmsData['oplog']['oplog'][v]['systems']; x.oninput(); }
		if (++i == limit)
			break;
	}
	try {
		var old = document.getElementById("oplog-table" + prefix);
		old.parentElement.removeChild(old);
	} catch(e) {}
	var par = document.getElementById("oplog-parent" + prefix);
	table.id = "oplog-table" + prefix;
	par.appendChild(table);
};

