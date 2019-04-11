"use strict";

/* Basic editor for switches, and possibly networks and whatever.
 * This is the first real use of both the nmsBox and nmsType, so
 * expect changes as the need(s) arise.
 * 
 * The general idea is simple, though: Editing and adding is to be treated
 * as similar as possible, and there should be no hard-coding anywhere. If
 * we need a "one-off" for whatever, we should find a genric way of solving
 * it to avoid complicating things. 
 * 
 */

class nmsNewSwitch extends nmsPanel {
	constructor() {
		super("Add new switch")
		this.add(new nmsModSwitch(undefined))
		this.nav.add(new nmsString("The only required field for adding a switch is the sysname, everything else will be filled in by the backend if you do not provide it. However, you should PROBABLY fill in managemnt IP and a few other fields."));
	}
}
class nmsNewNet extends nmsPanel {
	constructor() {
		super("Add new network")
		this.add(new nmsModNet(undefined))
		this.nav.add(new nmsString("Only the name is required, but you should probably fill in more."));
	}
}

class nmsModThing extends nmsBox {
	constructor(data) {
		super("div");
		this.identifier = data.identifier;
		this.invalidate = data.invalidate;
		this.api = data.api;
		this.item = data.item;
		this.generateBaseTemplate()
		this.populate()
		var save = new nmsButton("Save","btn-primary");
		save.panel = this;
		save.html.onclick = this.save;
		this.add(save)
		var del = new nmsButton("Delete","btn btn-danger");
		del.panel = this
		del.html.onclick = this.del;
		this.add(del)
	}
	commit(data) {
		$.ajax({
			type: "POST", 
			url: this.api,
			dataType: "text",
			nmsBox:this,
			data:JSON.stringify(data),
			success: function (data, textStatus, jqXHR) {
				var msg = new nmsString("Changed...");
				msg.attach(this.nmsBox._root);
				msg.show()
				this.nmsBox.destroy()
				//nmsInfoBox.hide();
				for (var x of this.nmsBox.invalidate) {
					nmsData.invalidate(x);
				}
			}
		});
	}

	del(e) {
		if(confirm("This will delete the " + this.typeName + ":" + this.nmsBox.panel.item)) {
			this.nmsBox.panel.commit([{'sysname': this.nmsBox.panel.item, 'deleted': true}]); 
		};
	}
	save(e) { 
		var diff = this.nmsBox.panel.diff()
		if (diff != undefined) {
			this.nmsBox.panel.commit([diff])
		}
	}
	/* Pretty sure that the type-thing is OK, but what I want is to
	 * generate a nmsTemplate or something that can be used to get/set
	 * variables generically, and replaces nmsEditRow. Since right now,
	 * both the template and the row is fiddling with values, luckily
	 * all through the same actual object, but still....
	 * This is because I wrote nmsEditRow before I added a type-system.
	 *
	 * The fundamental problem is that the row-rendering is obviously
	 * affected by the type, and the overall "template"/parent
	 * (nmsModSwitch right now) is also obviously affected by changes to
	 * the individual rows.
	 *
	 * Right now a change in a value means nmsEditRow will get the
	 * event, it will use the nmsType to validate, and ultimately set,
	 * but it ALSO has to store a text-representation of the value if it
	 * changes from other sources (e.g.: auto-complete), and we need to
	 * alert nmsModSwitch that a change has occurred so it can act
	 * approrpiately (e.g.: Enabling/disabling a save button).
	 * 
	 * This means that nmsType instances, nmsEditRow instances and
	 * nmsModSwitch instance is tightly coupled in non-obvious ways.
	 * 
	 * Which means bugs.
	 */
	populate() {
		if (this.item != undefined) {
			this._populateTemplate(this.item);
		}
		this.table = new nmsTable();
		this.rows = {}
		for (var v in this._template) {
			this.rows[v] = new nmsEditRow(v, this._template[v]);
			this.rows[v].parent = this;
			this.table.add(this.rows[v]);
		}
		this.add(this.table);
	}
	changed(row) {
		this.title = "saw row change on " + row.name + " to " + row.value;
	}
	get value() {
		var ret = {};
		for (var idx in this.rows) {
			ret[idx] = this.rows[idx].value;
		}
		return ret;
	}
	diff() {
		var ret = {};
		var changed = 0;
		for (var idx in this.rows) {
			if (this.rows[idx].value.toString() != this.rows[idx].original) {
				ret[idx] = this.rows[idx].value.value;
				changed++;
			}
		}
		if (!changed) {
			return undefined;
		}
		ret[this.identifier] = this.rows[this.identifier].value.value;
		return ret;
	}
}

