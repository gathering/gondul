"use strict";

function setNightModeChart(night) {
	if(night) {
		Chart.defaults.global.defaultFontColor = "#fff";
	}
	else {
		Chart.defaults.global.defaultFontColor = "#222";
	}
}

function drawLatency(canvas, sw) {
        var q = encodeURIComponent('SELECT mean("latency") AS "mean_latency" FROM "ping" WHERE time > now() - 30m AND "switch"=\''+sw+'\' GROUP BY time(60s), "version" fill(null)');
        var dataset = [];

        $.getJSON( "/query?db=gondul&q="+q, function( results ) {
                results['results'][0]['series'].forEach(function(serie) {
                        var data = [];
                        serie['values'].forEach(function(element) {
                                data.push({t: new Date(element[0]), y: element[1]});
                        });
                        dataset.push({data: data, backgroundColor:'rgba(66,139,202,255)', label:serie['tags']['version'] });
                });
                var ctx = document.getElementById(canvas).getContext('2d');
                var myChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                                datasets: dataset
                        },
                        options: {
                                scales: {
                                        xAxes:[{
                                                type: 'time',
                                                time: {
                                                        format: "HH:mm",
                                                        unit: 'minute',
                                                        tooltipFormat: 'HH:mm',
                                                        displayFormats: {
                                                                'minute': 'HH:mm',
                                                                'hour': 'HH:mm',
                                                                min: '00:00',
                                                                max: '23:59'
                                                        },
                                                }
                                        }],
                                },
                                responsive: true,
				animation: false,
                                elements: {
                                        line: {
                                                tension: 0.05
                                        }
                                }
                        }
                });
        });
}

function drawSumOfPorts(canvas, sw) {

        var kilobit = 1024;
        var megabit = kilobit * 1024;
        var gigabit = megabit * 1024;
        var terabit = gigabit * 1024;

        var q = encodeURIComponent('SELECT non_negative_derivative(first("ifHCInOctets"), 1s) * 8 AS "ifHCInOctets", non_negative_derivative(first("ifHCOutOctets"), 1s) * 8 AS "ifHCOutOctets" FROM "ports" WHERE time > now() - 30m AND "switch"=\''+sw+'\' GROUP BY time(90s),"interface" fill(null)');

        var dataset = [];

        $.getJSON( "/query?db=gondul&q="+q, function( results ) {
                console.log(results);

                var bits_in = [];
                var bits_out = [];

                results['results'][0]['series'].forEach(function(serie) {

                // Bytes in
                serie['values'].forEach(function(element) {
                        bits_in.push(element[1]);
                });

                // Bytes out
                serie['values'].forEach(function(element) {
                        bits_out.push(element[2]);
                });


		});

                var bits_in_size = bitToSize(Math.max.apply( Math, bits_in ));
                var bits_out_size = bitToSize(Math.max.apply( Math, bits_out ));
                var size = 0;

                if(bits_in_size >= bits_out_size) {
                        size = bits_in_size;
                } else {
                        size = bits_out_size;
                }

                var size_divider;
                switch (size) {
                        case 0:
                                size_divider = 1;
                                break;
                        case 1:
                                size_divider = kilobit;
                                break;
                        case 2:
                                size_divider = megabit;
                                break;
                        case 3:
                                size_divider = gigabit;
                                break;
                        case 4:
                                size_divider = terabit;
                                break;
                }

		results['results'][0]['series'].forEach(function(serie) {

                // Bytes in
                var data = [];
                serie['values'].forEach(function(element) {
                    data.push({t: new Date(element[0]), y: element[1] / size_divider });
                });
                dataset.push({data: data, backgroundColor:'rgba(38,105,28,200)', label:'Traffic in (' + sizeToText(size)+')'});

                // Bytes out
                data = [];
                serie['values'].forEach(function(element) {
                    data.push({t: new Date(element[0]), y: -Math.abs(element[2] / size_divider) });
                });
                dataset.push({data: data, backgroundColor:'rgba(64,64,122,225)', label:'Traffic out (' + sizeToText(size)+')'});


		});

                // Draw the chart
                var ctx = document.getElementById(canvas).getContext('2d');
                var myChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                                datasets: dataset
                        },
                        options: {
				legend: {
					display: false
				},
                                scales: {
                                        xAxes:[{
                                                type: 'time',
                                                time: {
                                                        format: "HH:mm",
                                                        unit: 'minute',
                                                        tooltipFormat: 'HH:mm',
                                                        displayFormats: {
                                                                'minute': 'HH:mm',
                                                                'hour': 'HH:mm',
                                                                min: '00:00',
                                                                max: '23:59'
                                                        },
                                                }
                                        }],
                                        yAxes: [{
						stacked: true,
                                                ticks: {
                                                        callback: function(label, index, labels) {
                                                                return Math.abs(label)+' '+sizeToText(size);
                                                        }
                                                },
                                                scaleLabel: {
                                                        display: true,
                                                        labelString: sw+' - All ports'
                                                }
                                        }]
                                },
                                responsive: true,
                                animation: false,
				elements: { 
					point: {
						radius: 0
					},
					line: {
						tension: 0
					}
				}
                        }
                });
        });
}


