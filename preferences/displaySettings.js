import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

export class DisplaySettings {
	constructor(settings) {
		this._settings = settings;
	}

	createViewModeRow(displayGroup) {
		const viewModeRow = new Adw.ComboRow({
			title: "Power Dial View",
			subtitle: "Choose how the power options are displayed",
		});
		displayGroup.add(viewModeRow);

		const viewModeModel = new Gtk.StringList();
		viewModeModel.append("Stacked");
		viewModeModel.append("Tiled");
		viewModeRow.set_model(viewModeModel);

		const currentViewMode = this._settings.get_string("view-mode");
		if (currentViewMode === "stacked") {
			viewModeRow.set_selected(0);
		} else if (currentViewMode === "tiled") {
			viewModeRow.set_selected(1);
		}

		viewModeRow.connect("notify::selected", () => {
			const selectedIndex = viewModeRow.get_selected();
			const selectedMode = selectedIndex === 0 ? "stacked" : "tiled";
			this._settings.set_string("view-mode", selectedMode);
		});

		return viewModeRow;
	}

	createTopBarIconRow(displayGroup) {
		const topBarIconRow = new Adw.ActionRow({
			title: "Show Top Bar Icon",
			subtitle: "Display Power Dial icon in the top bar",
		});
		displayGroup.add(topBarIconRow);

		const topBarIconToggle = new Gtk.Switch({
			active: this._settings.get_boolean("show-top-bar-icon"),
			valign: Gtk.Align.CENTER,
		});
		topBarIconRow.add_suffix(topBarIconToggle);

		topBarIconToggle.connect("notify::active", () => {
			this._settings.set_boolean("show-top-bar-icon", topBarIconToggle.get_active());
		});

		return topBarIconRow;
	}
}
