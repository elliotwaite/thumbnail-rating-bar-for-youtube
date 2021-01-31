"""Builds the extension for multiple browsers."""
import os
import shutil
import tempfile
import zipfile

CUR_DIR = os.path.join(os.path.dirname(__file__))
BUILD_DIR = os.path.abspath(os.path.join(CUR_DIR, '../build/'))
EXTENSION_DIR = os.path.abspath(os.path.join(CUR_DIR, '../extension/'))
VALID_BROWSERS = 'chrome', 'firefox', 'edge', 'opera', 'safari', 'firefox_android'
TARGET_BROWSERS = 'chrome', 'firefox', 'edge'


def zip_dir(source_dir, output_path, excluded_filenames=None):
    if excluded_filenames is None:
        excluded_filenames = ['.DS_Store']
    print(f'Zip source path: {source_dir}')
    print(f'Zip output path: {output_path}')
    print(f'Zipped files:')
    with zipfile.ZipFile(output_path, 'w') as z:
        for dir_path, dir_names, filenames in os.walk(source_dir):
            for filename in filenames:
                if filename in excluded_filenames:
                    continue
                path = os.path.join(dir_path, filename)
                path_in_zip = path[len(source_dir) :]
                print(f'  {path_in_zip}')
                z.write(path, path_in_zip)
    print()


def build_package(browser):
    assert browser in VALID_BROWSERS, 'Unsupported browser specified.'
    package_path = os.path.join(BUILD_DIR, f'{browser}-package.zip')

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_extension_dir = os.path.join(tmp_dir, 'extension')
        shutil.copytree(EXTENSION_DIR, tmp_extension_dir)
        manifest_path = os.path.join(tmp_extension_dir, 'manifest.json')
        with open(manifest_path, 'r') as f:
            manifest_text = f.read()

        if browser in ('firefox', 'safari', 'firefox_android'):
            # Remove the `"persistent": false` line from the manifest.json file
            # for browsers that do not support persistent background scripts.
            # https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
            manifest_text = manifest_text.replace(',\n    "persistent": false', '')
            assert manifest_text.find('persistent') == -1, (
                'Persistent background scripts are not supported by Firefox, however, '
                'the word "persistent" was found in the manifest.json file for the '
                'Firefox package.'
            )

        if browser not in ('chrome', 'opera'):
            # Change the "chrome_style" key to "browser_style". They are
            # equivalent, but some browsers use the "browser_style"
            # key instead.
            # https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Browser_styles
            manifest_text = manifest_text.replace('"chrome_style": false', '"browser_style": false')
            assert manifest_text.find('chrome_style') == -1, (
                'The "chrome_style" key is not supported by Firefox, however,the '
                'word "chrome_style" was found in the manifest.json file for the '
                'Firefox package.'
            )

        with open(manifest_path, 'w') as f:
            f.write(manifest_text)

        zip_dir(tmp_extension_dir, package_path)
        print(f'Generated package: {package_path}\n')


def main():
    os.makedirs(BUILD_DIR, exist_ok=True)
    for browser in TARGET_BROWSERS:
        build_package(browser)


if __name__ == '__main__':
    main()
