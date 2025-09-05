import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";

export class ShortcutSettings {
	constructor(settings) {
		this._settings = settings;
	}

	updateShortcutDisplay(button) {
		const shortcuts = this._settings.get_strv("shortcut");
		const currentShortcut = shortcuts.length > 0 ? shortcuts[0] : "";

		const displayText = this._formatShortcutForDisplay(currentShortcut);
		button.set_label(displayText || "Set shortcut");
	}

	_formatShortcutForDisplay(shortcut) {
		if (!shortcut) return "";

		let formatted = shortcut
			.replace(/<Super>/g, "Super + ")
			.replace(/<Primary>/g, "Ctrl + ")
			.replace(/<Ctrl>/g, "Ctrl + ")
			.replace(/<Alt>/g, "Alt + ")
			.replace(/<Shift>/g, "Shift + ")
			.replace(/>/g, "");

		const lastPlusIndex = formatted.lastIndexOf(" + ");
		if (lastPlusIndex !== -1) {
			const keyPart = formatted.substring(lastPlusIndex + 3);
			const modifierPart = formatted.substring(0, lastPlusIndex + 3);
			formatted = modifierPart + keyPart.toUpperCase();
		} else {
			formatted = formatted.toUpperCase();
		}

		return formatted;
	}

	setupNativeShortcutCapture(button) {
		button.connect("clicked", () => {
			this._openNativeShortcutDialog(button);
		});
	}

	_openNativeShortcutDialog(button) {
		const dialog = new Gtk.Dialog({
			title: "Set Shortcut",
			modal: true,
			transient_for: button.get_root(),
			resizable: false,
		});

		dialog.add_css_class("shortcut-editor");
		dialog.set_default_size(400, 200);

		const contentArea = dialog.get_content_area();
		contentArea.set_orientation(Gtk.Orientation.VERTICAL);
		contentArea.set_spacing(12);
		contentArea.set_margin_top(12);
		contentArea.set_margin_bottom(12);
		contentArea.set_margin_start(12);
		contentArea.set_margin_end(12);

		const titleLabel = new Gtk.Label({
			label: "Enter new shortcut to change <b>Power Dial</b>.",
			use_markup: true,
			wrap: true,
			justify: Gtk.Justification.CENTER,
			margin_bottom: 12,
		});
		contentArea.append(titleLabel);

		const captureBox = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 8,
			halign: Gtk.Align.CENTER,
			valign: Gtk.Align.CENTER,
		});

		const keyboardRow = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 6,
			halign: Gtk.Align.CENTER,
			margin_top: 8,
			margin_bottom: 8,
		});

		for (let i = 0; i < 4; i++) {
			const keyBox = new Gtk.Label({
				label: "⎵",
				css_classes: ["key-visual"],
				width_chars: 3,
				height_request: 32,
			});
			keyBox.get_style_context().add_class("dim-label");
			keyboardRow.append(keyBox);
		}

		captureBox.append(keyboardRow);

		const statusLabel = new Gtk.Label({
			label: "Press Esc to cancel or Backspace to disable the keyboard shortcut.",
			css_classes: ["dim-label"],
			wrap: true,
			justify: Gtk.Justification.CENTER,
			margin_top: 12,
		});
		captureBox.append(statusLabel);

		contentArea.append(captureBox);

		const keyController = new Gtk.EventControllerKey();
		dialog.add_controller(keyController);

		keyController.connect(
			"key-pressed",
			(controller, keyval, keycode, state) => {
				if (keyval === Gdk.KEY_Escape) {
					dialog.close();
					return true;
				}

				if (keyval === Gdk.KEY_BackSpace) {
					this._settings.set_strv("shortcut", []);
					this.updateShortcutDisplay(button);
					dialog.close();
					return true;
				}

				const shortcut = this._buildShortcutString(keyval, state);

				if (shortcut && this._validateShortcut(shortcut)) {
					this._settings.set_strv("shortcut", [shortcut]);
					this.updateShortcutDisplay(button);
					dialog.close();
				}

				return true;
			}
		);

		dialog.set_can_focus(true);
		dialog.present();
		dialog.grab_focus();
	}

	_buildShortcutString(keyval, state) {
		const modifiers = [];

		if (state & Gdk.ModifierType.CONTROL_MASK) modifiers.push("<Primary>");
		if (state & Gdk.ModifierType.ALT_MASK) modifiers.push("<Alt>");
		if (state & Gdk.ModifierType.SUPER_MASK) modifiers.push("<Super>");
		if (state & Gdk.ModifierType.SHIFT_MASK) modifiers.push("<Shift>");

		const keyName = Gdk.keyval_name(keyval);

		if (modifiers.length === 0) {
			return null;
		}

		return modifiers.join("") + keyName;
	}

	_validateShortcut(shortcut) {
		if (!shortcut || shortcut.length < 3) return false;

		const forbiddenKeys = ["Tab", "Return", "space", "BackSpace"];
		const keyPart = shortcut.replace(/<[^>]+>/g, "");

		if (forbiddenKeys.includes(keyPart)) return false;

		return true;
	}
}
