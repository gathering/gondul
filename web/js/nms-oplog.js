"use strict";

/* 
 * Please note: I've started moving this to a new and better way of doing
 * things and it is by no means a finished move. This means that this file is a
 * mess of two different styles at the time of this writing. Fix incomming.
 */
var nmsOplog = nmsOplog || {
	table: {}
}
nmsOplog.init = function() { 
	nms.oplog = new nmsOplog2()
}
nmsOplog.getSwitchLogs = function(sw) {
	var logs = [];
	if (nmsData.oplog == undefined || nmsData['oplog']['oplog'] == undefined)
		return [];
	for (var v in nmsData['oplog']['oplog']) {
		var log = nmsData['oplog']['oplog'][v];
		if (log['systems'] != "" && log['systems'] != undefined) {
			if (nmsSearch.searchTest(log['systems'],sw)) {
				logs.push(log);
			}
		}
	}
	return logs;
}

// New-style-work-in-progress follows
class nmsOplog2 {
	constructor() {
		this.logger = new nmsOplogInput()
		this.logger.attach("navbar")
		this.logger.show()
		this.mini = new nmsLogTable()
		this.full = new nmsLogTable("full", "large",0,0);
		this.mini.attach("oplog-parent-mini")
		this.full.attach("oplog-parent")
		this.mini.show()
		this.full.show()
		this._username = new nmsBox("p", {html:{className: "navbar-text navbar-right"}});
		if (nms.user) {
			this._username.html.textContent = nms.user
		}
		this._username.attach("navbar");
		this._username.show()
		nmsData.addHandler("oplog", "nmsOplogHandler", this.updateComments,this);
	}
	updateComments(x) {
		if (nms.user && x._username.user != nms.user) {
			x._username.user = nms.user;
			x._username.html.textContent = nms.user
		}
		x.mini.update()
		x.full.update()
	}
}
class nmsOplogInput extends nmsBox {
	constructor() {
		super("div",{html:{className:"navbar-form form-inline navbar-right gondul-is-private"}})
		this._systems = new nmsBox("input", {html:{className:"form-control",type:"text",size:"8",placeholder:"System(s)"}});
		this._systems.searchbox = document.getElementById("searchbox")
 		this._systems.html.oninput = function(e) {
			this.nmsBox.searchbox.value = this.value;
			this.nmsBox.searchbox.oninput();
		}
		this.add(this._systems)
		this._entry = new nmsBox("input", {html:{className:"form-control",type:"text",size:"30",placeholder:"Log entry"}});
		this.add(this._entry)
		var button = new nmsBox("button",{html:{className:"btn btn-default",type:"button"}});
		button.html.textContent = "Log";
		button.container = this;
		button.html.onclick = function(element) {
			this.nmsBox.container.commit(element)
		}
		this.add(button);
	}
	/* Should be moved to nms.user probably */
	get user() {
		if (nms.user) {
			return nms.user;
		}
		var user = prompt("Who are you? Short nick for the record.");
		if (user == null || user == undefined || user == "") {
			console.log("empty prompt");
			alert("No cake for you.");
			return false;
		}
		nms.user = user;
		saveSettings();
		return nms.user;
	}
	_empty(input) {
		if (input == undefined || input == null || input == "") {
			return "";
		}
		return input;
	}
	get entry() {
		return this._empty(this._entry.html.value)
	}
	get systems() {
		return this._empty(this._systems.html.value)
	}
	commit(element) {
		if (!this.user) {
			console.log("need a user...")
			return false;
		}
		if (this.entry == "") {
			return false;
		}
		var myData = {"user": this.user, "systems": this.systems, "log": this.entry};
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
		this.blank()
	}
	blank() {
		this._entry.html.value = "";
		this._systems.html.value = "";
		this._systems.searchbox.value = "";
		this._systems.searchbox.oninput()
	}
}


/*
 * This can be re-written now that it uses nmsBox... That rewrite was just a short
 * test of nmsBox...
 */