class nmsEditRow extends nmsBox {
	constructor(text,value) {
		super("tr")
		// This should/could be smarter in the future.
		console.assert(value instanceof nmsType)
		this.name = text;
		this._value = value;
		this.original = value.toString();
		var td1 = new nmsBox("td")
		var name = new nmsString(text+" ");
		name.html.title = value.description;
		td1.add(name)
		this.add(td1);
		td1.html.width="50%"
		this._state = new nmsBox("span",{html:{className:"label label-default",textContent:"Original"}})
		this._valid = new nmsBox("span",{html:{className:"label label-default",textContent:"Not verified"}})
		name.add(this._state)
		name.add(this._valid)
		this._valid.hide()
		this.changed(false)
		var content = new nmsBox("td")
		var input = new nmsBox("input")
		input.html.value = value.toString();
		input.html.className = "form-control";
		input.html.type = "text";
		input.row = this;
		if (value.ro) {
			input.html.disabled = true;
			input.html.title = "Read/only attribute";
		}
		if (value instanceof nmsTypeSecret) {
			input.html.type = "password"
			input.html.autocomplete = "off"
			input.html.onfocus = function f() { this.type = "text" }
			input.html.oninput = function f() { this.type = "text" }
			input.html.onblur = function f() { this.type = "password" }
		}
		input.html.onchange = function() {
			this.nmsBox.row.value = this.value
		}
		input.html.oninput = function() {
			this.nmsBox.row.value = this.value
		}
		this._input = input;
		this._content = content;
		content.add(input)
		this.add(content)
	}
	get value() {
		return this._value;
	}
	changed(val) {
		if (val) {
			this._state.show()
			this._state.html.textContent = "Changed"
			this._state.html.classList.remove("label-default")
			this._state.html.classList.add("label-warning")
		} else {
			this._state.hide()
		}
	}
	valid(val) {
		this._valid.html.classList.remove("label-default")
		this._valid.show()
		if (val) {
			this._valid.html.textContent = "Valid"
			this._valid.html.classList.remove("label-danger")
			this._valid.html.classList.add("label-success")
		} else {
			this._valid.html.textContent = "Invalid"
			this._valid.html.classList.add("label-danger")
			this._valid.html.classList.remove("label-success")
		}
	}


	/* THIS IS A MESS */
	set value(value) {
		if (!this._value.validate(value)) {
			this.valid(false)
			this._content.html.classList.add("has-error");
			return;
		} else {
			this.valid(true)
			this._content.html.classList.remove("has-error");
			this._value.fromString(value);
		}
		if (this._input.html.value != this._value.toString()) {
			this._input.html.value = this._value.toString()
		}
		if (this._value.toString() != this.original) {
			this.changed(true)
			this._content.html.classList.add("has-success");
		} else {
			this.changed(false)
			this._content.html.classList.remove("has-success");
		}
		this.parent.changed(this) 
	}
}
class nmsModSwitch extends nmsModThing {
	constructor(sw) {
		super({item: sw, identifier: "sysname", invalidate: ["switches","smanagement"], api: "/api/write/switches"})	
	}
	generateBaseTemplate() {
		this._template = {
			sysname: new nmsTypeSysname("Unique systemname/switch name. Only required field.  Read/only on existing equipment." ),
			mgmt_v4_addr: new nmsTypeIP("Management address IPv4"),
			mgmt_v6_addr: new nmsTypeIP("Management address IPv6"),
			mgmt_vlan: new nmsTypeNetwork("Management VLAN"),
			traffic_vlan: new nmsTypeNetwork("Traffic VLAN"),
			distro_name: new nmsTypeSysnameReference("Distro switch upstream of this system. Required for provisioning."),
			distro_phy_port: new nmsTypePort("Name of port we connect to at the distro switch. Used for provisioning, among other things."),
			poll_frequency: new nmsTypeInterval("Poll frequency for SNMP (will use default from backend)"),
			community: new nmsTypeSecret("SNMP community (will use default from backend)"),
			placement: new nmsTypePlace("Map placement (If following a regular naming scheme, the backend will place it poperly, otherwise a random place will be chose)"),
			tags: new nmsTypeTags("Additional tags in JSON text array format. Can be anything. Used to provide a simple escape hatch mechanism to tag systems.")
	      }
	}
	_populateTemplate(sw) {
		var swi = [];
		var swm = [];
		try {
			swi = nmsData.switches["switches"][sw];
			swm = nmsData.smanagement.switches[sw];
		} catch(e) {}

		var template = {}
		for (var v in swi) {
			console.assert(this._template[v] instanceof nmsType)
			if (swi[v] != null) {
				this._template[v].initial(swi[v]);
			}
		}
		for (var v in swm) {
			if (v == "last_updated") {
				continue;
			}
			console.assert(this._template[v] instanceof nmsType)
			if (swm[v] != null) {
				this._template[v].initial(swm[v]);
			}
		}
	}
}

class nmsModNet extends nmsModThing {
	constructor(net) {
		super({item: net, identifier: "name", invalidate: ["networks","smanagement"], api: "/api/write/networks"})	
	}
	generateBaseTemplate() {
		this._template = {
			name: new nmsType("Unique networkname. Only required field. Read/only on existing nets."),
			vlan: new nmsType("VLAN ID"),
			gw4: new nmsTypeIP("Gateway address, IPv4"),
			gw6: new nmsTypeIP("Gateway address, IPv6"),
			subnet4: new nmsTypeCIDR("Subnet, IPv4"),
			subnet6: new nmsTypeCIDR("Subnet, IPv6"),
			router: new nmsTypeSysnameReference("Router where net is terminated. E.g.: r1.noc for floor traffic nets"),
			tags: new nmsTypeTags("Additional tags in JSON text array format. Can be anything. Used to provide a simple escape hatch mechanism to tag systems.")
	      }
	}
	_populateTemplate(net) {
		var nets = [];
		try {
			nets = nmsData.networks["networks"][net];
		} catch(e) {}

		var template = {}
		for (var v in nets) {
			console.assert(this._template[v] instanceof nmsType)
			if (nets[v] != null) {
				this._template[v].initial(nets[v]);
			}
		}
	}
}


