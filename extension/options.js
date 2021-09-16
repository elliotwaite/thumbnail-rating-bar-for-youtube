const DEFAULT_USER_SETTINGS = {
  barPosition: 'bottom',
  barColor: 'blue-gray',
  barLikesColor: '#3095e3',
  barDislikesColor: '#cfcfcf',
  barColorsSeparator: false,
  barHeight: 4,
  barOpacity: 100,
  barSeparator: false,
  barTooltip: true,
  useOnVideoPage: false,
  showPercentage: false,
  // timeSincePublished: true,
  apiKey: '',
}

function sanitizeHexColor(str) {
  return str.replace(/[^#0-9a-zA-Z]/g, '')
}

function getCssLink(url) {
  return $('<link/>', {
    rel: 'stylesheet',
    type: 'text/css',
    class: 'ytrb-css',
    href: chrome.runtime.getURL(url)
  })
}

function updateCss() {
  $('head').children('.ytrb-css').remove()
  if ($('#bar-height').val() !== '0') {
    $('head').append(getCssLink('css/bar.css'))

    if ($('#bar-position-top').prop('checked')) {
      $('head').append(getCssLink('css/bar-top.css'))
    } else {
      $('head').append(getCssLink('css/bar-bottom.css'))
    }

    if ($('#bar-separator').prop('checked')) {
      if ($('#bar-position-top').prop('checked')) {
        $('head').append(getCssLink('css/bar-top-separator.css'))
      } else {
        $('head').append(getCssLink('css/bar-bottom-separator.css'))
      }
    }

    if ($('#bar-tooltip').prop('checked')) {
      $('head').append(getCssLink('css/bar-tooltip.css'))
      if ($('#bar-position-top').prop('checked')) {
        $('head').append(getCssLink('css/bar-top-tooltip.css'))
      } else {
        $('head').append(getCssLink('css/bar-bottom-tooltip.css'))
      }
    }

  }
}

// Watch for changes that require updating the CSS.
$('#bar-position-top, #bar-position-bottom, #bar-color-blue-gray, #bar-color-green-red, ' +
  '#bar-separator, #bar-tooltip').change(updateCss)

// Watch bar position.
function updateSeparatorPosition() {
  $('#bar-separator-position').text($('#bar-position-top').prop('checked') ? 'below' : 'above')
}
$('#bar-position-top').on('change', updateSeparatorPosition)
$('#bar-position-bottom').on('change', updateSeparatorPosition)

// Watch bar color selector.
$('#bar-color').on('input change', function(event) {
  $('#custom-colors-options').toggle($('[name="bar-color"]').val() === 'custom-colors')
  if ($('[name="bar-color"]').val() === 'blue-gray') {
    document.documentElement.style.setProperty('--ytrb-bar-likes-color', '#3095e3')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-color', '#cfcfcf')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-shadow', 'none')
  } else if ($('[name="bar-color"]').val() === 'green-red') {
    document.documentElement.style.setProperty('--ytrb-bar-likes-color', '#060')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-color', '#c00')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-shadow', 'inset 1px 0 #fff')
  } else if ($('[name="bar-color"]').val() === 'custom-colors') {
    document.documentElement.style.setProperty(
      '--ytrb-bar-likes-color',
      sanitizeHexColor($('#bar-likes-color').val())
    )
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-color',
      sanitizeHexColor($('#bar-dislikes-color').val())
    )
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-shadow',
      $('#bar-colors-separator').prop('checked') ? 'inset 1px 0 #fff' : 'none'
    )
  }
})
$('#bar-likes-color').on('input change', function(event) {
  if ($('[name="bar-color"]').val() === 'custom-colors') {
    document.documentElement.style.setProperty(
      '--ytrb-bar-likes-color',
      sanitizeHexColor($('#bar-likes-color').val())
    )
  }
})
$('#bar-dislikes-color').on('input change', function(event) {
  if ($('[name="bar-color"]').val() === 'custom-colors') {
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-color',
      sanitizeHexColor($('#bar-dislikes-color').val())
    )
  }
})
$('#bar-colors-separator').on('input change', function(event) {
  if ($('[name="bar-color"]').val() === 'custom-colors') {
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-shadow',
      $('#bar-colors-separator').prop('checked') ? 'inset 1px 0 #fff' : 'none'
    )
  }
})

// Watch height slider.
$('#bar-height').on('input change', function(event) {
  $('#bar-height-text').text($('#bar-height').val() === '0' ? 'Hidden' : $('#bar-height').val() + ' px')

  // Make the slider bubble move with the handle.
  $('#bar-height-text').css('left', ($('#bar-height').val() / 16 * 210) + 'px')

  document.documentElement.style.setProperty('--ytrb-bar-height', $('#bar-height').val() + 'px')
})

// Watch opacity slider.
$('#bar-opacity').on('input change', function(event) {
  $('#bar-opacity-text').text($('#bar-opacity').val() + '%')

  // Make the slider bubble move with the handle.
  $('#bar-opacity-text').css('left', ($('#bar-opacity').val() / 100 * 210) + 'px')

  // Temporarily disable the transition when updating the opacity.
  $('#thumbnail-preview ytrb-bar').css('transition', 'none')
  document.documentElement.style.setProperty('--ytrb-bar-opacity', $('#bar-opacity').val() / 100)
  setTimeout(function () {
    $('#thumbnail-preview ytrb-bar').css('transition', 'opacity 0.2s ease-out 0.2s')
  })
})

