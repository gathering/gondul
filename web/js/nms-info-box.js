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
 * - Possibly: Comment CRUD, did not want to test writes on our "historic db copy"
 * - Comments popover
 * - Handler unloading is not working correctly, and many are never removed
 * - SSH-management link, this should propably be a custom "view" of sorts
 * - inventoryListing window is partially broken when first opened. Since it's
 *   both a window type and a panel with different modes it has some conflicts.
 *
 * General TODO:
 * - Fix broken stuff
 * - Test comments
 * - Add external windows (timetravel, etc)
 * - Take a critical look at what methods/variables should be marked as "_"
 * - Currently argument is assumed to be a switch, this should not be the case
 * - Add some basic styling to separate panels visually when in the same view
 * - Add some movement/placement/size options to info window
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
				'name': 'Switch summary',
				'panels': ['switchComments','switchSummary']
			},
			'details': {
				'name': 'Switch details',
				'panels': ['switchDetails']
			},
			'ports': {
				'name': 'SNMP - Ports',
				'panels': ['switchSNMP:ports']
			},
			'misc': {
				'name': 'SNMP - Misc',
				'panels': ['switchSNMP:misc']
			},
			'comments': {
				'name': 'Comments',
				'panels': ['switchComments']
			},
			'edit': {
				'name': 'Edit',
				'panels': ['switchEdit']
			}
		}
	},
	{
		'id': 'addSwitch',
		'title': 'Add new switch',
		'views': {
			'initial': {
				'name': 'Add switch',
				'panels': ['switchAdd']
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
			}
		}
	}
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
	this._windowHandler.hide();
	this._windowHandler.unloadWindow();
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
 * window handler only makes shure these panels are loaded and unloaded when
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
		this.showTitle(this._window.title);
		this.showView();
		this.show();
	};
	this.showView = function (viewId) {
		if(!viewId || viewId == '')
			viewId = "initial";
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
		this.sw = false;
		this.container = false;
		this.me = false;
		this.id = false;
		this.removeHandlers();
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
		this.addHandler("snmp");
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
			groupObj.classList.add("panel","panel-default");
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

/*
 * Panel type: Switch details
 *
 * Displays a table of switch information
 *
 */
var switchDetailsPanel = function() {
	nmsInfoPanel.call(this,"switchDetails");
	this.refresh = function(reason) {
		var swi = [];
		var swm = [];
		try {
			swi = nmsData.switches["switches"][this.sw];
		} catch(e) {}
		try {
			swm = nmsData.smanagement.switches[this.sw];
		} catch(e) {}

		var content = [];

		for (var v in swi) {
			if (v == "placement") {
				var place = JSON.stringify(swi[v]);
				content.push([v,place]);
				continue;
			}
			content.push([v, swi[v]]);
		}

		for (var v in swm) {
			content.push([v, swm[v]]);
		}
		content.sort();

		var infotable = nmsInfoBox._makeTable(content);

		this._render(infotable);
	};
};
nmsInfoBox.addPanelType("switchDetails",switchDetailsPanel);

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
		domObj.innerHTML = '<input type="text" class="form-control" id="create-sysname" placeholder="Sysname id"><button class="btn btn-default" onclick="nmsInfoBox._windowHandler.doInPanel(\'' + this.id +'\',\'save\');">Add switch</button>'
		this._render(domObj);
	};
	this.save = function () {
		var sysname = document.getElementById('create-sysname').value;
		var myData = JSON.stringify([{'sysname':sysname}]);
		$.ajax({
			type: "POST",
			url: "/api/write/switch-add",
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
			default:
				listTitle = 'Distro names';
		}

		var resultArray = [];
		for(var sw in nmsData.switches.switches) {
			var value = '';
			if(this.filter != '') {
				if(sw.toLowerCase().indexOf(this.filter) == -1 && !nmsInfoBox._searchSmart(this.filter,sw))
					continue;
			}
			try {
				switch (this.mode) {
					case 'distro_name':
						value = nmsData.switches.switches[sw]["distro_name"];
						break;
					case 'sysDescr':
						value = nmsData.snmp.snmp[sw]["misc"]["sysDescr"][0];
						break;
					case 'jnxBoxSerialNo':
						value = nmsData.snmp.snmp[sw]["misc"]["jnxBoxSerialNo"][0];
						break;
				}
			} catch (e) {}
			resultArray.push([sw, value]);
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
		var swi = [];
		var swm = [];
		try {
			swi = nmsData.switches["switches"][this.sw];
		} catch(e) {}
		try {
			swm = nmsData.smanagement.switches[this.sw];
		} catch(e) {}

		var domObj = document.createElement("div");
		var template = {};

		nmsInfoBox._editValues = {};
		var place;
		for (var v in swi) {
			if (v == "placement") {
				place = JSON.stringify(swi[v]);
				template[v] = place;
				continue;
			}
			template[v] = nmsInfoBox._nullBlank(swi[v]);
		}
		for (var v in swm) {
			template[v] = nmsInfoBox._nullBlank(swm[v]);
		}
		var content = [];
		for (v in template) {
			var tmpsw = '\'' + this.sw + '\'';
			var tmpv = '\'' + v + '\'';
			var tmphandler = '"nmsInfoBox._editChange(' + tmpsw + ',' + tmpv + ');"';
			var html = '<input type="text" class="form-control" value="' + template[v] + '" id="edit-' + this.sw + '-' + v + '" onchange=' + tmphandler + ' oninput=' + tmphandler + '>';
			content.push([v, html]);
		}

		content.sort();

		var table = nmsInfoBox._makeTable(content, "edit");
		domObj.appendChild(table);

		var submit = document.createElement("button");
		submit.innerHTML = "Save changes";
		submit.classList.add("btn", "btn-primary");
		submit.id = "edit-submit-" + this.sw;
		submit.setAttribute("onclick","nmsInfoBox._windowHandler.doInPanel('" + this.id + "','save');");
		domObj.appendChild(submit);

		var output = document.createElement("output");
		output.id = "edit-output";
		domObj.appendChild(output);

		if (place) {
			var pval = document.getElementById("edit-" + this.sw + "-placement");
			if (pval) {
				pval.value = place;
			}
		}

		this._render(domObj);
	};
	this.save = function () {
		var myData = nmsInfoBox._editStringify(this.sw);
		$.ajax({
			type: "POST",
			url: "/api/write/switch-update",
			dataType: "text",
			data:myData,
			success: function (data, textStatus, jqXHR) {
				var result = JSON.parse(data);
				if(result.switches_updated.length > 0) { // FIXME unresolved variable switches_addded
					nmsInfoBox.hide();
				}
				nmsData.invalidate("switches");
				nmsData.invalidate("smanagement");
			}
		});
	};
};
nmsInfoBox.addPanelType("switchEdit",switchEditPanel);

/*
 * Panel type: Switch comments
 *
 * Displays the current comments and lets you interact with them or add new ones
 *
 * TODO: Test with a dummy-db to make sure everything still works properly
 *
 */
var switchCommentsPanel = function () {
	nmsInfoPanel.call(this,"switchComments");
	this.commentsHash = false;
	this.refresh = function (reason) {
		var domObj = document.createElement("div");
		var comments = [];

		var commentbox = document.createElement("div");
		commentbox.id = "commentbox";
		commentbox.className = "panel-body";
		commentbox.style.width = "100%";
		commentbox.innerHTML = '<div class="input-group"><input type="text" class="form-control" placeholder="Comment" id="' + this.sw + '-comment"><span class=\"input-group-btn\"><button class="btn btn-default" onclick="addComment(\'' + this.sw + '\',document.getElementById(\'' + this.sw + '-comment\').value); document.getElementById(\'' + this.sw + '-comment\').value = \'\'; document.getElementById(\'' + this.sw + '-comment\').placeholder = \'Comment added. Wait for next refresh.\';">Add comment</button></span></div>';

		// We have data
		if(!(!nmsData.comments || !nmsData.comments.comments)) {
			this.commentsHash = nmsData.comments.hash;

			// We have data for this switch
			if(nmsData.comments.comments[this.sw]) {
				this.commentsHash = nmsData.comments.hash;
				for (var c in nmsData.comments.comments[this.sw]["comments"]) {
					var comment = nmsData.comments.comments[this.sw]["comments"][c];
					if (comment["state"] == "active" || comment["state"] == "persist" || comment["state"] == "inactive") {
						comments.push(comment);
					}
				}

				if (comments.length > 0) {
					var commenttable = nmsInfoBox._makeCommentTable(comments);
					commenttable.id = "info-switch-comments-table";
					domObj.appendChild(commenttable);
				}

			}
		}

		domObj.appendChild(commentbox);
		this._render(domObj);
	};
};
nmsInfoBox.addPanelType("switchComments",switchCommentsPanel);

/*
 * Panel type: Switch summary
 *
 * Display a live summary of key metrics
 *
 */
var switchSummaryPanel = function() {
	nmsInfoPanel.call(this,"switchSummary");
	this.init = function() {
		this.addHandler("ticker");
		this.refresh();
	};
	this.refresh = function(reason) {
		var content = [];

		//Get DHCP info
		var lastDhcp = undefined;
		try {
			var tempDhcp = nmsData.dhcp.dhcp[this.sw];
			var now = Date.now();
			now = Math.floor(now / 1000);
			tempDhcp = now - parseInt(tempDhcp);
			tempDhcp = tempDhcp + " s";
		} catch(e) {}

		//Get SNMP status
		var snmpStatus = undefined;
		try {
			if (nmsData.snmp.snmp[this.sw].misc.sysName[0] != sw) {
				snmpStatus = "Sysname mismatch";
			} else {
				snmpStatus = "OK";
			}
		} catch(e) {}

		//Get CPU usage
		var cpuUsage = undefined;
		try {
			var cpu = 0;
			for (var u in nmsData.snmp.snmp[this.sw].misc.jnxOperatingCPU) {
				var local = nmsData.snmp.snmp[this.sw].misc['jnxOperatingCPU'][u];
				cpu = Math.max(nmsData.snmp.snmp[this.sw].misc.jnxOperatingCPU[u],cpu);
			}
			cpuUsage = cpu + " %";
		} catch (e) {}

		//Get traffic data
		var uplinkTraffic = undefined;
		try {
			var speed = 0;
			var t = parseInt(nmsData.switchstate.then[this.sw].uplinks.ifHCOutOctets);
			var n = parseInt(nmsData.switchstate.switches[this.sw].uplinks.ifHCOutOctets);
			var tt = parseInt(nmsData.switchstate.then[this.sw].time);
			var nt = parseInt(nmsData.switchstate.switches[this.sw].time);
			var tdiff = nt - tt;
			var diff = n - t;
			speed = diff / tdiff;
			if(!isNaN(speed)) {
				uplinkTraffic = byteCount(speed*8,0);
			}
		} catch (e) {};

		//Get uptime data
		var uptime = "";
		try {
			uptime = nmsData.snmp.snmp[this.sw]["misc"]["sysUpTimeInstance"][""] / 60 / 60 / 100;
			uptime = Math.floor(uptime) + " t";
		} catch(e) {}

		//Get temperature data
		var temp = "";
		try {
			temp = nmsData.switchstate.switches[this.sw].temp + " °C";
		} catch(e) {}

		//Get management data
		var mgmtV4 = "";
		var mgmtV6 = "";
		var subnetV4 = "";
		var subnetV6 = "";
		try {
			mgmtV4 = nmsData.smanagement.switches[this.sw].mgmt_v4_addr;
			mgmtV6 = nmsData.smanagement.switches[this.sw].mgmt_v6_addr;
			subnetV4 = nmsData.smanagement.switches[this.sw].subnet4;
			subnetV6 = nmsData.smanagement.switches[this.sw].subnet6;
		} catch(e) {}

		//Get ping data
		var ping = undefined;
		try {
			nmsData.ping.switches[this.sw].latency + " ms";
		} catch (e) {}


		content.push(["Ping latency:",ping]);
		content.push(["Last DHCP lease:",lastDhcp]);
		content.push(["SNMP status:",snmpStatus]);
		content.push(["CPU usage:",cpuUsage]);
		content.push(["Uplink traffic:",uplinkTraffic]);
		content.push(["System uptime:",uptime]);
		content.push(["Temperature",temp]);
		content.push(["Management (v4):",mgmtV4]);
		content.push(["Management (v6):",mgmtV6]);
		content.push(["Subnet (v4):",subnetV4]);
		content.push(["Subnet (v6):",subnetV6]);

		var contentCleaned = [];
		for(var i in content) {
			if(content[i][1] == '' || content[i][1] == null)
				continue;
			if(content[i][1] == undefined || content[i][1])
				content[i][1] == "No data";
			contentCleaned.push(content[i]);
		}

		var table = nmsInfoBox._makeTable(contentCleaned);

		this._render(table);
	};
};
nmsInfoBox.addPanelType("switchSummary",switchSummaryPanel);

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
		tr.className = content[v][0].toLowerCase();
		td1 = tr.insertCell(0);
		td2 = tr.insertCell(1);
		td1.innerHTML = content[v][0];
		td2.innerHTML = content[v][1];
	}
	return table;
};

