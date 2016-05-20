"use strict";



var nmsAdmin = nmsAdmin || {
	_populated: false,
	_elements: {},
	_main: {
		'shortname':"Short name", 
		'publicvhost': "Public VHOST",
		'data': "Misc data"
	}
};

nmsAdmin._populatePane = function() {
	var form = document.createElement("div");
	form.classList.add("form-group");
	for (var v in nmsAdmin._main) {
		var x = document.createElement('label');
		var y = document.createElement('input');
		y.classList.add("form-control");
		y.id = "nmsAdmin-input-" + v;
		x.innerText = nmsAdmin._main[v];
		x.htmlFor = y.id;
		form.appendChild(x);
		form.appendChild(y);
		nmsAdmin._elements[v] = y;
	}
	var submit = document.createElement("button");
	submit.classList.add("btn");
	submit.classList.add("btn-default");
	submit.onclick = nmsAdmin._commitData;
	submit.innerHTML = "Save";
	var topel = document.getElementById("admin-row");
	topel.appendChild(form);
	topel.appendChild(submit);
	nmsAdmin._populated = true;
}

nmsAdmin._setReadOnly = function(ro) {
	for (var v in nmsAdmin._main) {
		nmsAdmin._elements[v].readOnly = ro;
	}
}

nmsAdmin._commitData = function() {
	var myData = {};
	for (var v in nmsAdmin._main) {
		if (v != "data") {
			myData[v] = nmsAdmin._elements[v].value;
		} else {
			myData[v] = JSON.parse(nmsAdmin._elements[v].value);
		}
	}
	myData = JSON.stringify(myData);
	nmsAdmin._setReadOnly(true);
	$.ajax({
		type: "POST",
		url: "/api/write/config",
		dataType: "text",
		data:myData,
		success: function (data, textStatus, jqXHR) {
			nmsData.invalidate("config");
			nmsAdmin._setReadOnly(false);
		}
	});
}

nmsAdmin.updateConfigPane = function() {
	if (nmsAdmin._populated == false) {
		nmsAdmin._populatePane();
	}
	for (var v in nmsAdmin._main) {
		if (v != "data") {
			nmsAdmin._elements[v].value = nmsData['config']['config'][v];
		} else {
			nmsAdmin._elements[v].value = JSON.stringify(nmsData['config']['config'][v]);
		}
	}
}

nmsAdmin.addLinknet = function() {
	var myData = { 
		"switch1": document.getElementById("admin-input-linknet1").value,
		"switch2": document.getElementById("admin-input-linknet2").value
		};
	myData = JSON.stringify(myData);
	$.ajax({
		type: "POST",
		url: "/api/write/linknet-add",
		dataType: "text",
		data:myData,
		success: function (data, textStatus, jqXHR) {
			nmsData.invalidate("switches");
			document.getElementById("admin-input-linknet1").value = "";
			document.getElementById("admin-input-linknet2").value = "";
		}
	});
}