// Save settings.
$('#save-btn').click(function() {
  chrome.storage.sync.set({
    barPosition: $('#bar-position-top').prop('checked') ? 'top' : 'bottom',
    barColor: $('[name="bar-color"]').val(),
    barLikesColor: sanitizeHexColor($('#bar-likes-color').val()),
    barDislikesColor: sanitizeHexColor($('#bar-dislikes-color').val()),
    barColorsSeparator: $('#bar-colors-separator').prop('checked'),
    barHeight: Number($('#bar-height').val()),
    barOpacity: Number($('#bar-opacity').val()),
    barSeparator: $('#bar-separator').prop('checked'),
    barTooltip: $('#bar-tooltip').prop('checked'),
    useOnVideoPage: $('#use-on-video-page').prop('checked'),
    showPercentage: $('#show-percentage').prop('checked'),
    apiKey: $('#api-key').val(),
    // timeSincePublished: $('#time-since-published').prop('checked'),
  }, function() {
    // Show "Settings saved" message.
    document.querySelector('#toast').MaterialSnackbar.showSnackbar({
      message: 'Settings saved. Refresh the page.',
      timeout: 2000,
    })
  })
  chrome.runtime.sendMessage({
    contentScriptQuery: 'apiKey',
    apiKey: $('#api-key').val(),
  })
})

// Restore defaults.
$('#restore-defaults-btn').click(function() {
  $('#bar-position-' + DEFAULT_USER_SETTINGS.barPosition).click()

  // Note: We don't restore the custom colors and colors separator settings so
  // that users can easily restore to their custom colors if they want to.
  $('#bar-color-' + DEFAULT_USER_SETTINGS.barColor).click()

  $('#bar-height')[0].MaterialSlider.change(DEFAULT_USER_SETTINGS.barHeight)
  $('#bar-height').change()
  $('#bar-opacity')[0].MaterialSlider.change(DEFAULT_USER_SETTINGS.barOpacity)
  $('#bar-opacity').change()

  if ($('#bar-separator').prop('checked') !== DEFAULT_USER_SETTINGS.barSeparator) {
    $('#bar-separator').click()
  }
  if ($('#bar-tooltip').prop('checked') !== DEFAULT_USER_SETTINGS.barTooltip) {
    $('#bar-tooltip').click()
  }
  if ($('#use-on-video-page').prop('checked') !== DEFAULT_USER_SETTINGS.useOnVideoPage) {
    $('#use-on-video-page').click()
  }
  if ($('#show-percentage').prop('checked') !== DEFAULT_USER_SETTINGS.showPercentage) {
    $('#show-percentage').click()
  }
  // if (!$('#time-since-published').prop('checked')) {
  //   $('#time-since-published').click()
  // }
})

// Load saved settings.
function restoreOptions() {
  chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function(settings) {
    // In Firefox, `settings` will be undeclared if not previously set.
    if (!settings) {
      settings = DEFAULT_USER_SETTINGS
    }
    $('#bar-position-' + settings.barPosition).click()

    $('#bar-likes-color').val(settings.barLikesColor)
    if (settings.barLikesColor.length) {
      $('#bar-likes-color-container').removeClass('is-invalid')
      $('#bar-likes-color-container').addClass('is-dirty')
    }
    $('#bar-dislikes-color').val(settings.barDislikesColor)
    if (settings.barDislikesColor.length) {
      $('#bar-dislikes-color-container').removeClass('is-invalid')
      $('#bar-dislikes-color-container').addClass('is-dirty')
    }
    if ($('#bar-colors-separator').prop('checked') !== settings.barColorsSeparator) {
      $('#bar-colors-separator').click()
    }
    // We set the bar color after setting the custom colors and colors
    // separator option above so that the update triggers get fired properly.
    $('#bar-color-' + settings.barColor).click()

    $('#bar-height')[0].MaterialSlider.change(settings.barHeight)
    $('#bar-height').change()
    $('#bar-opacity')[0].MaterialSlider.change(settings.barOpacity)
    $('#bar-opacity').change()

    if ($('#bar-separator').prop('checked') !== settings.barSeparator) {
      $('#bar-separator').click()
    }
    if ($('#bar-tooltip').prop('checked') !== settings.barTooltip) {
      $('#bar-tooltip').click()
    }
    if ($('#use-on-video-page').prop('checked') !== settings.useOnVideoPage) {
      $('#use-on-video-page').click()
    }
    if ($('#show-percentage').prop('checked') !== settings.showPercentage) {
      $('#show-percentage').click()
    }

    if ($('#api-key').val() !== settings.apiKey) {
      $('#api-key').val(settings.apiKey)
      if (settings.apiKey.length) {
        $('#api-key-container').removeClass('is-invalid')
        $('#api-key-container').addClass('is-dirty')
      }
    }
    // if ($('#time-since-published').prop('checked') !== settings.timeSincePublished) {
    //   $('#time-since-published').click()
    // }
  })
}

document.addEventListener('DOMContentLoaded', function() {
  // We restore option twice in case the first time is before the Material
  // Design components are loaded. (This is a temporary workaround until a
  // better method is figured out.)
  restoreOptions()
  setTimeout(function () {
    updateCss()
  })

  // We use the delay timeout to give the MDL components time to load.
  setTimeout(function () {
    restoreOptions()
    setTimeout(function () {
      updateCss()
    })
  }, 250)
})