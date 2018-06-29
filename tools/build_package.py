"""Build the _package.zip file that will be uploaded to the Chrome Web Store."""

import zipfile

PACKAGE_FILES = [
  '../images/icon96.png',
  '../images/icon128.png',
  '../libraries/jquery-3.3.1.min.js',
  '../libraries/material.min.css',
  '../libraries/material.min.js',
  '../api-key.js',
  '../content-script.js',
  '../content-style.css',
  '../manifest.json',
  '../options-page.html',
  '../options-popup.html',
  '../options-script.js',
  '../options-style.css',
]

with zipfile.ZipFile('../_package.zip', 'w') as z:
  for path in PACKAGE_FILES:
    z.write(path, compress_type=zipfile.ZIP_DEFLATED)
