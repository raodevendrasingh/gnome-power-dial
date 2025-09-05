import * as Main from "resource:///org/gnome/shell/ui/main.js";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import GLib from "gi://GLib";

export class KeybindingManager {
	constructor(settings, showPowerMenuCallback) {
		this._settings = settings;
		this._showPowerMenuCallback = showPowerMenuCallback;
		this._keybindingId = null;
		this._keybindingRetryTimeoutId = null;
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
				this._showPowerMenuCallback
			);

			if (!this._keybindingId) {
				throw new Error("Keybinding registration returned null/undefined");
			}

		} catch (error) {
			global.logError(`Power Dial: Failed to register keybinding (attempt ${retryCount + 1}): ${error.message}`);

			if (retryCount < maxRetries) {
				if (this._keybindingRetryTimeoutId) {
					GLib.source_remove(this._keybindingRetryTimeoutId);
					this._keybindingRetryTimeoutId = null;
				}
				this._keybindingRetryTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, retryDelay, () => {
					this._registerKeybinding(retryCount + 1);
					this._keybindingRetryTimeoutId = null;
					return GLib.SOURCE_REMOVE;
				});
			} else {
				global.logError(`Power Dial: Failed to register keybinding after ${maxRetries + 1} attempts`);
			}
		}
	}

	destroy() {
		try {
			if (this._keybindingId) {
				Main.wm.removeKeybinding("shortcut");
			}
		} catch (error) {
			global.logError(`Power Dial: Error removing keybinding: ${error.message}`);
		} finally {
			this._keybindingId = null;
		}

		if (this._keybindingRetryTimeoutId) {
			GLib.source_remove(this._keybindingRetryTimeoutId);
			this._keybindingRetryTimeoutId = null;
		}
	}

	get keybindingId() {
		return this._keybindingId;
	}
}
