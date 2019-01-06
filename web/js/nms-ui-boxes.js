"use strict";

/*
 * An attempt at breaking up nms-info-box into something that works better.
 * The idea is to retain the ability to fiddle with html, but solve common
 * problems such as "I need to show a box that looks good" and "I need to
 * update the content of this field in this box when something happens".
 * 
 * Seeing as how it's 2019, I figured I'd try to use this whole "class"
 * thing :D
 * 
 * Eventually, everything in nms-info-box.js should use this, but more over,
 * if a need to write some code that needs a UI element arises, the general
 * problem should be solved here, while the implementation: elsewhere.
 *
 * Example: Adding a new switch or network should not be closely tied in
 * here.
 *
 * I expect this code to change dramatically as I start using it.
 */

class nmsBox {
	constructor(type,settings) {
		this.type = type;
		this._boxes = []
		this.html = document.createElement(type);
		this.html.nmsBox = this;
		if (settings) {
			this.applySettings(settings);
		}
	}
	get value() {
		var values = [];
		for (var x in this._boxes) {
			var tmp = this._boxes[x].value;
			if (tmp != undefined && !((tmp instanceof Array) && tmp.length == 0)) {
				values.push(tmp)
			}
		}
		return values;
	}

	applySettings(settings) {
		if (settings.html) {
			for (var x in settings.html) {
				if (settings.html[x] instanceof Array) {
					/* If you just sett classList = array it will end up being
					 * classList = "panel,panel-default,foo", instead of
					 * classList = ["panel","panel-default","foo"] ...
					 * Not sure if this applies to all arrays in a html
					 * object, but we'll see.
					 */
					for (var y in settings.html[x]) {
						this.html[x].add(settings.html[x][y]);
					}
				} else {
					this.html[x] = settings.html[x];
				}
			}
		}
	}
	add(box) {
		this._boxes.push(box);
		this.html.appendChild(box.html);
	}
	close() {
		for (var x in this._boxes) {
			this._boxes[x].close();
		}
		if (this.html.parentElement != null) {
			this.html.parentElement.removeChild(this.html);
		}
	}
	update() {
		for (var x in this._boxes) {
			this._boxes[x].update();
		}
	}
};


class nmsString extends nmsBox {
	constructor(content,type) {
		type = type ? type : "p";
		super(type,{ html: { textContent: content }})
	}
	set value(input) {
		this.html.textContent = input;
	}
	get value() {
		return this.html.textContent;
	}
}
/*
 * A general-purpose table. It can be created in one go, or
 * as-you-go. 
 */
class nmsTable extends nmsBox {
	constructor(content, caption) {
		super("table");
		this.html.className = "table";
		this.html.classList.add("table");
		this.html.classList.add("table-condensed");
		if (caption != undefined) {
			var cap = new nmsBox("caption");
			cap.html.textContent = caption;
			super.add(cap);
		}
		this._tbody = new nmsBox("tbody");
		super.add(this._tbody);
		for (var v in content) {
			this.add(content[v]);
		}
	}
	/* Can take either a single nmsBox-object that will be added as-is,
	 * or an array of items that will be added as individual cells
	 */ 
	add(content) {
		if (content instanceof nmsBox) {
			this._tbody.add(content)
			return;
		}
		var tr;
		var td1;
		var td2;
		tr = new nmsBox("tr");
		tr.html.className = content[0].toLowerCase().replace(/[^a-z0-9_]/g,"");
		for (var x in content) {
			var td = new nmsBox("td");
			var child = content[x];
			if (x == 0) {
				td.html.classList.add("left");
			}
			if (child instanceof nmsBox) {
				td.add(child);
			} else {
				td.add(new nmsString(child));
			}
			tr.add(td);
		}
		this._tbody.add(tr);
	}
}

/*
 * Basic panel. Rooted at the 'metaContainer' as of now, but that MIGHT CHANGE.
 * Draws a nice box with a background, title, close-button and whatnot.
 * Usage:
 * var myThing = new nmsPanel("initial title");
 * myThing.add(nmsString("whatever"))
 * myThing.title = "blah...."
 */
class nmsPanel extends nmsBox{
	constructor(title){ 
		super("div",{html: { classList: ["col-sm-8","col-md-6","col-lg-5","genericBox"]}});
		this._topBox = new nmsBox("div",{ html: { classList: ["panel","panel-default"]}});
		this._body = new nmsBox("div",{html:{classList: ["panel-body"]}});
		this.nav = new nmsBox("div",{html:{classList: ["panel-body"]}});
		this._topBox.add(this.makeHeading(title));
		this._topBox.add(this.nav);
		this._topBox.add(this._body);
		super.add(this._topBox);
		this._root = document.getElementById("metaContainer");
		this._root.appendChild(this.html);
	}
	/* Mainly just to make the constructor more readable. */
	makeHeading(title) {
		var titleObject = new nmsBox("div",{html:{classList: ["panel-heading"]}});
		this._titleText = new nmsBox("h4",{html:{textContent: title}});
		var closeButton = new nmsBox("button");
		closeButton.html.className = "close";
		closeButton.panel = this;
		closeButton.html.onclick = function() {
			this.nmsBox.panel.close();
		}
		closeButton.html.style = "float: right;";
		closeButton.add(new nmsString("X","span"));
		titleObject.add(closeButton);
		titleObject.add(this._titleText);
		return titleObject;
	}
	add(item) {
		this._body.add(item)
	}
	set title(input) {
		this._titleText.html.textContent = input;
	}
	get title() {
		this._titleText.html.textContent;
	}
}
