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
	constructor(type,settings = null) {
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
		/* 
		 * This really should go deeper, but the problem is that
		 * I'm lazy. You can't just use Object.assign() either because
		 * stuff like html.style isn't just any element and we want
		 * to be able to do html:{style:{display:"none"}} instead
		 * of html:{style:new (style object thing with display:none)}
		 *
		 * So far this works.
		 *
		 * Note that this breaks forr classList: This is because 
		 * classList is just an accessor for className, so you 
		 * should set className instead initially.
		 */
		if (settings.html) {
			for (var x in settings.html) {
				if(settings.html[x] instanceof Object) {
					Object.assign(this.html[x],settings.html[x])
				} else {
					this.html[x] = settings.html[x];
				}
			}
		}
	}
	/* Should rename these to push() and unshift(), really, to be
	 * more consistent.
	 */
	add(box) {
		this._boxes.push(box);
		box.attach(this.html)
		box.show()
	}
	insert(box) {
		this._boxes.unshift(box)
		box.attach(this.html)
		box.show(true,-1)
	}

	/* This is provided so as to allow attaching to non-nmsBox-objects.
	 * E.g.: attach the root to a HTML element directly.
	 * If you just use foo = document.getElement...,
	 * foo.appendChild(box.html), then .hide() will work fine,
	 * but there's no way to do .show() afterwards.
	 *
	 * Be aware:
	 * - we want to AVOID the child knowing too much about the parent
	 * - HTML elements can only ever be part of a single parent
	 *   element. This means that it is safe to attach(root1), .show(),
	 *   atach(root2), show() ... The DOM object wil be removed from root1.
	 * - Due to the above, we should probably actually adress that, since
	 *   there are valid reasons for showing the same nmsBox twice (e.g.:
	 *   showing a list of tons of stuff, and also a "top 5")
	 */
	attach(root) {
		if (!(root instanceof HTMLElement)) {
			root = document.getElementById(root)
		}
		console.assert(root instanceof HTMLElement)
		this._root = root;
	}
	show(show = true,where=1) {
		if (!show) {
			this.hide()
			return
		}
		if (this._root instanceof HTMLElement) {
			if (where>0) {
				this._root.appendChild(this.html);
			} else {
				this._root.insertBefore(this.html,this._root.firstElementChild)
			}
		} 
	}
	_remove(source,box) {
		source.html.removeChild(box.html)
		if (box._root == source) {
			box._root = undefined;
		}
		var x = source._boxes.indexOf(box)
		delete source._boxes[x]
	}
	_includes(source,box) {
		if (source._boxes.indexOf(box) >= 0) {
			return true;
		} else {
			return false;
		}
	}
	/*
	 * This redirect is to make it easier for subclasses that
	 * override add() to make it eaiser to add logical
	 * childs, e.g. adding to a table really adds to ._tbody,
	 * not the true top-element of the table.
	 */
	remove(box) {
		this._remove(this,box)
	}
	includes(box) {
		return this._includes(this,box);
	}
	hide() {
		if (this.html.parentElement instanceof HTMLElement) {
			this.html.parentElement.removeChild(this.html);
		}
	}
	destroy() {
		this.hide()
		for (var i in this._boxes) {
			var x = this._boxes[i];
			x.hide()
			x.destroy()
			delete this._boxes[i]
		}
		delete this.html;
		delete this;
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

class nmsButton extends nmsBox {
	constructor(text,type = "btn-default") {
		super("button",{html:{textContent:text,className:"btn "+type,type:"button"}})
	}
}
/*
 * A general-purpose table. It can be created in one go, or
 * as-you-go. 
 */
class nmsTable extends nmsBox {
	constructor(content, caption) {
		super("table",{html:{className:"table table-condensed"}});
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
	remove(box) {
		this._remove(this._tbody,box)
	}
	includes(box) {
		return this._tbody.includes(box)
	}
	_makeBox(content) {
		if (content instanceof nmsBox) {
			return content;
		}
		var tr;
		var td1;
		var td2;
		tr = new nmsBox("tr");
		for (var x in content) {
			var td = new nmsBox("td");
			var child = content[x];
			if (child instanceof nmsBox) {
				td.add(child);
			} else {
				td.add(new nmsString(child));
			}
			tr.add(td);
		}
		return tr;
	}
	/* Can take either a single nmsBox-object that will be added as-is,
	 * or an array of items that will be added as individual cells
	 */ 
	add(content) {
		this._tbody.add(this._makeBox(content));
	}
	insert(box) {
		this._tbody.insert(this._makeBox(box));	
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
		super("div",{html:{style:{gridColumn: 2}}});
		this._topBox = new nmsBox("div",{ html: { className: "panel panel-default"}});
		this._body = new nmsBox("div",{html:{className: "panel-body"}});
		this.nav = new nmsBox("div",{html:{className: "panel-body"}});
		this._topBox.add(this.makeHeading(title));
		this._topBox.add(this.nav);
		this._topBox.add(this._body);
		super.add(this._topBox);
	}
	attach(root = document.getElementById("genericPanelContainer")) {
		try {
			var x = parseInt(root.lastElementChild.style.gridColumnStart);
			this.html.style.gridColumnStart = x+1;
		} catch(e) {
		}
		super.attach(root)
	}
	show() {
		if (!this._root) {
			this.attach()
		}
		super.show()
	}
	/* Mainly just to make the constructor more readable. */
	makeHeading(title) {
		var titleObject = new nmsBox("div",{html:{className: "panel-heading"}});
		this._titleText = new nmsBox("h4",{html:{textContent: title}});
		var closeButton = new nmsBox("button");
		closeButton.html.className = "close";
		closeButton.panel = this;
		closeButton.html.onclick = function() {
			this.nmsBox.panel.destroy();
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
