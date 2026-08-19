#!/usr/bin/env python3
"""
Minimal file-based Secret Service for headless Linux servers.
Implements the org.freedesktop.Secret.Service D-Bus interface so that
libsecret-based apps (like the Unity CLI) can store/retrieve secrets
without gnome-keyring or a display.

Secrets are stored in ~/.local/share/file-keyring/secrets.json (plaintext).
This is intentionally simple — it is NOT a security layer, just a
persistence layer for a headless dev VM.
"""

import dbus
import dbus.service
import json
import os
import uuid
from gi.repository import GLib

HOME = os.environ.get("HOME", "/tmp")
SECRET_FILE = os.path.join(HOME, ".local", "share", "file-keyring", "secrets.json")

BUS_NAME = "org.freedesktop.secrets"
SERVICE_PATH = "/org/freedesktop/secrets"
COLLECTION_PATH = SERVICE_PATH + "/collection/default"
SESSION_BASE = SERVICE_PATH + "/session"

IFACE_SERVICE = "org.freedesktop.Secret.Service"
IFACE_COLLECTION = "org.freedesktop.Secret.Collection"
IFACE_ITEM = "org.freedesktop.Secret.Item"
IFACE_SESSION = "org.freedesktop.Secret.Session"
IFACE_PROMPT = "org.freedesktop.Secret.Prompt"

# ── secret store (JSON-backed) ──────────────────────────────────────────────

_secrets: dict[str, dict] = {}


def _load():
    global _secrets
    try:
        with open(SECRET_FILE, "r") as f:
            _secrets = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _secrets = {}


def _save():
    os.makedirs(os.path.dirname(SECRET_FILE), exist_ok=True)
    tmp = SECRET_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(_secrets, f, indent=2)
    os.replace(tmp, SECRET_FILE)


def _search(attrs: dict) -> list[str]:
    out = []
    for path, item in _secrets.items():
        ia = item.get("attributes", {})
        if all(ia.get(k) == v for k, v in attrs.items()):
            out.append(path)
    return out


# ── helper to build a secret struct (oayays) ───────────────────────────────

def _secret_struct(session, value: str, content_type: str = "text/plain"):
    return dbus.Struct(
        (
            dbus.ObjectPath(str(session)),
            dbus.Array([], signature="y"),
            dbus.ByteArray(value.encode("utf-8")),
            dbus.String(content_type),
        ),
        signature="(oayays)",
    )


# ── Session object ──────────────────────────────────────────────────────────

class SessionObject(dbus.service.Object):
    @dbus.service.method(IFACE_SESSION, in_signature="", out_signature="")
    def Close(self):
        self.remove_from_connection()


# ── Item object (registered dynamically) ────────────────────────────────────

class ItemObject(dbus.service.Object):
    @dbus.service.method(IFACE_ITEM, in_signature="o", out_signature="(oayays)")
    def GetSecret(self, session):
        item = _secrets.get(self._object_path)
        if not item:
            raise dbus.exceptions.DBusException(
                f"Item not found: {self._object_path}")
        return _secret_struct(session, item["value"],
                              item.get("content_type", "text/plain"))

    @dbus.service.method(IFACE_ITEM, in_signature="", out_signature="o")
    def Delete(self):
        _secrets.pop(self._object_path, None)
        _save()
        self.remove_from_connection()
        return dbus.ObjectPath("/")

    @dbus.service.method("org.freedesktop.DBus.Properties",
                          in_signature="ss", out_signature="v")
    def Get(self, iface, prop):
        item = _secrets.get(self._object_path, {})
        if iface == IFACE_ITEM:
            if prop == "Label":
                return dbus.String(item.get("label", ""))
            if prop == "Locked":
                return dbus.Boolean(False)
            if prop == "Attributes":
                return dbus.Dictionary(
                    {dbus.String(k): dbus.String(v)
                     for k, v in item.get("attributes", {}).items()},
                    signature="ss")
            if prop == "Created":
                return dbus.UInt64(item.get("created", 0))
            if prop == "Modified":
                return dbus.UInt64(item.get("modified", 0))
        return dbus.String("")

    @dbus.service.method("org.freedesktop.DBus.Properties",
                          in_signature="ssv", out_signature="")
    def Set(self, iface, prop, val):
        if self._object_path not in _secrets:
            return
        if prop == "Label":
            _secrets[self._object_path]["label"] = str(val)
        _save()


# ── Collection object ───────────────────────────────────────────────────────

