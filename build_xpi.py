from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Research_Library_Paper_Importer.xpi"
TEMP_OUT = ROOT / "Research_Library_Paper_Importer.xpi.tmp"
UPDATES_OUT = ROOT / "updates.json"
UPDATES_TEMP_OUT = ROOT / "updates.json.tmp"
REPOSITORY_URL = "https://github.com/Royychinn/research-library-paper-importer"
UPDATE_URL = "https://raw.githubusercontent.com/Royychinn/research-library-paper-importer/main/updates.json"

FILES = [
    "manifest.json",
    "bootstrap.js",
    "paper-importer.js",
    "README.md",
    "chrome/content/settings.xhtml",
    "chrome/content/settings.js",
    "chrome/content/icons/favicon.svg",
]

JS_FILES = [
    "bootstrap.js",
    "paper-importer.js",
    "chrome/content/settings.js",
]


def add_file(zf: ZipFile, rel: str) -> None:
    source = ROOT / rel
    info = ZipInfo(rel.replace("\\", "/"))
    info.compress_type = ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o644 << 16
    with source.open("rb") as f:
        zf.writestr(info, f.read())


def validate_sources() -> dict:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    zotero_manifest = manifest.get("applications", {}).get("zotero", {})
    for required in ("id", "update_url", "strict_max_version"):
        if not zotero_manifest.get(required):
            raise RuntimeError(f"applications.zotero.{required} is required by Zotero")
    if not zotero_manifest["update_url"].startswith("https://"):
        raise RuntimeError("applications.zotero.update_url must use HTTPS")
    if manifest.get("homepage_url") != REPOSITORY_URL:
        raise RuntimeError("manifest homepage_url does not match the GitHub repository")
    if zotero_manifest["update_url"] != UPDATE_URL:
        raise RuntimeError("manifest update_url does not match the GitHub updates.json URL")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    match = re.search(r"当前版本：`([^`]+)`", readme)
    if not match or match.group(1) != version:
        raise RuntimeError("README version does not match manifest.json")

    for rel in JS_FILES:
        subprocess.run(["node", "--check", str(ROOT / rel)], check=True)
    subprocess.run(["node", str(ROOT / "tests" / "test-paper-importer.js")], check=True)
    return manifest


def write_updates_manifest(manifest: dict, digest: str) -> None:
    version = manifest["version"]
    zotero_manifest = manifest["applications"]["zotero"]
    document = {
        "addons": {
            zotero_manifest["id"]: {
                "updates": [
                    {
                        "version": version,
                        "update_link": (
                            f"{REPOSITORY_URL}/releases/download/"
                            f"v{version}/{OUT.name}"
                        ),
                        "update_hash": f"sha256:{digest}",
                        "applications": {
                            "zotero": {
                                "strict_min_version": zotero_manifest["strict_min_version"],
                                "strict_max_version": zotero_manifest["strict_max_version"],
                            }
                        },
                    }
                ]
            }
        }
    }
    UPDATES_TEMP_OUT.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    UPDATES_TEMP_OUT.replace(UPDATES_OUT)


def main() -> None:
    manifest = validate_sources()
    if TEMP_OUT.exists():
        TEMP_OUT.unlink()
    if UPDATES_TEMP_OUT.exists():
        UPDATES_TEMP_OUT.unlink()
    try:
        with ZipFile(TEMP_OUT, "w", compression=ZIP_DEFLATED) as zf:
            for rel in FILES:
                add_file(zf, rel)
        with ZipFile(TEMP_OUT) as zf:
            if zf.testzip() is not None:
                raise RuntimeError("Generated XPI failed CRC validation")
            packaged_version = json.loads(zf.read("manifest.json").decode("utf-8"))["version"]
            if packaged_version != json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]:
                raise RuntimeError("Generated XPI manifest version mismatch")
        digest = hashlib.sha256(TEMP_OUT.read_bytes()).hexdigest()
        TEMP_OUT.replace(OUT)
        write_updates_manifest(manifest, digest)
    finally:
        if TEMP_OUT.exists():
            TEMP_OUT.unlink()
        if UPDATES_TEMP_OUT.exists():
            UPDATES_TEMP_OUT.unlink()
    print(f"XPI: {OUT}")
    print(f"SHA256: {digest}")
    print(f"Update manifest: {UPDATES_OUT}")


if __name__ == "__main__":
    main()
