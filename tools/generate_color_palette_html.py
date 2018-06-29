"""Generate the HTML for the color palette.

The colors in 'color_palette_colors.csv' are from Material Design's color
system. They are the first 10 shades of each color. The A100, A200, A400, A700
colors shades were not included. Material Design's color system:
https://material.io/design/color/the-color-system.html#tools-for-picking-colors
"""
import numpy as np

# Import the matrix of colors.
colors = np.genfromtxt('color_palette_colors.csv')

# Print out the HTML for the color palette in row major format.
print('')
print('<div class="color-palette">')
for row in colors:
  print('  <div>')
  for color in row:
    print('    <div data-color="%s" style="background-color:#%s"></div>'
          % (color, color))
  print('  </div>')
print('</div>')
print('')
