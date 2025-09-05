import St from "gi://St";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";

export class DialogManager {
	constructor(settings, powerActions) {
		this._settings = settings;
		this._powerActions = powerActions;
		this._dialog = null;
		this._isDialogOpen = false;
		this._tiles = null;
		this._currentTileIndex = 0;
		this._focusTimeoutId = null;
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
			if (this._focusTimeoutId) {
				GLib.source_remove(this._focusTimeoutId);
				this._focusTimeoutId = null;
			}
			this._focusTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
				if (this._tiles[0]) {
					this._tiles[0].grab_key_focus();
					this._tiles[0].add_style_class_name('focused-tile');
				}
				this._focusTimeoutId = null;
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
				this._powerActions._suspend.bind(this._powerActions),
				"suspend-button"
			)
		);
		box.add_child(
			createButton(
				"Restart",
				null,
				this._powerActions._reboot.bind(this._powerActions),
				"restart-button"
			)
		);
		box.add_child(
			createButton(
				"Power Off",
				null,
				this._powerActions._powerOff.bind(this._powerActions),
				"poweroff-button"
			)
		);
		box.add_child(
			createButton(
				"Log Out",
				null,
				this._powerActions._logout.bind(this._powerActions),
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
				this._powerActions._suspend.bind(this._powerActions),
				"suspend-tile"
			)
		);
		firstRow.add_child(
			createTile(
				"Restart",
				"system-reboot-symbolic",
				this._powerActions._reboot.bind(this._powerActions),
				"restart-tile"
			)
		);

		secondRow.add_child(
			createTile(
				"Power Off",
				"system-shutdown-symbolic",
				this._powerActions._powerOff.bind(this._powerActions),
				"poweroff-tile"
			)
		);
		secondRow.add_child(
			createTile(
				"Log Out",
				"system-log-out-symbolic",
				this._powerActions._logout.bind(this._powerActions),
				"logout-tile"
			)
		);

		gridContainer.add_child(firstRow);
		gridContainer.add_child(secondRow);

		box.add_child(gridContainer);
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

		const tilesPerRow = 2;
		const currentRow = Math.floor(this._currentTileIndex / tilesPerRow);
		const currentCol = this._currentTileIndex % tilesPerRow;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].remove_style_class_name('focused-tile');
		}

		let targetIndex;

		if (direction === -1) { // Up
			if (currentRow === 0) {
				// Wrap to bottom row, same column
				targetIndex = (1 * tilesPerRow) + currentCol;
			} else {
				targetIndex = (currentRow - 1) * tilesPerRow + currentCol;
			}
		} else { // Down
			if (currentRow === 1) {
				// Wrap to top row, same column
				targetIndex = (0 * tilesPerRow) + currentCol;
			} else {
				targetIndex = (currentRow + 1) * tilesPerRow + currentCol;
			}
		}

		this._currentTileIndex = targetIndex;

		if (this._tiles[this._currentTileIndex]) {
			this._tiles[this._currentTileIndex].grab_key_focus();
			this._tiles[this._currentTileIndex].add_style_class_name('focused-tile');
		}
	}

	destroy() {
		if (this._dialog) {
			this._dialog.close();
			this._dialog = null;
			this._isDialogOpen = false;
		}

		if (this._focusTimeoutId) {
			GLib.source_remove(this._focusTimeoutId);
			this._focusTimeoutId = null;
		}
	}

	get isDialogOpen() {
		return this._isDialogOpen;
	}
}
