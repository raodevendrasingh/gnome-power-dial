import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

export default class PowerDialExtension extends Extension {
	constructor(metadata) {
		super(metadata);
		this._settings = null;
		this._keybindingId = null;
	}

	enable() {
		this._settings = this.getSettings();
		this._registerKeybinding();
	}

	_registerKeybinding(retryCount = 0) {
		const maxRetries = 5;
		const retryDelay = 1000;

		try {
			if (this._keybindingId) {
				Main.wm.removeKeybinding("shortcut");
				this._keybindingId = null;
			}

			this._keybindingId = Main.wm.addKeybinding(
				"shortcut",
				this._settings,
				Meta.KeyBindingFlags.NONE,
				Shell.ActionMode.ALL,
				this._showPowerMenu.bind(this)
			);

			if (!this._keybindingId) {
				throw new Error("Keybinding registration returned null/undefined");
			}

		} catch (error) {
			global.logError(`Power Dial: Failed to register keybinding (attempt ${retryCount + 1}): ${error.message}`);

			if (retryCount < maxRetries) {
				GLib.timeout_add(GLib.PRIORITY_DEFAULT, retryDelay, () => {
					this._registerKeybinding(retryCount + 1);
					return GLib.SOURCE_REMOVE;
				});
			} else {
				global.logError(`Power Dial: Failed to register keybinding after ${maxRetries + 1} attempts`);
			}
		}
	}

	disable() {
		try {
			if (this._keybindingId) {
				Main.wm.removeKeybinding("shortcut");
			}
		} catch (error) {
			global.logError(`Power Dial: Error removing keybinding: ${error.message}`);
		} finally {
			this._keybindingId = null;
		}

		this._settings = null;
	}

	_showPowerMenu() {
		let dialog = new ModalDialog.ModalDialog({
			styleClass: "power-dial-dialog",
		});

		const box = new St.BoxLayout({
			vertical: true,
			x_expand: true,
			style_class: "power-dial-box",
		});
		dialog.contentLayout.add_child(box);

		const title = new St.Label({
			text: "Power Dial",
			style_class: "headline",
			x_expand: true,
			x_align: Clutter.ActorAlign.START,
		});
		box.add_child(title);

		const createButton = (labelText, iconName, action, styleClass) => {
			const button = new St.Button({
				style_class: `button ${styleClass || ""}`,
				can_focus: true,
				x_expand: true,
			});
			const buttonBox = new St.BoxLayout({
				style: "spacing: 12px;",
			});
			if (iconName) {
				buttonBox.add_child(
					new St.Icon({
						icon_name: iconName,
						icon_size: 24,
						style_class: "system-status-icon",
					})
				);
			}
			buttonBox.add_child(
				new St.Label({
					text: labelText,
					x_expand: true,
					y_align: Clutter.ActorAlign.CENTER,
				})
			);
			button.set_child(buttonBox);
			button.connect("clicked", () => {
				action();
				dialog.close();
			});
			return button;
		};

		box.add_child(
			createButton(
				"Suspend",
				null,
				this._suspend.bind(this),
				"suspend-button"
			)
		);
		box.add_child(
			createButton(
				"Restart",
				null,
				this._reboot.bind(this),
				"restart-button"
			)
		);
		box.add_child(
			createButton(
				"Power Off",
				null,
				this._powerOff.bind(this),
				"poweroff-button"
			)
		);
		box.add_child(
			createButton(
				"Log Out",
				null,
				this._logout.bind(this),
				"logout-button"
			)
		);

		dialog.setButtons([
			{
				label: "Cancel",
				action: () => dialog.close(),
				default: true,
				key: Clutter.KEY_Escape,
			},
		]);

		dialog.open();
	}

	_logout() {
		Gio.DBus.session.call(
			"org.gnome.SessionManager",
			"/org/gnome/SessionManager",
			"org.gnome.SessionManager",
			"Logout",
			new GLib.Variant("(u)", [0]),
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	_suspend() {
		this._callLogind("Suspend", true);
	}

	_reboot() {
		Gio.DBus.session.call(
			"org.gnome.SessionManager",
			"/org/gnome/SessionManager",
			"org.gnome.SessionManager",
			"Reboot",
			null,
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	_powerOff() {
		Gio.DBus.session.call(
			"org.gnome.SessionManager",
			"/org/gnome/SessionManager",
			"org.gnome.SessionManager",
			"Shutdown",
			null,
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}

	_callLogind(method, interactive) {
		Gio.DBus.system.call(
			"org.freedesktop.login1",
			"/org/freedesktop/login1",
			"org.freedesktop.login1.Manager",
			method,
			new GLib.Variant("(b)", [interactive]),
			null,
			Gio.DBusCallFlags.NONE,
			-1,
			null,
			null
		);
	}
}