/*
 * Create and return a table for comments.
 *
 * Input is an array of comments.
 */
nmsInfoBox._makeCommentTable = function(content) {
	var table = document.createElement("table");
	table.className = "table";
	table.classList.add("table");
	table.classList.add("table-condensed");
	var cap = document.createElement("caption");
	cap.textContent = "Comments"
	table.appendChild(cap);
	for (var commentid in content) {
		var tr;
		var td1;
		var td2;
		var comment = content[commentid];
		var col;
		if (comment["state"] == "active")
			col = "danger";
		else if (comment["state"] == "inactive")
			col = false;
		else
			col = "info";
		tr = table.insertRow(-1);
		tr.id = "commentRow" + comment["id"];
		tr.className = col;

		td1 = tr.insertCell(0);
		td1.style.whiteSpace = "nowrap";
		td1.style.width = "8em";
		td2 = tr.insertCell(1);
		var txt =  '<div class="btn-group" role="group" aria-label="..."><button type="button" class="btn btn-xs btn-default" data-trigger="focus" data-toggle="popover" title="Info" data-content="Comment added ' + comment["time"] + " by user " + comment["username"] + ' and listed as ' + comment["state"] + '"><span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span></button>';
		txt += '<button type="button" class="btn btn-xs btn-danger" data-trigger="focus" data-toggle="tooltip" title="Mark as deleted" onclick="commentDelete(' + comment["id"] + ');"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button>';
		txt += '<button type="button" class="btn btn-xs btn-success" data-trigger="focus" data-toggle="tooltip" title="Mark as inactive/fixed" onclick="commentInactive(' + comment["id"] + ');"><span class="glyphicon glyphicon-ok" aria-hidden="true"></span></button>';
		txt += '<button type="button" class="btn btn-xs btn-info" data-trigger="focus" data-toggle="tooltip" title="Mark as persistent" onclick="commentPersist(' + comment["id"] + ');"><span class="glyphicon glyphicon-star" aria-hidden="true"></span></button></div>';
		td1.innerHTML = txt;
		td2.innerHTML = comment["comment"];
	}
	return table;
};

