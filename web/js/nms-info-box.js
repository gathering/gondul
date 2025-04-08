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
      id: "switchInfo",
      title: "Switch info",
      views: {
        initial: {
          name: "Summary",
          panels: ["switchLatency", "switchSummary", "switchLinks", "switchComments"],
          public: true,
        },
        ports: {
          name: "Ports",
          panels: ["switchPorts"],
        },
        misc: {
          name: "SNMP",
          panels: ["switchSNMP:misc"],
        },
        edit: {
          name: "Settings",
          panels: ["switchEdit"],
        },
      },
    },
    {
      id: "networkInfo",
      title: "Network info",
      views: {
        initial: {
          name: "Summary",
          panels: ["networkSummary"],
        },
        edit: {
          name: "Settings",
          panels: ["networkEdit"],
        },
      },
    },
    {
      id: "addSwitch",
      title: "Add new switch(es)",
      views: {
        initial: {
          name: "Add switch",
          panels: ["switchAdd"],
        },
      },
    },
    {
      id: "addNetwork",
      title: "Add new network(s)",
      views: {
        initial: {
          name: "Add network",
          panels: ["networkAdd"],
        },
      },
    },
    {
      id: "searchHelp",
      title: "Search help",
      views: {
        initial: {
          name: "Search help",
          panels: ["searchHelp"],
        },
      },
    },
    {
      id: "searchResults",
      title: "Search Results",
      views: {
        initial: {
          name: "Search Results",
          panels: ["searchResults"],
        },
      },
    },
    {
      id: "listNetwork",
      title: "Networks",
      views: {
        initial: {
          name: "List all networks",
          panels: ["listNetworks"],
        },
      },
    },
    {
      id: "debug",
      title: "Debug",
      views: {
        initial: {
          name: "Debug",
          panels: ["debugInfo"],
        },
        stats: {
          name: "Stats",
          panels: ["debugStats"],
        },
      },
    },
  ],
  _panelTypes: {}, //Populate by using the nmsInfoBox.addPanelType method
};

/*
 * Shows a window, and triggers initial load if needed
 */
nmsInfoBox.showWindow = function (windowName, argument) {
  if (windowName == "switchInfo" && argument != "" && argument == this._sw) {
    nmsInfoBox.hide();
    return;
  }

  if (!this._container) this._load();
  if (!windowName) windowName = "switchInfo";

  this._sw = argument;

  this._windowHandler.showWindow(windowName, argument);
};

/*
 * Internal function to load and register the initial html objects
 */