function drawPort(canvas, sw, port) {

        var kilobit = 1024;
        var megabit = kilobit * 1024;
        var gigabit = megabit * 1024;
        var terabit = gigabit * 1024;

	console.log(sw);
	console.log(port);
	var q = encodeURIComponent('SELECT non_negative_derivative(first("ifHCInOctets"), 1s) * 8 AS "ifHCInOctets", non_negative_derivative(first("ifHCOutOctets"), 1s) * 8 AS "ifHCOutOctets" FROM "ports" WHERE time > now() - 30m AND "switch"=\''+sw+'\' AND "interface"=\''+port+'\' GROUP BY time(30s) fill(null)');

	var dataset = [];

        $.getJSON( "/query?db=gondul&q="+q, function( results ) {
		console.log(results);

		var serie = results['results'][0]['series'][0];
                
		var bits_in = [];
		var bits_out = [];

		// Bytes in
                serie['values'].forEach(function(element) {
			bits_in.push(element[1]);
                });

		// Bytes out
		serie['values'].forEach(function(element) {
			bits_out.push(element[2]);
                });

		var bits_in_size = bitToSize(Math.max.apply( Math, bits_in ));
		var bits_out_size = bitToSize(Math.max.apply( Math, bits_out ));
		var size = 0;	
	
		if(bits_in_size >= bits_out_size) {
			size = bits_in_size;
		} else {
			size = bits_out_size;
		}

		var size_divider;
		switch (size) {
			case 0:
				size_divider = 1;
				break;
			case 1:
				size_divider = kilobit;
				break;
			case 2:
				size_divider = megabit;
				break;
			case 3:
				size_divider = gigabit;
				break;
			case 4:
				size_divider = terabit;
				break;
		}

		// Bytes in
                var data = [];
                serie['values'].forEach(function(element) {
                    data.push({t: new Date(element[0]), y: element[1] / size_divider });
                });
                dataset.push({data: data, backgroundColor:'rgba(38,105,28,200)', label:'Traffic in (' + sizeToText(size)+')'});

                // Bytes out
                data = [];
                serie['values'].forEach(function(element) {
                    data.push({t: new Date(element[0]), y: -Math.abs(element[2] / size_divider) });
                });
                dataset.push({data: data, backgroundColor:'rgba(64,64,122,225)', label:'Traffic out (' + sizeToText(size)+')'});


		// Draw the chart
                var ctx = document.getElementById(canvas).getContext('2d');
                var myChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                                datasets: dataset
                        },
                        options: {
                                scales: {
                                        xAxes:[{
                                                type: 'time',
                                                time: {
                                                        format: "HH:mm",
                                                        unit: 'minute',
                                                        tooltipFormat: 'HH:mm',
                                                        displayFormats: {
                                                                'minute': 'HH:mm',
                                                                'hour': 'HH:mm',
                                                                min: '00:00',
                                                                max: '23:59'
                                                        },
                                                }
					}],
					yAxes: [{
						ticks: {
							callback: function(label, index, labels) {
								return Math.abs(label)+' '+sizeToText(size);
							}
						},
						scaleLabel: {
							display: true,
							labelString: sw+' - '+port
						}
					}]
                                },
                                responsive: true,
                                animation: false,
                                elements: {
					line: {
						tension: 0
					}
				}

                        }
                });
        });
}


function bitToSize(bits) {

	var kilobit = 1024;
	var megabit = kilobit * 1024;
	var gigabit = megabit * 1024;
	var terabit = gigabit * 1024;

	if(bits >= 0 && bits < kilobit) {
		return 0;
	}
	else if(bits >= kilobit && bits < megabit){
		return 1;
	}
	else if(bits >= megabit && bits < gigabit){
		return 2;
	}
	else if(bits >= gigabit && bits < terabit){
		return 3;
	}
	else if(bits >= terabit) {
		return 4;
	}
}

function sizeToText(size) {	
	switch(size) {
		case 0:
			return 'bit/s';
			break;
		case 1:
			return 'kb/s';
			break;
		case 2:
			return 'mb/s';
			break;
		case 3:
			return 'gb/s';
			break;
		case 4:
			return 'tb/s';
			break;
	}
}
