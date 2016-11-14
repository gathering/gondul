"use strict";

var nmsTemplate = nmsTemplate || {

}

nmsTemplate.test = function() {
	var input = document.getElementById("template-input");
	var output = document.getElementById("template-output");
	$.ajax({
		type: "POST",
		url: "/api/templates/test",
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
	var input = document.getElementById("template-input");
	var output = document.getElementById("template-output");
	$.ajax({
		type: "GET",
		url: "/templates/" + template,
		async: false,
		data: input.value,
		dataType: "text",
		success: function (indata, textStatus, jqXHR) {
			var output = document.getElementById("template-input");
			output.value = indata;
		}
	});
}
