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
        if(template == '') { return; }
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

nmsTemplate.getTemplates = function() {
        $.ajax({
                type: "GET",
                url: "/api/read/template-list",
                async: false,
                dataType: "json",
                success: function (indata, textStatus, jqXHR) {
                        $.each( indata['templates'], function( value ) {
                                $('#nmsTemplate-select').append($("<option></option>").attr("value",indata['templates'][value]['file']).text(indata['templates'][value]['file']));
                        });
                }
        });
}
//nmsTemplate.getTemplates();
