"use strict";

var nmsTemplate = nmsTemplate || {
}

nmsTemplate.test = function() {
	var input = document.getElementById("template-input");
	var output = document.getElementById("template-output");
	var qp = document.getElementById("template-query-params");
	$.ajax({
		type: "POST",
		url: "/api/templates/test" + qp.value,
		async: false,
		data: input.value,
		dataType: "text",
		success: function (indata, textStatus, jqXHR) {
			var output = document.getElementById("template-output");
			output.value = jqXHR.responseText;
		},
		error: function (jqXHR, textStatus) {
			var output = document.getElementById("template-output");
			output.value = jqXHR.responseText;
		}
	});
}

nmsTemplate.fromFile = function(template) {
	$.ajax({
		type: "GET",
		url: "/templates/" + template,
		async: false,
		dataType: "text",
		success: function (indata, textStatus, jqXHR) {
			var output = document.getElementById("template-input");
			output.value = indata;
		}
	});
	nmsTemplate.test();
}
