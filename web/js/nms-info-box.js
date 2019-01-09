"use strict";

/*
 * NMS info-window controller
 *
 * Interface: nmsInfoBox.showWindow(windowType,optionalParameter), nmsInfoBox.hide()
 *
 * Uses a basic hierarchy of window > views > panels, where each panel can work
 * independently, but gets loaded/unloaded when needed by window or view.
 *
 */

/*
 *
 * Currently broken or needs reimplementing:
 * - Handler unloading is not working correctly, and many are never removed
 * - SSH-management link, this should propably be a custom "view" of sorts
 *
 * General TODO:
 * - Move inventory into a separate tab.
 * - Add external windows (timetravel, etc)
 * - Take a critical look at what methods/variables should be marked as "_"
 * - Currently argument is assumed to be a switch, this should not be the case
 * - Add some basic styling to separate panels visually when in the same view
 *
 */

/*
 * Basic configuration
 */
var nmsInfoBox = nmsInfoBox || {
	stats: {},
	_container: false, //Container window
	_windowHandler: false, //Window handler
	_sw: false, //Name of last switch opened, used for toggle-click
	_windowTypes: [
	{
		'id': 'switchInfo',
		'title': 'Switch info',
		'views': {
			'initial': {
				'name': 'Summary',
				'panels': ['switchLatency','switchSummary','switchComments']
			},
			'ports': {
				'name': 'Ports',
				'panels': ['switchPorts']
			},
			'misc': {
				'name': 'SNMP',
				'panels': ['switchSNMP:misc']
			},
			'links': {
				'name': 'Links',
				'panels': ['switchLinks']
			},
			'edit': {
				'name': 'Edit settings',
				'panels': ['switchEdit']
			}
		}
	},
	{
		'id': 'networkInfo',
		'title': 'Network info',
		'views': {
			'initial': {
				'name': 'Summary',
				'panels': ['networkSummary']
			},
			'edit': {
				'name': 'Edit settings',
				'panels': ['networkEdit']
			}
		}
	},
	{
		'id': 'addSwitch',
		'title': 'Add new switch(es)',
		'views': {
			'initial': {
				'name': 'Add switch',
				'panels': ['switchAdd']
			}
		}
	},
	{
		'id': 'addNetwork',
		'title': 'Add new network(s)',
		'views': {
			'initial': {
				'name': 'Add network',
				'panels': ['networkAdd']
			}
		}
	},
	{
		'id': 'searchHelp',
		'title': 'Search help',
		'views': {
			'initial': {
				'name': 'Search help',
				'panels': ['searchHelp']
			}
		}
	},
  {
		'id': 'searchResults',
		'title': 'Search Results',
		'views': {
			'initial': {
				'name': 'Search Results',
				'panels': ['searchResults']
			}
		}
	},
	{
		'id': 'inventoryListing',
		'title': 'Inventory listing',
		'views': {
			'initial': {
				'name': 'Distro names',
				'panels': ['inventoryListing:distro_name']
			},
			'sysDescr': {
				'name': 'System description',
				'panels': ['inventoryListing:sysDescr']
			},
			'jnxBoxSerialNo': {
				'name': 'Serial numbers',
				'panels': ['inventoryListing:jnxBoxSerialNo']
			},
                        'transceiver': {
                                'name': 'Transceivers',
                                'panels': ['inventoryListing:transceiver']
                        }
		}
	},
	{
		'id': 'listNetwork',
		'title': 'Networks',
		'views': {
			'initial': {
				'name': 'List all networks',
				'panels': ['listNetworks']
			}
		}
	},
],
	_panelTypes: {} //Populate by using the nmsInfoBox.addPanelType method
};

/*
 * Shows a window, and triggers initial load if needed
 */
nmsInfoBox.showWindow = function (windowName,argument) {
	if(windowName == "switchInfo" && argument != '' && argument == this._sw) {
		nmsInfoBox.hide();
		return;
	}

	if(!this._container)
		this._load();
	if(!windowName)
		windowName = 'switchInfo';

	this._sw = argument;

	this._windowHandler.showWindow(windowName,argument)
	this._container.style.display = "block";

	$(this._windowHandler.getTitleObj()).on('mousedown', function(e) {
		var cont = $(nmsInfoBox._container);
		var dimensions = nmsInfoBox._container.getBoundingClientRect();
		var startLeft = dimensions.left;
		var startTop = dimensions.top;
		nmsInfoBox.startDrag(e.screenX, e.screenY, startLeft, startTop);
	});
	$(this._windowHandler.getTitleObj()).on('mouseup',nmsInfoBox.stopDrag);
};

/*
 * Internal function to load and register the initial html objects
 */
nmsInfoBox._load = function() {
	var infoBox = document.createElement("div");
	infoBox.classList.add("panel", "panel-default");
	var title = document.createElement("div");
	title.id = "info-box-title";
	title.classList.add("panel-heading");
	var nav = document.createElement("div");
	nav.id = "info-box-nav";
	nav.classList.add("panel-body");
	var body = document.createElement("div");
	body.id = "info-box-body";
	body.classList.add("panel-body");

	infoBox.appendChild(title);
	infoBox.appendChild(nav);
	infoBox.appendChild(body);

	this._container = document.getElementById("info-box-container");
	this._container.appendChild(infoBox);

	this._windowHandler = new windowHandler();
	this._windowHandler.setContainerObj(document.getElementById("info-box-container"));
	this._windowHandler.setTitleObj(document.getElementById("info-box-title"));
	this._windowHandler.setBodyObj(document.getElementById("info-box-body"));
	this._windowHandler.setNavObj(document.getElementById("info-box-nav"));
	this._windowHandler.setPanelTypes(this._panelTypes);
	this._windowHandler.setWindowTypes(this._windowTypes);
};

/*
 * Adds a panel type to _panelTypes for usage in windows and views
 */
