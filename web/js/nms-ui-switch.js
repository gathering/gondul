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
class nmsModSwitch extends nmsBox {
	constructor(sw) {
		var title;
		if (sw == undefined) {
			title = "Add new switch"
		} else {
			title = "Edit " + sw;
		}
		super("div",{html:{className: "panel-body"}});
		this._sw = sw;
		//this.nav.add(new nmsString("Adding and editing stuff has immediate effects and blah blah blah, insert sensible help-text here."));
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
			url: "/api/write/switches",
			dataType: "text",
			nmsBox:this,
			data:JSON.stringify(data),
			success: function (data, textStatus, jqXHR) {
				var msg = new nmsString("Changed...");
				msg.attach(this.nmsBox._root);
				msg.show()
				this.nmsBox.destroy()
				//nmsInfoBox.hide();
				nmsData.invalidate("switches");
				nmsData.invalidate("smanagement");
			}
		});
	}

	del(e) {
		if(confirm("This will delete the switch: " + this.nmsBox._sw)) {
			this.nmsBox.panel.commit([{'sysname': this.nmsBox.panel.sw, 'deleted': true}]); 
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
	generateBaseTemplate() {
		this._template = {
			sysname: new nmsTypeSysname("Unique systemname/switch name. Only required field." ),
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
			swi = nmsData.switches["switches"][this._sw];
		} catch(e) {}
		try {
			swm = nmsData.smanagement.switches[this._sw];
		} catch(e) {}

		var template = {}
		for (var v in swi) {
			console.assert(this._template[v] instanceof nmsType)
			if (swi[v] != null) {
				this._template[v].value = swi[v];
			}
		}
		for (var v in swm) {
			if (v == "last_updated") {
				continue;
			}
			console.assert(this._template[v] instanceof nmsType)
			if (swm[v] != null) {
				this._template[v].value = swm[v];
			}
		}
	}
	populate() {
		if (this._sw != undefined) {
			this._populateTemplate(this._sw);
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
			if (this.rows[idx].value != this.rows[idx].original) {
				ret[idx] = this.rows[idx].value;
				changed++;
			}
		}
		if (!changed) {
			return undefined;
		}
		ret["sysname"] = this.rows["sysname"].value;
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
		this.original = value.value;
		var td1 = new nmsBox("td")
		var name = new nmsString(text);
		name.html.title = value.description;
		td1.add(name)
		this.add(td1);

		var td2 = new nmsBox("td")
		var input = new nmsBox("input")
		input.html.value = value.value;
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
		return this._value.value;
	}
	/* THIS IS A MESS */
	set value(value) {
		if (!this._value.validate(value)) {
			this._td2.html.classList.add("has-error");
			return;
		} else {
			this._td2.html.classList.remove("has-error");
			this._value.value = value;
		}
		if (this._input.html.value != this._value.value) {
			this._input.html.value = this._value.value
		}
		if (this._value.value != this.original) {
			this._td2.html.classList.add("has-success");
		} else {
			this._td2.html.classList.remove("has-success");
		}
		this.parent.changed(this) 
	}
}
