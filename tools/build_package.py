"""Build the extension (create the package.zip file) for Chrome and Firefox."""

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
        path_in_zip = path[len(source_dir):]
        print(path_in_zip)
        z.write(path, path_in_zip)
  print()


def main():
  # Build the Chrome package.
  zip_dir(EXTENSION_DIR, 'chrome-package.zip')

  # TODO: Remove this separate build process once Firefox supports
  #       nonpersistent background scripts.
  #       https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background
  # Build the Firefox package (removing the `"persistent": false` line from the
  # manifest.json file, since Firefox does not support persistent background
  # scripts).
  tmp_dir = 'tmp'
  shutil.copytree(EXTENSION_DIR, tmp_dir)
  manifest_path = os.path.join(tmp_dir, 'manifest.json')
  with open(manifest_path, 'r') as f:
    text = f.read()
  text = text.replace(',\n    "persistent": false', '')
  assert text.find('persistent') == -1, (
      'Persistent background scripts are not supported by Firefox, however, '
      'the word "persistent" was found in the manifest.json file for the '
      'Firefox package.')
  with open(manifest_path, 'w') as f:
    f.write(text)
  zip_dir(tmp_dir, 'firefox-package.zip')
  shutil.rmtree(tmp_dir)


if __name__ == '__main__':
  main()