nmsInfoBox.addPanelType = function (id, obj) {
	this._panelTypes[id] = obj;
};


/*
 * Hide the active window and tell it to unload
 */
nmsInfoBox.hide = function() {
	this._sw = false;
	if (this._windowHandler != undefined && this._windowHandler.hide != undefined) {
		this._windowHandler.hide();
		this._windowHandler.unloadWindow();
	}
	nmsInfoBox.resetDrag();
};

/*
 * Start window drag
 */
nmsInfoBox.startDrag = function(mouseStartX, mouseStartY, startLeft, startTop) {
	document.onmousemove = function(e) {
		var mouseOffsetX = e.screenX - mouseStartX;
		var mouseOffsetY = e.screenY - mouseStartY;
		$(nmsInfoBox._container).css('left', startLeft + mouseOffsetX + 'px');
		$(nmsInfoBox._container).css('top', startTop + mouseOffsetY + 'px');
	};
};

/*
 * Reset drag
 */
nmsInfoBox.resetDrag = function() {
	nmsInfoBox.stopDrag();
	$(nmsInfoBox._container).css('left','');
	$(nmsInfoBox._container).css('top','');
};

/*
 * Stop window drag
 */
nmsInfoBox.stopDrag = function() {
	document.onmousemove = null;
};

/*
 * Click a switch and display it.
 */
nmsInfoBox.click = function(sw)
{
	this.showWindow("switchInfo",sw);
};

/*
 * Window handler
 *
 * Is based on a hierarchy of objects: Window (itself) > Views > Panels. Where
 * any object should not interact with any other directly. Panels are special
 * nmsInfoPanel-objects that handle their own rendering, refreshing, etc. The
 * window handler only makes sure these panels are loaded and unloaded when
 * needed in a window or view.
 *
 * Does primarily rely on an imported list of panel types and window types to
 * display stuff, but has methods for manual overrides if needed.
 *
 * Panels can use the doInPanel(panelId,functionName,arguments) method to pass
 * actions to themselves if needed.
 *
 */
var windowHandler = function () {
	this.containerObj = false;
	this.titleObj = false;
	this.navObj = false;
	this.bodyObj = false;
	this._panels = {};
	this._view = "";
	this._viewId = {};
	this._window = {};
	this.windowTypes = false;
	this.panelTypes = false;
	this.argument = false;
	this.show = function () {
		this.containerObj.classList.remove("hidden");
	};
	this.hide = function () {
		this.containerObj.classList.add("hidden");
	};
	this.setContainerObj = function (containerObj) {
		this.containerObj = containerObj;
	};
	this.setTitleObj = function (titleObj) {
		this.titleObj = titleObj;
	};
	this.getTitleObj = function (titleObj) {
		return this.titleObj;
	};
	this.setNavObj = function (navObj) {
		this.navObj = navObj;
	};
	this.setBodyObj = function (bodyObj) {
		this.bodyObj = bodyObj;
	};
	this.setPanelTypes = function (panelTypes) {
		this.panelTypes = panelTypes;
	};
	this.setWindowTypes = function (windowTypes) {
		this.windowTypes = {};
		for(var i in windowTypes) {
			this.windowTypes[windowTypes[i].id] = windowTypes[i];
		}
	};
	this.setArgument = function (argument) {
		if(this.argument != argument) {
			this.argument = argument;
			this.showView(this._view);
		}
	};
	this.showPanel = function (panelName) {
		var panelArray = panelName.split(":");
		var panelName = panelArray[0];
		var panelMode = panelArray[1];
		if(this.panelTypes[panelName]) {
			var id = (Math.random().toString(36)+'00000000000000000').slice(2, 10+2);
			var panel = new this.panelTypes[panelName];
			panel.setId(id);
			if(!!panelMode)
				panel.setMode(panelMode);
			panel.load(this.bodyObj,this.argument);
			this._panels[id] = panel;
		}
	};
	this.showTitle = function (title) {
		this.titleObj.innerHTML = '<button type="button" class="close" aria-label="Close" onclick="nmsInfoBox.hide();" style="float: right;"><span aria-hidden="true">&times;</span></button><h4>' + title + '</h4>';
	};
	this.showNav = function () {
		if(!this._window.views)
			this.navObj.innerHTML = '';
		var output = '<ul class="nav nav-pills small">';
		var i = 0;
		for(var view in this._window.views) {
			var viewObj = this._window.views[view];
			var active = '';
			if(this._view == view)
				active = ' class="active" ';
			output += '<li' + active + '><a class="' + view + '" aria-label="' + viewObj.name + '" onclick="nmsInfoBox._windowHandler.showView(\'' + view + '\');">' + viewObj.name + '</a></li> ';
			i++;
		}
		output += '</ul>';
		if(i < 2) {
			this.navObj.innerHTML = '';
		} else {
			this.navObj.innerHTML = output;
		}
	};
	this.addWindow = function (windowObj) {
		this.windowTypes[windowObj.id] = windowObj;
	};
	this.showWindow = function (windowName,argument) {
		if(!this.windowTypes[windowName])
			return;
		this.unloadWindow();
		this.argument = argument;
		this._window = this.windowTypes[windowName];
		this.showTitle(this._window.title + " " + (argument ? argument : ""));
		this.showView();
		this.show();
	};
	this.showView = function (viewId) {
		if(!viewId || viewId == '') {
			if (this._viewId[this._window.id] == undefined)
				viewId = "initial";
			else
				viewId = this._viewId[this._window.id];
		} else {
			this._viewId[this._window.id] = viewId;
		}
		if(!this._window.views || !this._window.views[viewId])
			return;
		this.unloadView();
		for(var panel in this._window.views[viewId].panels) {
			this.showPanel(this._window.views[viewId].panels[panel]);
		}
		this._view = viewId;
		this.showNav();
	};
	this.removePanel = function (panelId) {
		if(!!panelId)
			this.unloadPanel(panelId);
	};
	this.unloadView = function () {
		this.unloadPanel();
	};
	this.unloadWindow = function() {
		this.hide();
		this.unloadPanel();
	};
	this.unloadPanel = function (panelId) {
		if(!panelId) {
			for(var i in this._panels) {
				this._panels[i].unload();
			}
			this._panels = {};
		} else {
			try {
				this._panels[panelId].unload();
			} catch (e) {}
			delete this._panels[panelId];
		}
	};
	//Method for triggering a function in an active panel
	this.doInPanel = function (panelId, action, argument) {
		if(!this._panels[panelId])
			return;
		if(typeof this._panels[panelId][action] === "function") {
			if(!argument) {
				this._panels[panelId][action]();
			} else {
				this._panels[panelId][action](argument);
			}
		}
	};
};

