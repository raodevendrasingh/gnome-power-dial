import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import Meta from "gi://Meta";
import Shell from "gi://Shell";

export default class PowerDialExtension extends Extension {
	constructor(metadata) {
		super(metadata);
		this._settings = null;
		this._keybindingId = null;
		this._dialog = null;
		this._isDialogOpen = false;
		this._indicator = null;
		this._settingsConnectionId = null;
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
		this._tiles = [];
		this._currentTileIndex = 0;

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

			tile.connect('key-press-event', (actor, event) => {
				const key = event.get_key_symbol();

				switch (key) {
					case Clutter.KEY_Left:
						this._navigateTiles(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Right:
					case Clutter.KEY_Tab:
						this._navigateTiles(1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Up:
						this._navigateTilesVertical(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Down:
						this._navigateTilesVertical(1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_ISO_Left_Tab:
						this._navigateTiles(-1);
						return Clutter.EVENT_STOP;
					case Clutter.KEY_Return:
					case Clutter.KEY_KP_Enter:
						action();
						this._dialog.close();
						return Clutter.EVENT_STOP;
				}

				return Clutter.EVENT_PROPAGATE;
			});

			this._tiles.push(tile);

			return tile;
		};

		const gridContainer = new St.BoxLayout({
			vertical: true,
			style: "spacing: 8px; margin-top: 10px;",
			x_expand: true,
			can_focus: false,
		});

		const firstRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
			can_focus: false,
		});

		const secondRow = new St.BoxLayout({
			style: "spacing: 8px;",
			x_expand: true,
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

		if (this._settings.get_string("view-mode") === "tiled" && this._tiles && this._tiles.length > 0) {
			GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
				if (this._tiles[0]) {
					this._tiles[0].grab_key_focus();
					this._tiles[0].add_style_class_name('focused-tile');
				}
				return GLib.SOURCE_REMOVE;
			});
		}

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
			if (this._tiles) {
				this._tiles.forEach(tile => {
					tile.remove_style_class_name('focused-tile');
				});
			}
			this._tiles = null;
			this._currentTileIndex = 0;
		});

		dialog.open();
	}

	_navigateTiles(direction) {
		if (!this._tiles || this._tiles.length === 0) {
			return;
		}

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].remove_style_class_name('focused-tile');
		}

		let newIndex = this._currentTileIndex + direction;

		if (newIndex < 0) {
			newIndex = this._tiles.length - 1;
		} else if (newIndex >= this._tiles.length) {
			newIndex = 0;
		}

		this._currentTileIndex = newIndex;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].grab_key_focus();
			this._tiles[this._currentTileIndex].add_style_class_name('focused-tile');
		}
	}

	_navigateTilesVertical(direction) {
		if (!this._tiles || this._tiles.length === 0) {
			return;
		}

		if (this._currentTileIndex === 4) {
			if (direction === -1) {
				this._navigateTiles(-1);
			} else {
				this._navigateTiles(1);
				this._currentTileIndex = 0;
			}
			return;
		}

		const tilesPerRow = 2;
		const currentRow = Math.floor(this._currentTileIndex / tilesPerRow);
		const currentCol = this._currentTileIndex % tilesPerRow;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].remove_style_class_name('focused-tile');
		}

		let targetIndex;

		if (direction === -1) {
			if (currentRow === 0) {
				targetIndex = 4;
			} else {
				targetIndex = (currentRow - 1) * tilesPerRow + currentCol;
			}
		} else {
			if (currentRow === 1) {
				targetIndex = 4;
			} else {
				targetIndex = (currentRow + 1) * tilesPerRow + currentCol;
			}
		}

		this._currentTileIndex = targetIndex;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].grab_key_focus();
			if (this._currentTileIndex < 4) {
				this._tiles[this._currentTileIndex].add_style_class_name('focused-tile');
			}
		}
	}

	enable() {
		this._settings = this.getSettings();
		this._registerKeybinding();

		if (this._settings.get_boolean("show-top-bar-icon")) {
			this._createIndicator();
		}

		this._settingsConnectionId = this._settings.connect("changed::show-top-bar-icon", () => {
			this._handleTopBarIconSettingChanged();
		});
	}

	_createIndicator() {
		this._indicator = new PanelMenu.Button(0.0, "Power Dial", false);

		let icon = new St.Icon({
			icon_name: "system-shutdown-symbolic",
			style_class: "system-status-icon"
		});

		this._indicator.add_child(icon);

		this._indicator.connect("button-press-event", () => {
			this._showPowerMenu();
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

		if (this._indicator) {
			this._indicator.destroy();
			this._indicator = null;
		}

		if (this._settingsConnectionId) {
			this._settings.disconnect(this._settingsConnectionId);
			this._settingsConnectionId = null;
		}

		this._settings = null;
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
