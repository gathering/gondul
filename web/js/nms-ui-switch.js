"use strict";

class nmsUiSwitch extends nmsPanel {
	constructor(sw) {
		var title;
		if (sw == undefined) {
			title = "Add new switch"
		} else {
			title = "Edit " + sw;
		}
		super(title)
		this._sw = sw;
		this.populate()
	}
	/*
	 * We really should base this on a backend-API exposing relevant fields...
	 */
	getTemplate(sw) {
		if (sw == undefined) {
			return { 
				mgmt_v4_addr: null, 
				mgmt_v6_addr: null,
				community: null,
				placement: null,
				mgmt_vlan: null,
				poll_frequency: null,
				tags: null
			};
		}
		var swi = [];
		var swm = [];
		try {
			swi = nmsData.switches["switches"][this._sw];
		} catch(e) {}
		try {
			swm = nmsData.smanagement.switches[this._sw];
		} catch(e) {}

		var template = {}
		for (var v in swi) {
			template[v] = swi[v];
		}
		for (var v in swm) {
			if (v == "last_updated") {
				continue;
			}
			template[v] = swm[v];
		}
		return template;
	}
	populate() {
		var template = this.getTemplate(this._sw);
		this.table = new nmsTable();
		var first = new Array("sysname","distro_name","distro_phy_port","traffic_vlan")
		var sorted = new Array();
		for (var v in template) {
			if (!first.includes(v)) {
				sorted.push(v);
			}
		}
		sorted.sort();
		var finals = first.concat(sorted);
		this.rows = {}
		for (var i in finals) {
			var v = finals[i];
			this.rows[v] = new nmsEditRow(v, nmsInfoBox._nullBlank(template[v]));
			this.rows[v].parent = this;
			this.table.add(this.rows[v]);
		}
		this.add(this.table);
	}
	changed(row) {
		this.title = "saw row change on " + row.name + " to " + row.value;
	}
	get value() {
		return this.table.value;
	}
}

class nmsEditRow extends nmsBox {
	constructor(text,value) {
		super("tr")
		// This should/could be smarter in the future.
		if (value instanceof Object) {
			value = JSON.stringify(value);
		}
		this.name = text;
		this._value = value;
		this.original = value;
		var td1 = new nmsBox("td")
		td1.add(new nmsString(text))
		this.add(td1);

		var td2 = new nmsBox("td")
		var input = new nmsBox("input")
		input.html.value = value;
		input.html.className = "form-control";
		input.html.type = "text";
		input.row = this;
		input.html.onchange = function() {
			this.nmsBox.row.value = this.value
		}
		input.html.oninput = function() {
			this.nmsBox.row.value = this.value
		}
		this._input = input;
		this._td2 = td2;
		td2.add(input)
		this.add(td2)
	}
	get value() {
		return this._value;
	}
	set value(value) {
		this._value = value;
		if (this._input.html.value != value) {
			this._input.html.value = value
		}
		if (this._value != this.original) {
			this._td2.html.classList.add("has-warning");
		} else {
			this._td2.html.classList.remove("has-warning");
		}
		this.parent.changed(this) 
	}
}
