import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

export class IndicatorManager {
	constructor(settings, showPowerMenuCallback) {
		this._settings = settings;
		this._showPowerMenuCallback = showPowerMenuCallback;
		this._indicator = null;
		this._settingsConnectionId = null;
	}

	_createIndicator() {
		this._indicator = new PanelMenu.Button(0.0, "Power Dial", false);

		let icon = new St.Icon({
			icon_name: "system-shutdown-symbolic",
			style_class: "system-status-icon"
		});

		this._indicator.add_child(icon);

		this._indicator.connect("button-press-event", () => {
			this._showPowerMenuCallback();
		});

		Main.panel.addToStatusArea("power-dial", this._indicator, 0, "right");
	}

	_handleTopBarIconSettingChanged() {
		const showIcon = this._settings.get_boolean("show-top-bar-icon");

		if (showIcon && !this._indicator) {
			this._createIndicator();
		} else if (!showIcon && this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}
	}

	setup() {
		if (this._settings.get_boolean("show-top-bar-icon")) {
			this._createIndicator();
		}

		this._settingsConnectionId = this._settings.connect("changed::show-top-bar-icon", () => {
			this._handleTopBarIconSettingChanged();
		});
	}

	destroy() {
		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}

		if (this._settingsConnectionId) {
			this._settings.disconnect(this._settingsConnectionId);
			this._settingsConnectionId = null;
		}
	}
}
