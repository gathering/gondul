"use strict";

var nmsScoreCard = nmsScoreCard || {
	_handler: null
};

nmsScoreCard.init = function() {
	var scores = [];
	for (var sw in nmsData.switches.switches) {
		var worst = healthInfo(sw);
		worst.sw = sw;
		scores.push(worst);
	}
	scores.sort(function(a,b) {
		return b.score - a.score;
	});
	var content = [];
	for (var i in scores) {
		var sw = scores[i];
		content.push([sw.score, sw.sw, sw.why]);
	}
	var parentel = document.getElementById("score-parent");
	while (parentel.firstChild) {
		parentel.removeChild(parentel.firstChild);
	}
	parentel.appendChild(nmsScoreCard._buildTable(content));
	if (nmsScoreCard._handler != null) {
		clearTimeout(nmsScoreCard._handler);
		nmsScoreCard._handler = null;
	}
	nmsScoreCard._handler = setTimeout(nmsScoreCard.init, 10000);
}
nmsScoreCard._buildTable = function(content,caption) {
	var table = document.createElement("table");
	var tr;
	var td1;
	var td2;
	var td3;
	table.className = "table";
	table.classList.add("table");
	table.classList.add("table-condensed");
	if (caption != undefined) {
		var cap = document.createElement("caption");
		cap.textContent = caption;
		table.appendChild(cap);
	}
	for (var v in content) {
		tr = table.insertRow(-1);
		if (content[v][0] > 500) {
			tr.classList.add("danger");
		} else if (content[v][0] > 249) {
			tr.classList.add("warning");
		} else if (content[v][0] > 99) {
			tr.classList.add("info");
		} else {
			tr.classList.add("success");
		}
		td1 = tr.insertCell(0);
		td1.classList.add("left");
		td2 = tr.insertCell(1);
		td3 = tr.insertCell(2);
		td1.innerHTML = content[v][0];
		console.log("<p class=\"fakelink\" onclick=\"nmsUi.setActive(\"map\"); nmsInfoBox.click(\"" + content[v][1] + "\");\">" + content[v][1] + "</p>");
		td2.innerHTML = "<p class=\"fakelink\" onclick='nmsUi.setActive(\"map\"); nmsInfoBox.click(\"" + content[v][1] + "\");'>" + content[v][1] + "</p>";
		td3.innerHTML = content[v][2];
	}
	return table;
}
