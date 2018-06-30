"""Build the package.zip file that will be uploaded to the Chrome Web Store."""

import os
import zipfile

EXTENSION_DIR = '../extension/'

with zipfile.ZipFile('package.zip', 'w') as z:
  for dir_path, dir_names, filenames in os.walk(EXTENSION_DIR):
    for filename in filenames:
      path = os.path.join(dir_path, filename)
      path_in_zip = path[len(EXTENSION_DIR):]
      z.write(path, path_in_zip)
