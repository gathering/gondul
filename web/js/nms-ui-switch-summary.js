"user strict";

class nmsSwitchSummary extends nmsTable {
	constructor(sw) {
		super()
		this._sw = sw;
		this._data = {}
		this.refresh()
	}
		
	refresh() {
		for (var h in handlers ) {
			if (handlers[h].getInfo != undefined) {
				var tmp = handlers[h].getInfo(this._sw);
				if (!tmp) { continue; }
				if (this._data[h] == undefined) {
					this._data[h] = {}
				}
				for (var x in tmp.data) {
					if (this._data[h][x] == undefined) {
						this._data[h][x] = new nmsSwitchItem(tmp.data[x].description,handlers[h])
						this.add(this._data[h][x])
					}
					this._data[h][x].refresh(tmp.data[x])
				}
			}
		}
	}
}

class nmsSwitchItem extends nmsBox {
	constructor(description,handler) {
		super("tr")
		this.add(new nmsBox("td",{html:{textContent:description}}));
		this.html.title = handler.tag;
		this._value = new nmsBox("td")
		this.add(this._value)
	}
	refresh(item) {
		if (item.value == null || item.value == undefined || item.value == "") {
			if (this._hidden == true) { 
				return;
			}
			this._value_content = undefined;
			this._hidden = true;
			this.hide()
			return;
		}
		if (this._value_content != item.value) {
			this._value.html.textContent = item.value;
			this._value_content = item.value;
		}
		if (this._hidden == true) {
			this.show()
			this._hidden = false;
		}
	}
}