class CollectionObject(dbus.service.Object):
    @dbus.service.method(IFACE_COLLECTION,
                          in_signature="a{sv}(oayays)b", out_signature="oo")
    def CreateItem(self, properties, secret, replace):
        session = secret[0]
        value_bytes = secret[2]
        content_type = str(secret[3]) if len(secret) > 3 else "text/plain"
        value = bytes(value_bytes).decode("utf-8", errors="replace")

        label = ""
        attributes = {}
        for key, val in properties.items():
            if key == "org.freedesktop.Secret.Item.Label":
                label = str(val)
            elif key == "org.freedesktop.Secret.Item.Attributes":
                attributes = {str(k): str(v) for k, v in dict(val).items()}

        if replace and attributes:
            for p in _search(attributes):
                _secrets.pop(p, None)

        item_path = f"{COLLECTION_PATH}/{uuid.uuid4().hex}"
        _secrets[item_path] = {
            "label": label,
            "attributes": attributes,
            "value": value,
            "content_type": content_type,
            "created": int(uuid.uuid4().time_low),
            "modified": int(uuid.uuid4().time_low),
        }
        _save()
        ItemObject(self.connection, item_path)
        return (dbus.ObjectPath(item_path), dbus.ObjectPath("/"))

    @dbus.service.method(IFACE_COLLECTION, in_signature="a{ss}", out_signature="ao")
    def SearchItems(self, attributes):
        return [dbus.ObjectPath(p) for p in _search(dict(attributes))]

    @dbus.service.method(IFACE_COLLECTION, in_signature="", out_signature="o")
    def Delete(self):
        return dbus.ObjectPath("/")

    @dbus.service.method("org.freedesktop.DBus.Properties",
                          in_signature="ss", out_signature="v")
    def Get(self, iface, prop):
        if prop == "Label":
            return dbus.String("default")
        if prop == "Locked":
            return dbus.Boolean(False)
        if prop == "Created":
            return dbus.UInt64(0)
        if prop == "Modified":
            return dbus.UInt64(0)
        return dbus.String("")

    @dbus.service.method("org.freedesktop.DBus.Properties",
                          in_signature="ssv", out_signature="")
    def Set(self, iface, prop, val):
        pass  # no-op


# ── Service object (root) ──────────────────────────────────────────────────

class SecretService(dbus.service.Object):
    @dbus.service.method(IFACE_SERVICE, in_signature="sv", out_signature="vo")
    def OpenSession(self, algorithm, input_val):
        path = f"{SESSION_BASE}/{uuid.uuid4().hex}"
        SessionObject(self.connection, path)
        return (dbus.Array([], signature="y"), dbus.ObjectPath(path))

    @dbus.service.method(IFACE_SERVICE, in_signature="a{ss}", out_signature="aoao")
    def SearchItems(self, attributes):
        found = _search(dict(attributes))
        return ([dbus.ObjectPath(p) for p in found], [])

    @dbus.service.method(IFACE_SERVICE, in_signature="", out_signature="ao")
    def GetCollections(self):
        return [dbus.ObjectPath(COLLECTION_PATH)]

    @dbus.service.method(IFACE_SERVICE, in_signature="a{sv}s", out_signature="oo")
    def CreateCollection(self, properties, alias):
        return (dbus.ObjectPath(COLLECTION_PATH), dbus.ObjectPath("/"))

    @dbus.service.method(IFACE_SERVICE, in_signature="aoo",
                          out_signature="a{o(oayays)}")
    def GetSecrets(self, items, session):
        out = {}
        for ip in items:
            item = _secrets.get(str(ip))
            if item:
                out[dbus.ObjectPath(str(ip))] = _secret_struct(
                    session, item["value"], item.get("content_type", "text/plain"))
        return out

    @dbus.service.method(IFACE_SERVICE, in_signature="ao", out_signature="aoo")
    def Lock(self, objects):
        return ([], dbus.ObjectPath("/"))

    @dbus.service.method(IFACE_SERVICE, in_signature="ao", out_signature="aoo")
    def Unlock(self, objects):
        return ([dbus.ObjectPath(o) for o in objects], dbus.ObjectPath("/"))

    @dbus.service.method(IFACE_SERVICE, in_signature="s", out_signature="o")
    def ReadAlias(self, alias):
        if alias == "default":
            return dbus.ObjectPath(COLLECTION_PATH)
        return dbus.ObjectPath("/")

    @dbus.service.method(IFACE_SERVICE, in_signature="os", out_signature="")
    def SetAlias(self, name, collection):
        pass  # no-op


# ── main ───────────────────────────────────────────────────────────────────

def main():
    _load()
    bus = dbus.SessionBus()
    dbus.service.BusName(BUS_NAME, bus)
    SecretService(bus, SERVICE_PATH)
    CollectionObject(bus, COLLECTION_PATH)
    for path in _secrets:
        ItemObject(bus, path)
    print("[file-secret-service] ready, "
          f"{len(_secrets)} secrets loaded", flush=True)
    GLib.MainLoop().run()


if __name__ == "__main__":
    main()