/*
 * Basic info-panel object
 *
 * Has a basic model of a stand alone panel which is intended to be extended
 * upon to implement specific panels:
 *
 * var myNewPanel = function () {
 *	nmsInfoPanel.call(this,"myNewPanelId");
 *	this.refresh = function (reason) {
 *		//My custom window function
 *		this._render(htmlObj);
 *	};
 * };
 *
 */
var nmsInfoPanel = function nmsInfoPanel(name,id) {
	this.name = name;
	this.id = id;
	this.sw = false;
	this.container = false;
	this.classList = ['info-panel'];
	this.me = false;
	this.handlers = [];
	this.mode = "initial";

	if(!this.id)
		this.id = (Math.random().toString(36)+'00000000000000000').slice(2, 10+2);

	//Method for loading the general panel properties
	this.load = function (container,argument) {
		this.container = container;
		this.sw = argument;
		this.me = document.createElement("div");
		this.me.id = this.id;
		for(var i in this.classList)
			this.me.classList.add(this.classList[i]);
		this.container.appendChild(this.me);
		this.init(argument);
	};

	//Method for making this specific panel-instance ready for first refresh
	//Override in children when any custom init-functionality is needed
	this.init = function (argument) {
		this.refresh("init");
	};

	//Methods for getting and setting panel id
	this.setId = function (id) {
		this.id = id;
	};
	this.getId = function () {
		return this.id;
	};

	//Methods for setting and getting mode (default "initial")
	this.setMode = function (mode) {
		this.mode = mode;
	};
	this.getMode = function () {
		return this.mode;
	};

	//Internal method for rendering content
	this._render = function (newContent) {
		if(!newContent || !this.me)
			return;
		this.me.innerHTML = newContent.outerHTML;
	};

	//Helper method for rendering error messages in a unified way
	this._renderError = function (message) {
		var error = document.createElement("div");
		error.className = "alert alert-info";
		error.innerHTML = message;
		this._render(error);
	};

	//Method for unloading any local data
	this.unload = function () {
		if(!this.me)
			return;
		this.me.remove();
		this.removeHandlers();
		this.sw = false;
		this.container = false;
		this.me = false;
		this.id = false;
	};

	//Method for loading new data and triggering a _render if needed
	//Implemented in children only
	this.refresh = function (reason) {};

	//Methods for adding and removing classes
	this.addClass = function (className) {
		if(this.classList.indexOf(className) == -1) {
			this.classList.push(className);
			this.me.classList.add(className);
		}
	};
	this.removeClass = function (className) {
		var index = this.classList.indexOf(className);
		if(index != -1) {
			this.classList.splice(index,1);
			this.me.classList.remove(className);
		}
	};

	//Method for registering a data handler (lets us clean them up later)
	this.addHandler = function (dataType,targetFunction) {
		if(!targetFunction)
			targetFunction = "refresh";
		nmsData.addHandler(dataType,this.id,(this[targetFunction]).bind(this),"handler-"+dataType);
		this.handlers.push(dataType);
	};

	//Method for removing all handlers we have registered
	this.removeHandlers = function () {
		for(var i in this.handlers) {
			nmsData.unregisterHandler(this.handlers[i],this.id);
		}
	};

	//Method for checking if we have handlers registered
	this.hasHandler = function (dataType) {
		for(var i in this.handlers) {
			if(this.handlers[i] == dataType)
				return true;
		}
		return false;
	};
};

/*
 * Panel type: Switch SNMP information
 *
 * Displays a list of available SNMP data from a set SNMP-group (Ex. "Ports", "Misc")
 *
 * TODO: Clean up html-generator code.
 *
 */