nmsInfoBox._load = function () {
  var modalBox = document.createElement("div");
  modalBox.classList.add("modal", "show");
  modalBox.style = "display: block;";
  // did not work
  // modalBox.setAttribute('data-bs-backdrop', "false");

  var dialogBox = document.createElement("div");
  dialogBox.classList.add(
    "modal-dialog",
    "modal-lg",
    "modal-dialog-scrollable"
  );

  var dialogContentBox = document.createElement("div");
  dialogContentBox.classList.add("modal-content");

  var dialogHeader = document.createElement("div");
  dialogHeader.classList.add("modal-header");

  modalBox.appendChild(dialogBox);

  dialogBox.appendChild(dialogContentBox);

  var title = document.createElement("div");
  title.id = "info-box-title";
  title.classList.add("modal-title");

  var nav = document.createElement("div");
  nav.id = "info-box-nav";

  var body = document.createElement("div");
  body.id = "info-box-body";
  body.classList.add("modal-body");

  var closeButton = document.createElement("button");
  // <button type="button" class="btn-close" data-bs-dismiss="modal" data-bs-target="#my-modal" aria-label="Close"></button>
  closeButton.classList.add("btn-close");
  closeButton.onclick = function () {
    nmsInfoBox.hide();
  };

  dialogContentBox.appendChild(dialogHeader);
  dialogContentBox.appendChild(body);
  dialogHeader.appendChild(title);
  dialogHeader.appendChild(nav);
  dialogHeader.appendChild(closeButton);

  this._container = document.getElementById("info-box-container");
  this._container.appendChild(modalBox);

  this._windowHandler = new windowHandler();
  this._windowHandler.setContainerObj(
    document.getElementById("info-box-container")
  );
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
nmsInfoBox.hide = function () {
  this._sw = false;
  if (
    this._windowHandler != undefined &&
    this._windowHandler.hide != undefined
  ) {
    this._windowHandler.hide();
    this._windowHandler.unloadWindow();
  }
};

/*
 * Click a switch and display it.
 */
nmsInfoBox.click = function (sw) {
  this.showWindow("switchInfo", sw);
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
    this.containerObj.classList.remove("d-none");
  };
  this.hide = function () {
    this.containerObj.classList.add("d-none");
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
    for (var i in windowTypes) {
      this.windowTypes[windowTypes[i].id] = windowTypes[i];
    }
  };
  this.setArgument = function (argument) {
    if (this.argument != argument) {
      this.argument = argument;
      this.showView(this._view);
    }
  };
  this.showPanel = function (panelName) {
    var panelArray = panelName.split(":");
    var panelName = panelArray[0];
    var panelMode = panelArray[1];
    if (this.panelTypes[panelName]) {
      var id = (Math.random().toString(36) + "00000000000000000").slice(
        2,
        10 + 2
      );
      var panel = new this.panelTypes[panelName]();
      panel.setId(id);
      if (!!panelMode) panel.setMode(panelMode);
      panel.load(this.bodyObj, this.argument);
      this._panels[id] = panel;
    }
  };
  this.showTitle = function (title) {
    this.titleObj.innerHTML = '<h1 class="modal-title fs-4">' + title + "</h1>";
  };
  this.showNav = function () {
    if (!this._window.views) this.navObj.innerHTML = "";
    var output = '<ul class="nav nav-tabs">';
    var i = 0;
    for (var view in this._window.views) {
      var viewObj = this._window.views[view];
      var active = '><a class="nav-link ';
      if (this._view == view) {
        active = '><a class="nav-link active ';
      }
      output +=
        "<li" +
        ' class="nav-item gondul-is-private" ' +
        active +
        view +
        '" aria-label="' +
        viewObj.name +
        '" onclick="nmsInfoBox._windowHandler.showView(\'' +
        view +
        "');\">" +
        viewObj.name +
        "</a></li> ";
      i++;
    }
    if (i < 2) {
      this.navObj.innerHTML = "";
    } else {
      this.navObj.innerHTML = output;
    }
  };
  this.addWindow = function (windowObj) {
    this.windowTypes[windowObj.id] = windowObj;
  };
  this.showWindow = function (windowName, argument) {
    if (!this.windowTypes[windowName]) return;
    this.unloadWindow();
    this.argument = argument;
    this._window = this.windowTypes[windowName];
    this.showTitle(this._window.title + " " + (argument ? argument : ""));
    this.showView();
    this.show();
  };
  this.showView = function (viewId) {
    if (!viewId || viewId == "") {
      if (this._viewId[this._window.id] == undefined) viewId = "initial";
      else viewId = this._viewId[this._window.id];
    } else {
      this._viewId[this._window.id] = viewId;
    }
    if (!this._window.views || !this._window.views[viewId]) return;
    this.unloadView();
    for (var panel in this._window.views[viewId].panels) {
      this.showPanel(this._window.views[viewId].panels[panel]);
    }
    this._view = viewId;
    this.showNav();
  };
  this.removePanel = function (panelId) {
    if (!!panelId) this.unloadPanel(panelId);
  };
  this.unloadView = function () {
    this.unloadPanel();
  };
  this.unloadWindow = function () {
    this.hide();
    this.unloadPanel();
  };
  this.unloadPanel = function (panelId) {
    if (!panelId) {
      for (var i in this._panels) {
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
    if (!this._panels[panelId]) return;
    if (typeof this._panels[panelId][action] === "function") {
      if (!argument) {
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
var nmsInfoPanel = function nmsInfoPanel(name, id) {
  this.name = name;
  this.id = id;
  this.sw = false;
  this.container = false;
  this.classList = ["info-panel"];
  this.me = false;
  this.handlers = [];
  this.mode = "initial";

  if (!this.id)
    this.id = (Math.random().toString(36) + "00000000000000000").slice(
      2,
      10 + 2
    );

  //Method for loading the general panel properties
  this.load = function (container, argument) {
    this.container = container;
    this.sw = argument;
    this.me = document.createElement("div");
    this.me.id = this.id;
    for (var i in this.classList) this.me.classList.add(this.classList[i]);
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
    if (!newContent || !this.me) return;
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
    if (!this.me) return;
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
    if (this.classList.indexOf(className) == -1) {
      this.classList.push(className);
      this.me.classList.add(className);
    }
  };
  this.removeClass = function (className) {
    var index = this.classList.indexOf(className);
    if (index != -1) {
      this.classList.splice(index, 1);
      this.me.classList.remove(className);
    }
  };

  //Method for registering a data handler (lets us clean them up later)
  this.addHandler = function (dataType, targetFunction) {
    if (!targetFunction) targetFunction = "refresh";
    nmsData.addHandler(
      dataType,
      this.id,
      this[targetFunction].bind(this),
      "handler-" + dataType
    );
    this.handlers.push(dataType);
  };

  //Method for removing all handlers we have registered
  this.removeHandlers = function () {
    for (var i in this.handlers) {
      nmsData.unregisterHandler(this.handlers[i], this.id);
    }
  };

  //Method for checking if we have handlers registered
  this.hasHandler = function (dataType) {
    for (var i in this.handlers) {
      if (this.handlers[i] == dataType) return true;
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
  nmsInfoPanel.call(this, "switchSNMP");
  this.init = function () {
    this.refresh();
  };
  this.refresh = function (reason) {
    var domObj = document.createElement("div");
    domObj.classList.add("panel-group");

    try {
      var snmpJson = nmsData.snmp.snmp[this.sw][this.mode];
    } catch (e) {
      this._renderError("Waiting for data.");
      return;
    }

    for (var obj in snmpJson) {
      var cleanObj = obj.replace(/\W+/g, "");

      var groupObj = document.createElement("div");
      groupObj.classList.add("panel", "panel-default", "nms-panel-small");
      groupObj.innerHTML =
        '<h6 class="">' + obj + '</h6>';

      var groupObjCollapse = document.createElement("div");
      groupObjCollapse.id = cleanObj + "-group";
      //groupObjCollapse.classList.add("collapse");

      var panelBodyObj = document.createElement("div");
      panelBodyObj.classList.add("panel-body");

      var tableObj = document.createElement("table");
      tableObj.classList.add("table");

      var tbody = document.createElement("tbody");

      for (var prop in snmpJson[obj]) {
        var propObj = document.createElement("tr");
        propObj.innerHTML =
          "<td>" + prop + "</td><td>" + snmpJson[obj][prop] + "</td>";
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
nmsInfoBox.addPanelType("switchSNMP", switchSNMPPanel);
var switchPortsPanel = function () {
  nmsInfoPanel.call(this, "switchPorts");
  this.init = function () {
    this.refresh();
  };
  this.refresh = function (reason) {
    var domObj = document.createElement("div");
    domObj.classList.add("panel-group");

    try {
      var snmpOldJson;
      var snmpJson = nmsData.snmp.snmp[this.sw]["ports"];
      if (nmsData.old.snmp != undefined) {
        snmpOldJson = nmsData.old.snmp.snmp[this.sw]["ports"];
      }
    } catch (e) {
      this._renderError("Waiting for data.");
      return;
    }
    var expanderButton = document.createElement("a");
    expanderButton.innerHTML = "Toggle all";
    //expanderButton.setAttribute("onclick","$('.collapse-top').collapse('toggle');");
    expanderButton.setAttribute("role", "button");

    var interfaceAliasButton = document.createElement("a");
    interfaceAliasButton.innerHTML = "Toggle interfaces without ifAlias";
    //interfaceAliasButton.setAttribute("onclick", "$('.nms-interface-missing-alias').toggle();");
    interfaceAliasButton.setAttribute("role", "button");

    domObj.appendChild(expanderButton);
    domObj.appendChild(document.createElement("br"));
    domObj.appendChild(interfaceAliasButton);
    var indicies = [];
    for (var obj in snmpJson) {
      indicies.push(obj);
    }
    indicies.sort(function (a, b) {
      var tmpx = [snmpJson[a].ifName, snmpJson[b].ifName];
      tmpx.sort();
      if (tmpx[0] == snmpJson[a].ifName) {
        return -1;
      } else {
        return 1;
      }
    });
    for (var obji in indicies) {
      var obj = indicies[obji];
      var cleanObj = obj.replace(/\W+/g, "");
      var groupObj = document.createElement("div");
      groupObj.classList.add("panel", "panel-default", "nms-panel-small");
      var glyphicon = "glyphicon-remove";
      var button = "btn-danger";
      var title = "link down";
      groupObj.classList.add("nms-interface-down");
      if (snmpJson[obj].ifOperStatus == "up") {
        glyphicon = "glyphicon-ok";
        button = "btn-success";
        title = "link up";
        groupObj.classList.remove("nms-interface-down");
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
          traffic =
            "<small>" +
            byteCount(nowin) +
            "B in | " +
            byteCount(nowout) +
            "B out </small>";
        }
      } catch (e) {}

      if (snmpJson[obj].ifAlias == null || snmpJson[obj].ifAlias == "") {
        groupObj.classList.add("nms-interface-missing-alias");
      }
      groupObj.innerHTML =
        '<span class="panel-heading" style="display:block;"><a class="collapse-controller" role="button" data-toggle="collapse" href="#' +
        cleanObj +
        '-group">' +
        snmpJson[obj].ifName +
        " </a><small>" +
        snmpJson[obj].ifAlias +
        '</small><span class="pull-right">' +
        traffic +
        '<i class="btn-xs ' +
        button +
        '"><span class="glyphicon ' +
        glyphicon +
        '" title="' +
        title +
        '" aria-hidden="true"></span></i></span></span>';

      var groupObjCollapse = document.createElement("div");
      groupObjCollapse.id = cleanObj + "-group";
      groupObjCollapse.classList.add("collapse");
      groupObjCollapse.classList.add("collapse-top");

      var panelBodyObj = document.createElement("div");
      panelBodyObj.classList.add("panel-body");

      var tableObj = document.createElement("table");
      tableObj.classList.add("table", "table-condensed");

      var tbody = document.createElement("tbody");
      var props = [];
      for (var prop in snmpJson[obj]) {
        props.push(prop);
      }
      props.sort();
      for (var index in props) {
        var prop = props[index];
        var propObj = document.createElement("tr");
        var append = "";
        var value = snmpJson[obj][prop];
        if (!isNaN(parseInt(value))) {
          append = byteCount(value, 2);
          if (append != value) append = " (" + append + ")";
          else append = "";
        }
        propObj.innerHTML =
          "<td>" + prop + "</td><td>" + value + append + "</td>";
        tbody.appendChild(propObj);
      }

      tableObj.appendChild(tbody);
      var tableTopObj = document.createElement("div");
      tableTopObj.innerHTML =
        '<span class="panel-heading" style="display:block;"><a class="collapse-controller" role="button" data-toggle="collapse" href="#' +
        cleanObj +
        '-table-group">Details</a></span>';
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
nmsInfoBox.addPanelType("switchPorts", switchPortsPanel);

var searchHelpPanel = function () {
  nmsInfoPanel.call(this, "searchHelp");
  this.refresh = function (reason) {
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
nmsInfoBox.addPanelType("searchHelp", searchHelpPanel);

/*
 * Panel type: Search Results
 *
 * Show the search results
 *
 */
var searchResultsPanel = function () {
  var searchPage = 0;
  nmsInfoPanel.call(this, "searchResults");
  this.refresh = function (reason) {
    var collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    var switches = nmsSearch.matches.sort(collator.compare);
    var table = document.createElement("table");
    table.className = "table table-condensed";
    table.id = "searchResults-table";
    for (var sw in switches) {
      var row = table.insertRow(sw);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      var cell3 = row.insertCell(2);
      cell1.innerHTML =
        "<a href='#' onclick='nmsInfoBox.showWindow(\"switchInfo\",\"" +
        switches[sw] +
        "\");'>" +
        switches[sw] +
        "</a>";
      cell2.innerHTML = nmsData.switches["switches"][switches[sw]].distro_name;
      cell3.innerHTML = handlers[0].getInfo(switches[sw]).why;
    }
    this._render(table);
  };
};
nmsInfoBox.addPanelType("searchResults", searchResultsPanel);

/*
 * Panel type: Edit switch
 *
 * Lets you edit basic switch and switch management data through the switch-update api
 *
 */
var switchEditPanel = function () {
  nmsInfoPanel.call(this, "switchEdit");
  this.refresh = function (reason) {
    if (this.box) {
      return;
    }
    this.box = new nmsModSwitch(this.sw);
    this.box.attach(this.me);
    this.box.show();
  };
};
nmsInfoBox.addPanelType("switchEdit", switchEditPanel);

/*
 * Panel type: Switch comments
 *
 * Displays the current comments and lets you interact with them or add new ones
 *
 */
var switchCommentsPanel = function () {
  nmsInfoPanel.call(this, "switchComments");
  this.commentsHash = false;
  this.refresh = function (reason) {
    var domObj = document.createElement("div");
    domObj.className = "gondul-is-private";
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
    var cap = document.createElement("h5");
    cap.textContent = "Relevant log entries";
    table.appendChild(cap);
    for (var v in logs) {
      tr = table.insertRow(-1);
      tr.className = td1 = tr.insertCell(0);
      td2 = tr.insertCell(1);
      var date = new Date(logs[v]["timestamp"]);
      var month = date.getMonth() + 1;
      var day = date.getDate();
      var tmp =
        date.getYear() +
        1900 +
        "-" +
        (month < 10 ? "0" : "") +
        month +
        "-" +
        (day < 10 ? "0" : "") +
        day +
        " " +
        date.toTimeString().replace(/:\d\d .*$/, "");
      td1.textContent = tmp;
      td1.classList.add("left");
      td2.textContent =
        logs[v]["systems"] + "[" + logs[v]["username"] + "] " + logs[v]["log"];
    }
    domObj.appendChild(table);
    this._render(domObj);
  };
};
nmsInfoBox.addPanelType("switchComments", switchCommentsPanel);

/*
 * Panel type: Switch links
 *
 *
 *
 */
var switchLinksPanel = function () {
  nmsInfoPanel.call(this, "switchLinks");
  this.commentsHash = false;
  this.refresh = function (reason) {
    var domObj = document.createElement("div");
    domObj.className = "gondul-is-private d-grid gap-0 row-gap-3";
    var device = nmsData.smanagement.switches[this.sw]
    if(["eos64"].includes(device["platform"]) && device["serial"] != null && device["serial"] != "") {
    	var cap = document.createElement("a");
    	cap.textContent = "Open in CVP";
    	cap.href = "https://www.cv-prod-euwest-2.arista.io/cv/devices/overview/" + device["serial"];
	cap.target = "_blank";
	cap.className = "my-4 btn btn-outline-primary";
	cap.role = "button";
    	domObj.appendChild(cap);
    }
    this._render(domObj);
  };
};
nmsInfoBox.addPanelType("switchLinks", switchLinksPanel);

/*
 * Panel type: Switch summary
 *
 * Display a live summary of key metrics
 *
 */
var switchSummaryPanel = function () {
  nmsInfoPanel.call(this, "switchSummary");
  this.init = function () {
    this.addHandler("ticker");
    this.refresh();
  };
  this.refresh = function (reason) {
    if (this.box) {
      this.box.refresh();
      return;
    }
    this.box = new nmsSwitchSummary(this.sw);
    this.box.attach(this.me);
    this.box.show();
  };
};
nmsInfoBox.setLegendPick = function (tag, id) {
  if (nms.legendPick != undefined) {
    if (nms.legendPick.handler == tag && nms.legendPick.idx == id) {
      nms.legendPick = undefined;
      return;
    }
  }
  nms.legendPick = { handler: tag, idx: id };
};

nmsInfoBox.addPanelType("switchSummary", switchSummaryPanel);

/*
 * List networks
 *
 * Shows all networks
 *
 */
var networkListPanel = function () {
  nmsInfoPanel.call(this, "listNetworks");
  this.refresh = function (reason) {
    var collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    var networks = nmsData.networks.networks;
    var table = document.createElement("table");
    table.className = "table table-condensed";
    table.id = "searchResults-table";
    for (var net in networks) {
      var row = table.insertRow(net);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      var cell3 = row.insertCell(2);
      cell1.innerHTML =
        "<a href='#' onclick='nmsInfoBox.showWindow(\"networkInfo\",\"" +
        net +
        "\");'>" +
        net +
        "</a>";
      cell2.innerHTML = networks[net].vlan;
      cell3.innerHTML = networks[net].router;
    }
    this._render(table);
  };
};
nmsInfoBox.addPanelType("listNetworks", networkListPanel);

/*
 * Panel type: Network summary
 *
 * Display a summary
 *
 */
var networkSummaryPanel = function () {
  nmsInfoPanel.call(this, "networkSummary");
  this.refresh = function (reason) {
    var network = this.sw;
  };
};
nmsInfoBox.addPanelType("networkSummary", networkSummaryPanel);

/*
 * Panel type: Edit network
 *
 * Lets you edit basic switch and switch management data through the switch-update api
 *
 */
var networkEditPanel = function () {
  nmsInfoPanel.call(this, "networkEdit");
  this.refresh = function (reason) {
    if (this.box) {
      return;
    }
    this.box = new nmsModNet(this.sw);
    this.box.attach(this.me);
    this.box.show();
  };
};
nmsInfoBox.addPanelType("networkEdit", networkEditPanel);

/*
 * Debug Panel
 *
 * Show debug information
 *
 */
var debugStatsPanel = function () {
  nmsInfoPanel.call(this, "debugStatsPanel");
  this.init = function () {
    this.addHandler("ticker");
    this.refresh();
  };
  this.refresh = function (reason) {
    var table = document.createElement("table");
    table.className = "table table-condensed";
    table.id = "searchResults-table";
    var stats = Object.fromEntries(
      Object.entries(nmsData.stats).sort((a, b) => a[0].localeCompare(b[0]))
    );
    for (var stat in stats) {
      var row = table.insertRow(stat);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      cell1.innerHTML = stat;
      cell2.innerHTML = nmsData.stats[stat];
    }
    this._render(table);
  };
};
nmsInfoBox.addPanelType("debugStats", debugStatsPanel);

/*
 * Debug Panel
 *
 * Show debug information
 *
 */
var debugPanel = function () {
  nmsInfoPanel.call(this, "debugInfo");
  this.init = function () {
    this.addHandler("ticker");
    this.refresh();
  };
  this.refresh = function (reason) {
    var table = document.createElement("table");
    table.className = "table table-condensed";
    table.id = "searchResults-table";
    var stats = Object.fromEntries(
      Object.entries(nmsData.stats).sort((a, b) => a[0].localeCompare(b[0]))
    );
    for (var stat in stats) {
      var row = table.insertRow(stat);
      var cell1 = row.insertCell(0);
      var cell2 = row.insertCell(1);
      cell1.innerHTML = stat;
      cell2.innerHTML = nmsData.stats[stat];
    }
    this._render(table);
  };
};
nmsInfoBox.addPanelType("debugInfo", debugPanel);
