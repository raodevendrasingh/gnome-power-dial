import Gio from "gi://Gio";
import GLib from "gi://GLib";

export class PowerActions {
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