var switchSNMPPanel = function () {
	nmsInfoPanel.call(this,"switchSNMP");
	this.init = function() {
		this.refresh();
	};
	this.refresh = function(reason) {
		var domObj = document.createElement("div");
		domObj.classList.add("panel-group");

		try {
			var snmpJson = nmsData.snmp.snmp[this.sw][this.mode];
		} catch(e) {
			this._renderError("Waiting for data.");
			return;
		}

		for(var obj in snmpJson) {

			var cleanObj = obj.replace(/\W+/g, "");

			var groupObj = document.createElement("div");
			groupObj.classList.add("panel","panel-default","nms-panel-small");
			groupObj.innerHTML = '<a class="panel-heading collapse-controller" style="display:block;" role="button" data-toggle="collapse" href="#'+cleanObj+'-group">' + obj + '</a>';

			var groupObjCollapse = document.createElement("div");
			groupObjCollapse.id = cleanObj + "-group";
			groupObjCollapse.classList.add("collapse");

			var panelBodyObj = document.createElement("div");
			panelBodyObj.classList.add("panel-body");

			var tableObj = document.createElement("table");
			tableObj.classList.add("table","table-condensed");

			var tbody = document.createElement("tbody");

			for(var prop in snmpJson[obj]) {
				var propObj = document.createElement("tr");
				propObj.innerHTML = '<td>' + prop + '</td><td>' + snmpJson[obj][prop] + '</td>';
				tbody.appendChild(propObj);
			}

			tableObj.appendChild(tbody);
			panelBodyObj.appendChild(tableObj);
			groupObjCollapse.appendChild(panelBodyObj);
			groupObj.appendChild(groupObjCollapse);
			domObj.appendChild(groupObj);

		}

		this._render(domObj);
	};
};
nmsInfoBox.addPanelType("switchSNMP",switchSNMPPanel);
var switchPortsPanel = function () {
	nmsInfoPanel.call(this,"switchPorts");
	this.init = function() {
		this.refresh();
	};
	this.refresh = function(reason) {
		var domObj = document.createElement("div");
		domObj.classList.add("panel-group");

		try {
			var snmpOldJson;
			var snmpJson = nmsData.snmp.snmp[this.sw]['ports'];
			if (nmsData.old.snmp != undefined) {
				snmpOldJson = nmsData.old.snmp.snmp[this.sw]['ports'];
			}
		} catch(e) {
			this._renderError("Waiting for data.");
			return;
		}
		var chart = document.createElement("canvas");
		chart.id = this.sw+'port-total-chart';
		drawSumOfPorts(this.sw+'port-total-chart',this.sw)
		var expanderButton = document.createElement("a");
		expanderButton.innerHTML = "Toggle all";
		expanderButton.setAttribute("onclick","$('.collapse-top').collapse('toggle');");
		expanderButton.setAttribute("role","button");
		domObj.appendChild(chart);
		domObj.appendChild(expanderButton);
		var indicies = [];
		for (var obj in snmpJson) {
			indicies.push(obj);
		}
		indicies.sort(function(a,b) {
			var tmpx = [ snmpJson[a].ifName, snmpJson[b].ifName ];
			tmpx.sort();
			if (tmpx[0] == snmpJson[a].ifName) {
				return -1;
			} else {
				return 1;
			}
		});
		for(var obji in indicies) {
			var obj = indicies[obji];
			var cleanObj = obj.replace(/\W+/g, "");
			var groupObj = document.createElement("div");
			groupObj.classList.add("panel","panel-default","nms-panel-small");
			var glyphicon = "glyphicon-remove";
			var button = "btn-danger";
			var title = "link down";
			if (snmpJson[obj].ifOperStatus == "up") {
				glyphicon = "glyphicon-ok";
				button = "btn-success";
				title = "link up";
			}
			if (snmpJson[obj].ifAdminStatus == "down") {
				glyphicon = "glyphicon-ban-circle";
				title = "admin down";
				button = "btn-info";
			}
			var traffic = "";
			try {
				var nowin = parseInt(snmpJson[obj].ifHCInOctets);
				var nowout = parseInt(snmpJson[obj].ifHCOutOctets);
				if (!isNaN(nowin) && !isNaN(nowout)) {
					traffic = "<small>" + byteCount(nowin) + "B in | " + byteCount(nowout) + "B out </small>";
				}
			} catch(e) {};

			groupObj.innerHTML = '<span class="panel-heading" style="display:block;"><a class="collapse-controller" role="button" data-toggle="collapse" href="#'+cleanObj+'-group">' + snmpJson[obj].ifName + ' </a><small>' + snmpJson[obj].ifAlias + '</small><span class="pull-right">' + traffic + '<i class="btn-xs ' + button + '"><span class="glyphicon ' + glyphicon + '" title="' + title + '" aria-hidden="true"></span></i></span></span>';

			var groupObjCollapse = document.createElement("div");
			groupObjCollapse.id = cleanObj + "-group";
			groupObjCollapse.classList.add("collapse");
			groupObjCollapse.classList.add("collapse-top");

			var panelBodyObj = document.createElement("div");
			panelBodyObj.classList.add("panel-body");

			var tableObj = document.createElement("table");
			tableObj.classList.add("table","table-condensed");

			var tbody = document.createElement("tbody");
			var props = [];
			for (var prop in snmpJson[obj]) {
				props.push(prop);
			}
			props.sort();
			for(var index in props) {
				var prop = props[index];
				var propObj = document.createElement("tr");
				var append = "";
				var value = snmpJson[obj][prop];
				if (!isNaN(parseInt(value))) {
					append = byteCount(value, 2);
					if (append != value)
						append = " (" + append + ")";
					else
						append = "";
				}
				propObj.innerHTML = '<td>' + prop + '</td><td>' + value + append + '</td>';
				tbody.appendChild(propObj);
			}

			tableObj.appendChild(tbody);
			if (snmpJson[obj].ifHCInOctets != 0
			 || snmpJson[obj].ifHCOutOctets != 0) {
				var chart = document.createElement("canvas");
                		chart.id = this.sw+'port-'+obj+'-chart';
                		drawPort(this.sw+'port-'+obj+'-chart',this.sw,obj)

				panelBodyObj.appendChild(chart);
			}
			var tableTopObj = document.createElement("div");
			tableTopObj.innerHTML = '<span class="panel-heading" style="display:block;"><a class="collapse-controller" role="button" data-toggle="collapse" href="#'+cleanObj+'-table-group">Details</a></span>';
			var tableTopObjCollapse = document.createElement("div");
			tableTopObjCollapse.id = cleanObj + "-table-group";
			tableTopObjCollapse.classList.add("collapse");
			tableTopObjCollapse.classList.add("collapse-detail");
			tableTopObjCollapse.appendChild(tableObj);
			tableTopObj.appendChild(tableTopObjCollapse);
			panelBodyObj.appendChild(tableTopObj);
			//panelBodyObj.appendChild(tableObj);
			groupObjCollapse.appendChild(panelBodyObj);
			groupObj.appendChild(groupObjCollapse);
			domObj.appendChild(groupObj);

		}

		this._render(domObj);
	};
};
nmsInfoBox.addPanelType("switchPorts",switchPortsPanel);