class nmsLogTable extends nmsTable {
	constructor(mode = "small", timestyle = "small", cutoff = 100, limit = 10) {
		super([]);
		this.mode = mode;
		this.timestyle = timestyle;
		this.cutoff = cutoff;
		this.limit = limit;
		this.entries = {}
		this.first = true;
	}
	/* This is a horrible implementation. BUT THAT'S WHAT YOU GET
	 */
	syncToTable() {
		var i = 1;
		var pastCut = false;
		var indexes = [];
		for (var idx in this.entries) {
			indexes.push(parseInt(idx))
		}
		// Testint to see what browsers I can break with exciting new
		// syntax
		indexes.sort((x,y) => y-x)
		for (var idx in indexes) {
			var entry = this.entries[indexes[idx]];
			if (!pastCut) {
				if (entry == undefined) {
					console.log("wtf, empty?")
					console.log(entry)
				} else {
					entry.build(this.cutoff,this.timestyle)
					if(!this.includes(entry)) {
						// FIXME: This is dumb. It assumes we only get one update.
						if (this.first) {
							this.add(entry)
						} else {
							this.insert(entry)
						}
					}
				}
			} else {
				if(this.includes(entry)) {
					this.remove(entry)
				}
			}
			if(this.limit > 0 && ++i > this.limit) {
				pastCut = true;
			}
		}
		this.first=false;
	}
	update() {
		var candidates = nmsData['oplog']['oplog'];
		for (var i in candidates) {
			var candidate = candidates[i];
			if (this.entries[candidate.id] != undefined) {
				continue;
			} else {
				this.entries[candidate.id] = new nmsOplogEntry(candidate);
			}
		}
		this.syncToTable();
	}
}

class nmsOplogEntry extends nmsBox { 
	build(cutoff,timestyle) {
		if (this.built) {
			return true;
		}
		var td1 = new nmsBox("td")
		var td2 = new nmsBox("td")
		if(timestyle == "small") {
			td1.add(new nmsString(this.shortTime()))
		} else {
			td1.add(new nmsString(this.longTime()))
		}
		var col2 = new nmsString(this.systems + " [" + this.username + "] " + this.getData(cutoff));
		if (this.title != null) {
			col2.html.title = this.title;
		}
		col2.searchbox = document.getElementById("searchbox")
		col2.entry = this;
		if (this.systems != undefined && this.systems != null && this.systems != "") {
			col2.html.onclick = function(e) { 
				this.nmsBox.searchbox.value = this.nmsBox.entry.systems;
				this.nmsBox.searchbox.oninput()
				this.nmsBox.clicked = true;
				setTimeout(function(e){e.clicked = false;},3000,this.nmsBox)
			}
			col2.html.onmouseover = function(e) {
				this.nmsBox.over = true;
				if (this.nmsBox.timer) {
					clearTimeout(this.nmsBox.timer)
				}
				this.nmsBox.searchbox.value = this.nmsBox.entry.systems;
				this.nmsBox.searchbox.hoverSource = this.nmsBox;
				this.nmsBox.searchbox.oninput()
			}
			col2.html.onmouseleave = function(e) {
				this.nmsBox.over = false;
				if (this.nmsBox.clicked) { return; }
				if (this.nmsBox.timer) {
					clearTimeout(this.nmsBox.timer)
				}
				this.nmsBox.timer = setTimeout(function(e){
						if (e.over == false && e.entry.systems == e.searchbox.value && e.searchbox.hoverSource == e) {
							e.searchbox.value = "";
							e.searchbox.oninput()
						}
					},2000,this.nmsBox)
			}
		}
		this.add(td1)
		td2.add(col2)
		this.add(td2)
		this.built = true;
	}

	constructor(entry) {
		super("tr")
		this.td1 = null;
		this.td2 = null;
		this.time = new Date(entry.timestamp.replace(" ","T"))
		this.id = entry.id;
		this.data = entry.log;
		this.title = null;
		this.systems = entry.systems;
		this.username = entry.username;
	}
	longTime() {
		return this.time.toISOString();
	}
	shortTime() {
		return this.time.toTimeString().replace(/:\d\d .*$/,"");
	}
	getData(cutoff = 0) {
		if (cutoff && this.data.length > cutoff) {
			this.title = this.data;
			return this.data.slice(0,cutoff) + "(...)";
		}
		return this.data;
	}
}