nmsInfoBox._searchSmart = function(id, sw) {
	try {
		try {
			if (nmsData.switches.switches[sw].distro_name.toLowerCase() == id) {
				return true;
			}
		} catch (e) {}
		try {
		if (id.match("active")) {
			var limit = id;
			limit = limit.replace("active>","");
			limit = limit.replace("active<","");
			limit = limit.replace("active=","");
			var operator = id.replace("active","")[0];
			if (limit == parseInt(limit)) {
				var ports = parseInt(nmsData.switchstate.switches[sw].ifs.ge.live);
				limit = parseInt(limit);
				if (operator == ">" ) {
					if (ports > limit) {
						return true;
					}
				} else if (operator == "<") {
					if (ports < limit) {
						return true;
					}
				} else if (operator == "=") {
					if (ports == limit) {
						return true;
					}
				}
			}
		}
		} catch (e) {}
		try {
			if (nmsData.smanagement.switches[sw].mgmt_v4_addr.match(id)) {
				return true;
			}
			if (nmsData.smanagement.switches[sw].mgmt_v6_addr.match(id)) {
				return true;
			}
		} catch (e) {}
		try {
			if (nmsData.smanagement.switches[sw].subnet4.match(id)) {
				return true;
			}
			if (nmsData.smanagement.switches[sw].subnet6.match(id)) {
				return true;
			}
		} catch (e) {}
		if (nmsData.snmp.snmp[sw].misc.sysDescr[0].toLowerCase().match(id)) {
			return true;
		}
	} catch (e) {
		return false;
	}
	return false;
};