var searchHelpPanel = function() {
	nmsInfoPanel.call(this,"searchHelp");
	this.refresh = function(reason) {
		var x = document.createElement("div");
		var searchHelp = nmsSearch.helpText;
		for (var a in searchHelp) {
			var c = document.createElement("p");
			c.innerText = searchHelp[a];
			x.appendChild(c);
		}
		this._render(x);
	};
};
nmsInfoBox.addPanelType("searchHelp",searchHelpPanel);


/*
 * Panel type: Search Results
 *
 * Show the search results
 *
 */
var searchResultsPanel = function() {
	var searchPage = 0;
        nmsInfoPanel.call(this,"searchResults");
        this.refresh = function(reason) {
		var collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
                var switches = nmsSearch.matches.sort(collator.compare);
		var table = document.createElement('table');
		table.className = "table table-condensed";
		table.id = "searchResults-table"
		for (var sw in switches) {
			var row = table.insertRow(sw);
			var cell1 = row.insertCell(0);
			var cell2 = row.insertCell(1);
			var cell3 = row.insertCell(2);
                       	cell1.innerHTML = "<a href='#' onclick='nmsInfoBox.showWindow(\"switchInfo\",\""+switches[sw]+"\");'>"+switches[sw]+ '</a>';
			cell2.innerHTML = nmsData.switches["switches"][switches[sw]].distro_name;
			cell3.innerHTML = handlers[0].getInfo(switches[sw]).why;
                	}
		this._render(table);
		}
};
nmsInfoBox.addPanelType("searchResults",searchResultsPanel);

/*
 * Panel type: Add switch
 *
 * Lets you add a new switch using the switch-add api
 *
 */
var switchAddPanel = function() {
	nmsInfoPanel.call(this,"switchAdd");
	this.refresh = function(reason) {
		var domObj = document.createElement("div");
		domObj.innerHTML = '<input type="text" class="form-control" id="create-sysname" placeholder="Space-seaprated list of system names"></br><button class="btn btn-default" onclick="nmsInfoBox._windowHandler.doInPanel(\'' + this.id +'\',\'save\');">Add switch</button>'
		this._render(domObj);
	};
	this.save = function () {
		var sysname = document.getElementById('create-sysname').value.split(" ");
		var myData = [];
		for (var v in sysname) {
			myData.push({"sysname":sysname[v]});
		}
		var myData = JSON.stringify(myData);
		$.ajax({
			type: "POST",
			url: "/api/write/switches",
			dataType: "text",
			data:myData,
			success: function (data, textStatus, jqXHR) {
				var result = JSON.parse(data);
				if(result.switches_addded.length > 0) { // FIXME unresolved variable switches_addded
					nmsInfoBox.hide();
				}
				nmsData.invalidate("switches");
				nmsData.invalidate("smanagement");
			}
		});
	};
};
nmsInfoBox.addPanelType("switchAdd",switchAddPanel);

/*
 * Panel type: Inventory listing
 *
 * Displays a filterable table with switch data, based on a selected mode
 *
 * TODO:
 * - Add support for multiple columns with data
 * - Add sorting
 * - Add live filtering
 * - Add export options?
 *
 */
var inventoryListingPanel = function() {
	nmsInfoPanel.call(this,"inventoryListing");
	this.filter = "";
	this.init = function (mode) {
		if(!nmsData.snmp || !nmsData.snmp.snmp) {
			if(!this.hasHandler("snmp")) {
				this.addHandler("snmp","init");
				this._renderError("Waiting for SNMP data.");
			}
			return;
		} else {
			this.removeHandlers();
			if(!!mode && this.mode == "initial")
				this.setMode(mode);
			this.refresh("init");
		}
	};
	this.setFilter = function (filter) {
		this.filter = filter;
		this.refresh();
	};
	this.refresh = function (reason) {
		var targetArray = [];
		var listTitle = '';
		var contentObj = document.createElement("div");
		var inputObj = document.createElement("div");
		inputObj.innerHTML = '<div class="input-group"><input type="text" class="form-control" placeholder="Filter" id="inventorylisting-filter" value="' + this.filter + '" onkeyup="if (event.keyCode == 13) {nmsInfoBox._windowHandler.doInPanel(\'' + this.id + '\',\'setFilter\',document.getElementById(\'inventorylisting-filter\').value);}"><span class=\"input-group-btn\"><button class="btn btn-default" onclick="nmsInfoBox._windowHandler.doInPanel(\'' + this.id + '\',\'setFilter\',document.getElementById(\'inventorylisting-filter\').value);">Filtrer</button></span></div>';
		contentObj.appendChild(inputObj);

		switch (this.mode) {
			case 'distro_name':
				listTitle = 'Distro names';
				break;
			case 'sysDescr':
				listTitle = 'System description';
				break;
			case 'jnxBoxSerialNo':
				listTitle = 'Serial Numbers';
				break;
			case 'transceiver':
				listTitle = 'Transceivers';
				break;
			default:
				listTitle = 'Distro names';
		}

		var resultArray = [];
		for(var sw in nmsData.switches.switches) {
			var value = '';
			if(this.filter != '') {
				if(sw.toLowerCase().indexOf(this.filter) == -1 && !nmsSearch.searchTest(this.filter,sw))
					continue;
			}
			try {
				switch (this.mode) {
					case 'distro_name':
						value = nmsData.switches.switches[sw]["distro_name"];
						resultArray.push([sw, value]);	
						break;
					case 'sysDescr':
						value = nmsData.snmp.snmp[sw]["misc"]["sysDescr"][0];
						resultArray.push([sw, value]);
						break;
					case 'jnxBoxSerialNo':
						if(testTree(nmsData,["snmp","snmp",sw,"misc","entPhysicalSerialNum"])) {
							for (var x in nmsData.snmp.snmp[sw]["misc"]["entPhysicalSerialNum"]) {
								value = "misc" + x + ":" + nmsData.snmp.snmp[sw]["misc"]["entPhysicalSerialNum"][x];
								var entPhysicalDescr = nmsData.snmp.snmp[sw]["misc"]["entPhysicalDescr"][x]; 
								resultArray.push([sw, entPhysicalDescr+': '+value]);
							}
						}
						if (testTree(nmsData,["snmp","snmp",sw,"misc","jnxVirtualChassisMemberSerialnumber"])) {
							for (var x in nmsData.snmp.snmp[sw]["misc"]["jnxVirtualChassisMemberSerialnumber"]) {
								value = "member " + x + ":" + nmsData.snmp.snmp[sw]["misc"]["jnxVirtualChassisMemberSerialnumber"][x];
								resultArray.push([sw, value]);
							}
						}
						value = nmsData.snmp.snmp[sw]["misc"]["jnxBoxSerialNo"][0];
						resultArray.push([sw, value]);
						break;
					case 'transceiver':
                                                if(testTree(nmsData,["snmp","snmp",sw,"misc","entPhysicalSerialNum"])) {
                                                        for (var x in nmsData.snmp.snmp[sw]["misc"]["entPhysicalSerialNum"]) {
								var entPhysicalDescr = nmsData.snmp.snmp[sw]["misc"]["entPhysicalDescr"][x];
								if(!entPhysicalDescr.match(/^SFP/)) {
									continue;
								}
                                                                value = entPhysicalDescr  + ": " + nmsData.snmp.snmp[sw]["misc"]["entPhysicalSerialNum"][x];
								resultArray.push([sw, entPhysicalDescr+': '+value]);
                                                        }
                                                }
                                                break;

				}
			} catch (e) {console.log("sw: " + sw); console.log(e);}
		}

		resultArray.sort();

		var infotable = nmsInfoBox._makeTable(resultArray,listTitle);
		infotable.id = "inventory-table";

		contentObj.appendChild(infotable);
		this._render(contentObj);
	};
};

