"use strict";
/*
 * Base type. All nmsType* classes represent a logical family of units.
 * This is used to provide input validation on the class-level and 
 * is used to store the value and description of variables.
 * This is not bound to editing in theory. It is natural to think
 * that nms-map-handlers will leverage the same type-system to
 * verify that things are as they should.
 *
 * An example of future features outside the scope of simply editing stuff:
 *    verify that a nmsTypeIP is contained in nmsTypeNetwork 
 *    use nmsTypePlace for all placement-logic
 * 
 * Stuff that should be supported within an editor:
 *    - Validation (duh)
 *    - Hints (auto-complete, parse-error-feedback)
 *    - Creating a new network "on the fly" when adding a switch
 *    - Rich editing modes (e.g.: the placement-editing should
 *      allow you to just drag the switch and see the values change,
 *      and tags should obviously be smater too. And yeah, the snmp-
 *      thing should be an actual secret like it is today in
 *      nms-info-box
 */
class nmsType {
	constructor(description, priority) {
		this._value = null;
		this.description = description;
		this.validationReason = "";
		this.ro = false;
		if (priority == undefined) {
			priority = this._defaultPriority;
		}
		this.priority = priority
	}
	// Override this to get free validation. Just return true or false.
	validate(input) {
		return true;
	}
	// Always return text-representation
	// Should be matched by fromString()
	toString() {
		if (this._value == null || this._value == undefined) {
			return ""
		} else {
			return this._value.toString();
		}
	}
	// Set value from string-input
	fromString(input) {
		if (this.validate(input)) {
			this._value = input;
		} else {
			throw "Invalid input. Use .validate() before setting stuff please. I am " + this + " and my input is " + input
		}
	}
	initial(v) {
		this.value = v;
		if(this.priority == nmsPriority.newOnly) {
			this.ro = true;
		}
	}
	get value() {
		return this._value;
	}
	set value(input) {
		this._value = input;
	}
	get _defaultPriority() {
		return nmsPriority.optional;
	}
}

class nmsTypeInterval extends nmsType { 
	validate(input) {
		return !!(input.match(/^\d\d:\d\d:\d\d$/))
	}
}
class nmsTypeIP extends nmsType { 
	get _defaultPriority() {
		return nmsPriority.important;
	}
	_validateV4(input) { 
		var x = input.match(/^(\d+)\.(\d+).(\d+).(\d+)$/)
		if (!x) {
			this.validationReason = "Doesn't look like IPv4 address or IPv6";
			return false;
		}
		for (var i = 1; i < 5; i ++) {
			if (x[i] < 0  || x[i] > 255) {
				this.validationReason = "The " + i + "'th octet("+x[i]+") is outside of expected range (0-255)"
				return false
			}
		}
		this.validationReason = "OK"
		return true;
	}
	/* It's so easy to check if IPv6 addresses are valid.
	 */
	_validateV6(input) {
		if (!!input.match(/^[a-fA-F0-9:]+$/)) {
			this.validationReason = "OK IPv6 address"
			return true;
		} else {
			this.validationReason = "Doesn't parse as a IPv6 address despite :";
			return false;
		}
	}
	validate(input) {
		if (input.match(":")) {
			return this._validateV6(input);
		} else {
			return this._validateV4(input);
		}
	}
}
class nmsTypeCIDR extends nmsType {
	get _defaultPriority() {
		return nmsPriority.important;
	}
	_validateV4(input) {
		var x = input.match(/^(\d+)\.(\d+).(\d+).(\d+)\/(\d+)$/)
		if (!x) {
			this.validationReason = "Doesn't look like IPv4 cidr or IPv6";
			return false;
		}
		for (var i = 1; i < 5; i ++) {
			if (x[i] < 0  || x[i] > 255) {
				this.validationReason = "The " + i + "'th octet("+x[i]+") is outside of expected range (0-255)";
				return false;
			}
		}
		if (x[5] < 8 || x[5] > 32) {
			this.validationReason = "/"+x[5]+" is outside of expected range (8-32)";
			return false;
		}
		this.validationReason = "OK";
		return true;
	}
	_validateV6(input) {
		if (!!input.match(/^[a-fA-F0-9:]+\/(\d+)$/)) {
			this.validationReason = "OK IPv6 cidr"
			return true;
		} else {
			this.validationReason = "Doesn't parse as a IPv6 cidr despite :";
			return false;
		}
	}
	validate(input) {
		if (input.match(":")) {
			return this._validateV6(input);
		} else {
			return this._validateV4(input);
		}
	}
}
class nmsTypeNetwork extends nmsType { 
	get _defaultPriority() { 
		return nmsPriority.important;
	}
	validate(input) {
		var x =testTree(nmsData,["networks","networks",input])
		if (x) {
			this.validationReason = "OK"
		} else {
			this.validationReason = "No such network: " + input
		}
		return x;
	}
}
class nmsTypeJSON extends nmsType {
	validate(input) {
		try {
			JSON.parse(input);
			this.validationReason = "OK"
			return true;
		} catch(e) {
			this.validationReason = e.message;
			return false;
		}
	}
	toString() {
		return JSON.stringify(this._value);
	}
	fromString(input) {
		try {
			this.value = JSON.parse(input);
		} catch(e) {
			throw "Invalid input. Use .validate() before setting stuff please. I am " + this + " and my input is " + input
		}
	}
}
class nmsTypePlace extends nmsTypeJSON { }
class nmsTypePort extends nmsType { }
class nmsTypeSysname extends nmsType {
	get _defaultPriority() {
		return nmsPriority.newOnly;
	}
	validate(input) {
		if (this.ro) {
			throw "Trying to validate a r/o field"
		}
		var x = testTree(nmsData,["switches","switches",input])
		if (x) {
			this.validationReason = "Switch already exists"
		} else {
			this.validationReason = "OK: " + input
		}
		return !x;
	}
}
class nmsTypeSysnameReference extends nmsType {
	get _defaultPriority() {
		return nmsPriority.important;
	}
	validate(input) {
		var x = testTree(nmsData,["switches","switches",input])
		if (x) {
			this.validationReason = "OK"
		} else {
			this.validationReason = "No such switch: " + input
		}
		return x;
	}
}
class nmsTypeTags extends nmsTypeJSON { }
class nmsTypeSecret extends nmsType { }

var nmsPriority = {
	readOnly: 0,
	required: 1,
	important: 2,
	optional: 3,
	newOnly: 4
}
