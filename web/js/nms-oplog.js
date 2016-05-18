"use strict";

var nmsOplog = nmsOplog || {

}

nmsOplog.init = function() {
	nmsData.addHandler("oplog", "nmsOplogHandler", nmsOplog.updateComments);
}

nmsOplog.commit = function() {
	var s = document.getElementById('logbox-id').value;
	var d = document.getElementById('logbox').value;

	var myData = {"systems": s, "log": d};
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
	document.getElementById('logbox-id').value = "";
	document.getElementById('logbox').value = "";

}

nmsOplog.updateComments = function() {
	nmsOplog._updateComments(5,"-mini","time");
	nmsOplog._updateComments(0,"","timestamp");
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
		tr.className = 
		td1 = tr.insertCell(0);
		td2 = tr.insertCell(1);
		td3 = tr.insertCell(2);
		td1.innerHTML = nmsData['oplog']['oplog'][v][timefield];
		td2.innerHTML = nmsData['oplog']['oplog'][v]['username'];
		td3.innerHTML = nmsData['oplog']['oplog'][v]['log'];
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