nmsInfoBox.addPanelType("inventoryListing",inventoryListingPanel);

/*
 * Panel type: Edit switch
 *
 * Lets you edit basic switch and switch management data through the switch-update api
 *
 */
var switchEditPanel = function () {
	nmsInfoPanel.call(this,"switchEdit");
	this.refresh = function (reason) {
		if (this.box) { return; }
		this.box = new nmsModSwitch(this.sw);
		this.box.attach(this.me)
		this.box.show()
	};

};
nmsInfoBox.addPanelType("switchEdit",switchEditPanel);

/*
 * Panel type: Switch comments
 *
 * Displays the current comments and lets you interact with them or add new ones
 *
 */
var switchCommentsPanel = function () {
	nmsInfoPanel.call(this,"switchComments");
	this.commentsHash = false;
	this.refresh = function (reason) {
		var domObj = document.createElement("div");
		var comments = [];
		var logs = nmsOplog.getSwitchLogs(this.sw);
		var table = document.createElement("table");
		var tr;
		var td1;
		var td2;
		var td3;
		table.className = "table";
		table.classList.add("table");
		table.classList.add("table-condensed");
		var cap = document.createElement("caption");
		cap.textContent = "Relevant log entries";
		table.appendChild(cap);
		for (var v in logs) {
			tr = table.insertRow(-1);
			tr.className =
				td1 = tr.insertCell(0);
			td2 = tr.insertCell(1);
			var date = new Date(logs[v]['timestamp']);
			var month = date.getMonth() + 1;
			var day = date.getDate();
			var tmp = (date.getYear() + 1900) + "-" + (month < 10 ? "0": "") + month + "-" + (day < 10 ? "0" : "") + day + " " + date.toTimeString().replace(/:\d\d .*$/,"");
			td1.textContent = tmp;
			td1.classList.add("left");
			td2.textContent = logs[v]['systems'] + "[" + logs[v]['username'] + "] " + logs[v]['log'];
		}
		domObj.appendChild(table);
		this._render(domObj);
	};
};
nmsInfoBox.addPanelType("switchComments",switchCommentsPanel);

/*
 * Panel type: Switch latency
 *
 * Display a live line chart with latency
 *
 */
var switchLatencyPanel = function() {
	nmsInfoPanel.call(this,"switchLatency");	
	var latencyChart;
        this.init = function() {
                this.addHandler("ticker");
                this.refresh();
        };
	this.refresh = function(reason) {
		if (this.sw == false) {
                        console.log("ugh, cleanup failed?");
                        return;
                }

		if(reason == 'handler-ticker' && latencyChart != undefined) {
			drawLatency(this.sw+'latency_chart',this.sw, latencyChart);
			return;
		}

		var topper = document.createElement("div");
                var latency = document.createElement("canvas");
                latency.id = this.sw+'latency_chart';
                latency.width = 500;
                latency.height = 250;
                drawLatency(this.sw+'latency_chart',this.sw, false, function(chart) { latencyChart = chart; });
                topper.appendChild(latency);
                this._render(topper);
	};
};
nmsInfoBox.addPanelType("switchLatency",switchLatencyPanel);

/*
 * Panel type: Switch summary
 *
 * Display a live summary of key metrics
 *
 */
var switchSummaryPanel = function() {
	nmsInfoPanel.call(this,"switchSummary");
	var latencyChart;
	this.init = function() {
		this.addHandler("ticker");
		this.refresh();
	};
	this.refresh = function(reason) {
		var content = [];
		if (this.sw == false) {
			console.log("ugh, cleanup failed?");
			return;
		}
		var topper = document.createElement("div");
		for ( var h in handlers ) {
			if (handlers[h].getInfo != undefined) {
				var tmp = handlers[h].getInfo(this.sw);
				for (var x in tmp.data) {
					if (tmp.data[x].value != undefined) {
						var d = "<div class=\"clickable\" onclick='nmsInfoBox.setLegendPick(\""+ handlers[h].tag + "\", " + x + ");'>" + tmp.data[x].value + '</div>';
						content.push([tmp.data[x].description, d]);
					}
				}
			}
		}

		var contentCleaned = [];
		for(var i in content) {
			if(content[i][1] == '' || content[i][1] == null)
				continue;
			contentCleaned.push(content[i]);
		}
		var table = nmsInfoBox._makeTable(contentCleaned);
		topper.appendChild(table);

		this._render(topper);
	};
};
nmsInfoBox.setLegendPick = function(tag,id) {
	if (nms.legendPick != undefined) {
		if (nms.legendPick.handler == tag && nms.legendPick.idx == id) {
			nms.legendPick = undefined;
			return;
		}
	}
	nms.legendPick = {handler: tag, idx: id};
}