/*
 * FIXME: Not sure this belongs here, it's really part of the "Core" ui,
 * not just the infobox.
 */
nmsInfoBox._search = function() {
	var el = document.getElementById("searchbox");
	var id = false;
	var matches = [];
	if (el) {
		id = el.value.toLowerCase();
	}
	if(id) {
		nmsMap.enableHighlights();
		for(var sw in nmsData.switches.switches) {
			if(sw.toLowerCase().indexOf(id) > -1) {
				matches.push(sw);
				nmsMap.setSwitchHighlight(sw,true);
			} else if (nmsInfoBox._searchSmart(id,sw)) {
				matches.push(sw);
				nmsMap.setSwitchHighlight(sw,true);
			} else {
				nmsMap.setSwitchHighlight(sw,false);
			}
		}
	} else {
		nmsMap.disableHighlights();
	}
	if(matches.length == 1) {
		document.getElementById("searchbox-submit").classList.add("btn-primary");
		document.getElementById("searchbox").dataset.match = matches[0];
	} else {
		document.getElementById("searchbox-submit").classList.remove("btn-primary");
		document.getElementById("searchbox").dataset.match = '';
	}
};

nmsInfoBox._searchKeyListener = function(e) {
	switch (e.keyCode) {
		case 13:
			var sw = document.getElementById("searchbox").dataset.match;
			if(sw != '') {
				nmsInfoBox.showWindow("switchInfo",sw);
			}
			break;
		case 27:
			document.getElementById("searchbox").dataset.match = '';
			document.getElementById("searchbox").value = '';
			nmsInfoBox._search();
			nmsInfoBox.hide();
			break;
	}
};

nmsInfoBox._nullBlank = function(x) {
	if (x == null || x == false || x == undefined)
		return "";
	return x;
};

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

nmsInfoBox._editStringify = function(sw) {
	nmsInfoBox._editValues['sysname'] = sw;
	return JSON.stringify([nmsInfoBox._editValues]);
};
