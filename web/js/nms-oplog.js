"use strict";

var nmsOplog = nmsOplog || {
	table: {}
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

nmsOplog.getUser = function(force) {
	if (force == undefined)
		force = false;
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
	if (d == undefined || d == null || d == "") {
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
	nmsOplog._updateComments(10,"-mini","time",100);
	nmsOplog._updateComments(0,"","timestamp");
}

nmsOplog.getSwitchLogs = function(sw) {
	var logs = [];
	if (nmsData.oplog == undefined || nmsData['oplog']['oplog'] == undefined)
		return [];
	for (var v in nmsData['oplog']['oplog']) {
		var log = nmsData['oplog']['oplog'][v];
		if (log['systems'] != "" && log['systems'] != undefined) {
			if (nmsSearch.searchTest(log['systems'],sw)) {
				logs.push(log);
			}
		}
	}
	return logs;
}

/*
 * This can be re-written now that it uses nmsBox... That rewrite was just a short
 * test of nmsBox...
 */
nmsOplog._updateComments = function(limit,prefix,timefield,cutoff) {
	var table = new nmsTable([]);
	var i = 0;
	for (var v in nmsData['oplog']['oplog']) {
		if (cutoff && nmsData.oplog.oplog[v]['username'] == "system") {
			continue;
		}
		var col1;
		var date = new Date(nmsData.oplog.oplog[v]['timestamp'].replace(" ","T").replace("+00",""));
		if (timefield == "time") {
			col1 = date.toTimeString().replace(/:\d\d .*$/,"");
		} else {
			var month = date.getMonth() + 1;
			var day = date.getDate();
			var tmp = (date.getYear() + 1900) + "-" + (month < 10 ? "0": "") + month + "-" + (day < 10 ? "0" : "") + day + " " + date.toTimeString().replace(/:\d\d .*$/,"");
			col1 = tmp;
		}
		var data = nmsData['oplog']['oplog'][v]['log'];
		var col2 = new nmsBox("p");
		if (cutoff && data.length > cutoff) {
			col2.html.title = data;
			data = data.slice(0,cutoff);
			data = data + "(...)";
		}
		col2.html.textContent = nmsData['oplog']['oplog'][v]['systems'] + " [" + nmsData['oplog']['oplog'][v]['username'] + "] " + data;
		col2.html.hiddenthing = v;
		col2.html.onclick = function(e) { 
			var x = document.getElementById("searchbox");
			var v = e.path[0].hiddenthing;
			x.value = nmsData['oplog']['oplog'][v]['systems'];
			x.oninput();
		}
		table.add([col1,col2]);
		if (++i == limit)
			break;
	}
	try {
		var old = document.getElementById("oplog-table" + prefix);
		old.parentElement.removeChild(old);
	} catch(e) {}
	var par = document.getElementById("oplog-parent" + prefix);
	table.html.id = "oplog-table" + prefix;
	par.appendChild(table.html);
	nmsOplog.table["x" + prefix] = table;
};