nmsInfoBox.addPanelType("switchSummary",switchSummaryPanel);

var switchLinks = function() {
	nmsInfoPanel.call(this,"switchLinks");
	var latencyChart;
	this.init = function() {
		this.refresh();
	};
	this.refresh = function(reason) {
		var content = [];
		if (this.sw == false) {
			console.log("ugh, cleanup failed?");
			return;
		}
		var sw = this.sw;
		
		var topp = document.createElement("div")
		var urls = [ "https://gondul.tg.lol/api/templates/magic.conf/switch=" + sw,
			     "http://185.110.148.5/api/templates/magic.conf/switch=" + sw,
			     "http://gondul.tg.lol/api/templates/magic.conf/switch=" + sw ];
		if (testTree(nmsData,['smanagement','switches',sw])) {
			var mg = nmsData["smanagement"]["switches"][sw];
			urls.push("ssh://[" + mg.mgmt_v6_addr + "]");
			urls.push("ssh://" + mg.mgmt_v4_addr);
		}
		for (var x in urls) {
			topp.appendChild(document.createElement("br"));
			var link = document.createElement("a");
			link.href = urls[x];
			link.textContent = urls[x];
			topp.appendChild(link);
		}
		this._render(topp);
	};
};
nmsInfoBox.addPanelType("switchLinks",switchLinks);
/*
* Panel type: Add network
*
* Lets you add a new network using the network-add api
*
*/
var networkAddPanel = function() {
	nmsInfoPanel.call(this,"networkAdd");
	this.refresh = function(reason) {
		var domObj = document.createElement("div");
		domObj.innerHTML = '<input type="text" class="form-control" id="create-network-name" placeholder="Space-seaprated list of networks"><button class="btn btn-default" onclick="nmsInfoBox._windowHandler.doInPanel(\'' + this.id +'\',\'save\');">Add network</button>'
		this._render(domObj);
	};
	this.save = function () {
		var name = document.getElementById('create-network-name').value.split(" ");
		var myData = [];
		for (var v in name) {
			myData.push({"name":name[v]});
		}
		var myData = JSON.stringify(myData);
		$.ajax({
			type: "POST",
			url: "/api/write/networks",
			dataType: "text",
			data:myData,
			success: function (data, textStatus, jqXHR) {
				var result = JSON.parse(data);
				if(result.networks_added.length > 0) { // FIXME unresolved variable switches_addded
					nmsInfoBox.hide();
				}
				nmsData.invalidate("switches");
				nmsData.invalidate("smanagement");
				nmsData.invalidate("networks");
			}
		});
	};
};
nmsInfoBox.addPanelType("networkAdd",networkAddPanel);

/*
* List networks
*
* Shows all networks
*
*/
var networkListPanel = function() {
	nmsInfoPanel.call(this,"listNetworks");
	this.refresh = function(reason) {
		var collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
		var networks = nmsData.networks.networks;
		var table = document.createElement('table');
		table.className = "table table-condensed";
		table.id = "searchResults-table"
		for (var net in networks) {
			var row = table.insertRow(net);
			var cell1 = row.insertCell(0);
			var cell2 = row.insertCell(1);
			var cell3 = row.insertCell(2);
			cell1.innerHTML = "<a href='#' onclick='nmsInfoBox.showWindow(\"networkInfo\",\""+net+"\");'>"+net+ '</a>';
			cell2.innerHTML = networks[net].vlan;
			cell3.innerHTML = networks[net].router;
		}
		this._render(table);

	};
};
nmsInfoBox.addPanelType("listNetworks",networkListPanel);

/*
* Panel type: Network summary
*
* Display a summary
*
*/
var networkSummaryPanel = function() {
	nmsInfoPanel.call(this,"networkSummary");
	this.refresh = function(reason) {
		var network = this.sw;

	};
}
nmsInfoBox.addPanelType("networkSummary",networkSummaryPanel);

