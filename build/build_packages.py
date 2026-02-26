"""Creates a package.zip file that contains the extension's files."""

import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
EXTENSION_DIR = ROOT_DIR / "extension"
EXTENSION_OVERRIDES_DIR = ROOT_DIR / "extension-overrides"
EDGE_OVERRIDES_DIR = EXTENSION_OVERRIDES_DIR / "edge"
MANIFEST_V2_OVERRIDES_DIR = EXTENSION_OVERRIDES_DIR / "manifest-v2"
OUTPUT_DIR = Path(__file__).parent
EXCLUDED_FILENAMES = [".DS_Store"]


def create_package(browser, manifest_version=3):
    filename = f"package-{browser}.zip"
    package_path = OUTPUT_DIR / filename

    print(f"\nGenerating package: {package_path}")
    print("Zipped files:")
    with zipfile.ZipFile(package_path, "w") as z:
        for path in EXTENSION_DIR.rglob("*"):
            if path.name in EXCLUDED_FILENAMES:
                continue

            relative_path = path.relative_to(EXTENSION_DIR)

            # The Edge overrides take precedence over the manifest v2 overrides.
            if browser == "edge" and (EDGE_OVERRIDES_DIR / relative_path).exists():
                path = EDGE_OVERRIDES_DIR / relative_path
            elif (
                manifest_version == 2
                and (MANIFEST_V2_OVERRIDES_DIR / relative_path).exists()
            ):
                path = MANIFEST_V2_OVERRIDES_DIR / relative_path

            z.write(path, relative_path)
            print(f"    {path.relative_to(ROOT_DIR)}")


def main():
    create_package("chrome")
    create_package("firefox", manifest_version=2)
    create_package("edge", manifest_version=2)


if __name__ == "__main__":
    main()
