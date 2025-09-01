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
		this._dialog = null;
		this._isDialogOpen = false;
	}

	_renderDialogView(box) {
		const viewMode = this._settings.get_string("view-mode");

		switch (viewMode) {
			case "tiled":
				this._renderTiledView(box);
				break;
			case "stacked":
			default:
				this._renderStackedView(box);
				break;
		}
	}

	_renderStackedView(box) {
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
				this._dialog.close();
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
	}

	_renderTiledView(box) {
		const createTile = (labelText, iconName, action, styleClass) => {
			const tile = new St.Button({
				style_class: `tile ${styleClass || ""}`,
				can_focus: true,
				x_expand: true,
				y_expand: true,
			});

			const tileBox = new St.BoxLayout({
				style: "spacing: 10px;",
			});

			// if (iconName) {
			// 	tileBox.add_child(
			// 		new St.Icon({
			// 			icon_name: iconName,
			// 			icon_size: 24,
			// 			style_class: "system-status-icon",
			// 		})
			// 	);
			// }

			tileBox.add_child(
				new St.Label({
					text: labelText,
					x_expand: true,
					y_align: Clutter.ActorAlign.CENTER,
					style_class: "tile-label",
				})
			);

			tile.set_child(tileBox);
			tile.connect("clicked", () => {
				action();
				this._dialog.close();
			});

			return tile;
		};

		const gridContainer = new St.BoxLayout({
			vertical: true,
			style: "spacing: 10px; margin-top: 12px;",
			x_expand: true,
			can_focus: false,
		});

		const firstRow = new St.BoxLayout({
			style: "spacing: 10px;",
			x_expand: true,
			y_expand: true,
			can_focus: false,
		});

		firstRow.add_child(
			createTile(
				"Suspend",
				"media-playback-pause-symbolic",
				this._suspend.bind(this),
				"suspend-tile"
			)
		);
		firstRow.add_child(
			createTile(
				"Restart",
				"system-reboot-symbolic",
				this._reboot.bind(this),
				"restart-tile"
			)
		);

		const secondRow = new St.BoxLayout({
			style: "spacing: 10px;",
			x_expand: true,
			y_expand: true,
			can_focus: false,
		});

		secondRow.add_child(
			createTile(
				"Power Off",
				"system-shutdown-symbolic",
				this._powerOff.bind(this),
				"poweroff-tile"
			)
		);
		secondRow.add_child(
			createTile(
				"Log Out",
				"system-log-out-symbolic",
				this._logout.bind(this),
				"logout-tile"
			)
		);

		gridContainer.add_child(firstRow);
		gridContainer.add_child(secondRow);
		box.add_child(gridContainer);
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

		if (this._dialog) {
			this._dialog.close();
			this._dialog = null;
			this._isDialogOpen = false;
		}

		this._settings = null;
	}

	_showPowerMenu() {
		if (this._isDialogOpen) {
			return;
		}

		let dialog = new ModalDialog.ModalDialog({
			styleClass: "power-dial-dialog",
		});

		this._dialog = dialog;
		this._isDialogOpen = true;

		const box = new St.BoxLayout({
			vertical: true,
			x_expand: true,
			style_class: "power-dial-box",
			can_focus: false,
		});
		dialog.contentLayout.add_child(box);

		const title = new St.Label({
			text: "Power Dial",
			style_class: "headline",
			x_expand: true,
			x_align: Clutter.ActorAlign.START,
		});
		box.add_child(title);

		this._renderDialogView(box);

		dialog.setButtons([
			{
				label: "Cancel",
				action: () => dialog.close(),
				default: true,
				key: Clutter.KEY_Escape,
			},
		]);

		dialog.connect("closed", () => {
			this._dialog = null;
			this._isDialogOpen = false;
		});

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