/*
* Panel type: Edit networki
*
*  Lets you edit basic networks data through the network-update api
*
*/
var networkEditPanel = function() {
	nmsInfoPanel.call(this,"networkEdit");
	this.refresh = function(reason) {
		var net = [];
		try {
			net = nmsData.networks.networks[this.sw];
		} catch(e) {}


		var domObj = document.createElement("div");
		var template = {};

		nmsInfoBox._editValues = {};
		var place;
		var tags;
		for (var v in net) {
			/*
			* Tags needs to be sent and edited
			* as plain JSON...
			*/
			if (v == "tags") {
				tags = JSON.stringify(net[v]);
				template[v] = tags;
				continue;
			}
			template[v] = nmsInfoBox._nullBlank(net[v]);
		}
		var content = [];
		for (v in template) {
			var tmpsw = '\'' + this.sw + '\'';
			var tmpv = '\'' + v + '\'';
			var tmphandler = '"nmsInfoBox._editChange(' + tmpsw + ',' + tmpv + ');"';
			var html = '<input type="text" class="form-control" value="' + template[v] + '" id="edit-' + this.sw + '-' + v + '" onchange=' + tmphandler + ' oninput=' + tmphandler + ' ' + (v == 'name' ? "readonly" : "") + '>';
			if (v == "placement") {
				v = "placement <a onclick='var _x = document.getElementById(\"edit-" + this.sw + "-placement\"); _x.value = \"\\\"reset\\\"\"; _x.oninput();' class='pull-right'>Reset</a>";
			}
			content.push([v, html]);
		}

		content.sort();

		var table = nmsInfoBox._makeTable(content);
		domObj.appendChild(table);

		var outputCont = document.createElement("div");
		outputCont.id = "edit-output-cont";
		outputCont.classList.add("collapse");
		outputCont.innerHTML = "<h5>Request preview</h5>";
		var output = document.createElement("output");
		output.id = "edit-output";
		outputCont.appendChild(output);
		domObj.appendChild(outputCont);

		var nav = document.createElement("nav");
		nav.classList.add("nav","nav-pills");

		var submit = document.createElement("button");
		submit.innerHTML = "Save changes";
		submit.classList.add("btn", "btn-primary");
		submit.id = "edit-submit-" + this.sw;
		submit.setAttribute("onclick","nmsInfoBox._windowHandler.doInPanel('" + this.id + "','save');");
		nav.appendChild(submit);

		var toggleDetails = document.createElement("button");
		toggleDetails.innerHTML = '<span class="glyphicon glyphicon-menu-hamburger" aria-hidden="true"></span>';
		toggleDetails.classList.add("btn", "btn-default", "pull-right");
		toggleDetails.dataset.toggle = "collapse";
		toggleDetails.dataset.target = "#edit-output-cont";
		toggleDetails.title = "Show request preview";
		toggleDetails.id = "edit-toggle-details-" + this.sw;
		nav.appendChild(toggleDetails);

		domObj.appendChild(nav);

		this._render(domObj);
		if (place) {
			var pval = document.getElementById("edit-" + this.sw + "-placement");
			if (pval) {
				pval.value = place;
			}
		}
		if (tags) {
			var ptags = document.getElementById("edit-" + this.sw + "-tags");
			if (ptags) {
				ptags.value = tags;
			}
		}

	};
	this.save = function () {
		var myData = nmsInfoBox._editStringify(this.sw,"name");
		$.ajax({
			type: "POST",
			url: "/api/write/networks",
			dataType: "text",
			data:myData,
			success: function (data, textStatus, jqXHR) {
				var result = JSON.parse(data);
				if(result.switches_updated.length > 0) { // FIXME unresolved variable switches_addded
					nmsInfoBox.hide();
				}
				nmsData.invalidate("switches");
				nmsData.invalidate("networks");
				nmsData.invalidate("smanagement");
			}
		});
	};
};
nmsInfoBox.addPanelType("networkEdit",networkEditPanel);


/*
 * General-purpose table-maker?
 *
 * Takes an array of arrays as input, and an optional caption.
 *
 * E.g.: _makeTable([["name","Kjell"],["Age","five"]], "Age list");
 */
nmsInfoBox._makeTable = function(content, caption) {
	var table = document.createElement("table");
	var tr;
	var td1;
	var td2;
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
		tr.className = content[v][0].toLowerCase().replace(/[^a-z0-9_]/g,"");
		td1 = tr.insertCell(0);
		td1.classList.add("left");
		td2 = tr.insertCell(1);
		td1.innerHTML = content[v][0];
		td2.innerHTML = content[v][1];
	}
	return table;
};

nmsInfoBox._nullBlank = function(x) {
	if (x == null || x == false || x == undefined)
		return "";
	return x;
};

/*
 * Provide common defaults for graph renders.
 *
 * Kept on the URL to avoid having to manage templates since we need to
 * manage night mode anyway for now.
 */
nmsInfoBox._graphZoom = function() {
	if (nmsInfoBox._graphFrom == "-60min") {
		nmsInfoBox._graphFrom = "-6h";
	} else if (nmsInfoBox._graphFrom == "-6h") {
		nmsInfoBox._graphFrom = "-24h";
	} else if (nmsInfoBox._graphFrom == "-24h") {
		nmsInfoBox._graphFrom = "-7days";
	} else {
		nmsInfoBox._graphFrom = "-60min";
	}


}
nmsInfoBox._graphFrom = "-60min";
nmsInfoBox._graphUntil = "now";
nmsInfoBox._graphNormalize = function(f) {
	return f.replace(/[^a-z0-9]/gi,"_");
}
nmsInfoBox._graphDefaults = function(title) {
	if (title != undefined) {
		title = "From " + nmsInfoBox._graphFrom + " until " + nmsInfoBox._graphUntil + " (" + title + ")";
	} else {
		title = "From " + nmsInfoBox._graphFrom + " until " + nmsInfoBox._graphUntil;
	}
	var base = "&yMinLeft=0&yMinRight=0&yMin=0&bgcolor=%23ffffff00&fontName=courier&width=600&height=240&yUnitSystem=binary&format=svg&from=" + nmsInfoBox._graphFrom + "&until=" + nmsInfoBox._graphUntil + '&title=' + title + "&lolBuster=" + Math.floor(new Date().getTime() / 30000);
	if (nms.nightMode) {
		return "&fgcolor=%23dddddd&minorGridLineColor=%233d3d3d&majorGridLineColor=%23666666" + base;
	} else {
		return base;
	}
}

nmsInfoBox._editChange = function(sw, v) {
	var el = document.getElementById("edit-" + sw + "-" + v);
	var val = el.value;
	if (v == "placement") {
		try {
			val = JSON.parse(val);
			el.parentElement.classList.remove("has-error");
			el.parentElement.classList.add("has-success");
		} catch (e) {
			el.parentElement.classList.add("has-error");
			return;
		}
	}
	nmsInfoBox._editValues[v] = val;
	el.classList.add("has-warning");
	var myData = nmsInfoBox._editStringify(sw);
	var out = document.getElementById("edit-output");
	out.value = myData;
};

nmsInfoBox._editStringify = function(sw, sysname='sysname') {
	nmsInfoBox._editValues[sysname] = sw;
	return JSON.stringify([nmsInfoBox._editValues]);
};
