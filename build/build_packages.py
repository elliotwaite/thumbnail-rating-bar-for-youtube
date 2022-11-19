"""Creates a package.zip file that contains the extension's files."""
from pathlib import Path
import zipfile

ROOT_DIR = Path(__file__).parent.parent
EXTENSION_DIR = ROOT_DIR / 'extension'
MANIFEST_V2_DIR = ROOT_DIR / 'manifest-v2'
OUTPUT_DIR = Path(__file__).parent
EXCLUDED_FILENAMES = ['.DS_Store']


def create_package(filename, manifest_version=3):
    package_path = OUTPUT_DIR / filename

    print(f'\nGenerating package: {package_path}')
    print(f'Zipped files:')
    with zipfile.ZipFile(package_path, 'w') as z:
        for path in EXTENSION_DIR.rglob('*'):
            if path.name in EXCLUDED_FILENAMES:
                continue

            relative_path = path.relative_to(EXTENSION_DIR)

            if (
                manifest_version == 2
                and (MANIFEST_V2_DIR / relative_path).exists()
            ):
                path = MANIFEST_V2_DIR / relative_path

            z.write(path, relative_path)
            print(f'    {path.relative_to(ROOT_DIR)}')


def main():
    create_package('package-chrome.zip')
    create_package('package-firefox.zip', manifest_version=2)
    create_package('package-edge.zip', manifest_version=2)


if __name__ == '__main__':
    main()
