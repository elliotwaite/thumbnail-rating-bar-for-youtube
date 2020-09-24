"""Build the extension.

Creates the chrome-package.zip file for Chrome, and the
firefox-package.zip file for Firefox.
"""
import os
import shutil
import zipfile

EXTENSION_DIR = '../extension/'


def zip_dir(source_dir, output_path, excluded_filenames=None):
    if excluded_filenames is None:
        excluded_filenames = ['.DS_Store']
    print(f'Zipping: {source_dir} --> {output_path}')
    with zipfile.ZipFile(output_path, 'w') as z:
        for dir_path, dir_names, filenames in os.walk(source_dir):
            for filename in filenames:
                if filename in excluded_filenames:
                    continue
                path = os.path.join(dir_path, filename)
                path_in_zip = path[len(source_dir) :]
                print(path_in_zip)
                z.write(path, path_in_zip)
    print()


def build_chrome_package():
    zip_dir(EXTENSION_DIR, 'chrome-package.zip')


def build_firefox_package():
    # This separate build is required to customize the manifest.json
    # file for Firefox.
    tmp_dir = 'tmp'
    shutil.copytree(EXTENSION_DIR, tmp_dir)
    manifest_path = os.path.join(tmp_dir, 'manifest.json')
    with open(manifest_path, 'r') as f:
        manifest_text = f.read()

    # Removing the `"persistent": false` line from the manifest.json file,
    # since Firefox does not support persistent background scripts).
    #
    # TODO: Remove this step once Firefox supports non-persistent
    # background scripts.
    # https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
    manifest_text = manifest_text.replace(',\n    "persistent": false', '')
    assert manifest_text.find('persistent') == -1, (
        'Persistent background scripts are not supported by Firefox, however, '
        'the word "persistent" was found in the manifest.json file for the '
        'Firefox package.'
    )

    # Change the "chrome_style" key to "browser_style". They are
    # equivalent, but Firefox uses the "browser_style" key instead.
    # https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Browser_styles
    manifest_text = manifest_text.replace('"chrome_style": false', '"browser_style": false')
    assert manifest_text.find('chrome_style') == -1, (
        'The "chrome_style" key is not supported by Firefox, however,the '
        'word "chrome_style" was found in the manifest.json file for the '
        'Firefox package.'
    )

    with open(manifest_path, 'w') as f:
        f.write(manifest_text)
    zip_dir(tmp_dir, 'firefox-package.zip')
    shutil.rmtree(tmp_dir)


def main():
    build_chrome_package()
    build_firefox_package()


if __name__ == '__main__':
    main()
