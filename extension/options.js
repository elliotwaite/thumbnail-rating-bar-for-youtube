const DEFAULT_USER_SETTINGS = {
  barPosition: 'bottom',
  barColor: 'blue-gray',
  barHeight: 4,
  barOpacity: 100,
  barSeparator: false,
  barTooltip: true,
  showPercentage: false,
  // timeSincePublished: true,
  apiKey: '',
}

function getCssLink(url) {
  return $('<link/>', {
    rel: 'stylesheet',
    type: 'text/css',
    class: 'ytrb-css',
    href: chrome.runtime.getURL(url)
  });
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

    if ($('#bar-color-blue-gray').prop('checked')) {
      $('head').append(getCssLink('css/bar-blue-gray.css'))
    } else {
      $('head').append(getCssLink('css/bar-green-red.css'))
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

// Watch height slider.
$('#bar-height').on('input change', function(event) {
  $('#bar-height-text').text($('#bar-height').val() === '0' ? 'Hidden' : $('#bar-height').val() + ' px')

  // Make the slider bubble move with the handle.
  $('#bar-height-text').css('left', ($('#bar-height').val() / 16 * 210) + 'px')

  document.documentElement.style.setProperty('--ytrb-bar-height', $('#bar-height').val() + 'px');
})

// Watch opacity slider.
$('#bar-opacity').on('input change', function(event) {
  $('#bar-opacity-text').text($('#bar-opacity').val() + '%')

  // Make the slider bubble move with the handle.
  $('#bar-opacity-text').css('left', ($('#bar-opacity').val() / 100 * 210) + 'px')

  // Temporarily disable the transition when updating the opacity.
  $('#thumbnail-preview ytrb-bar').css('transition', 'none')
  document.documentElement.style.setProperty('--ytrb-bar-opacity', $('#bar-opacity').val() / 100);
  setTimeout(function () {
    $('#thumbnail-preview ytrb-bar').css('transition', 'opacity 0.2s ease-out 0.2s')
  })
})

// Save settings.
$('#save-btn').click(function() {
  chrome.storage.sync.set({
    barPosition: $('#bar-position-top').prop('checked') ? 'top' : 'bottom',
    barColor: $('#bar-color-blue-gray').prop('checked') ? 'blue-gray' : 'green-red',
    barHeight: Number($('#bar-height').val()),
    barOpacity: Number($('#bar-opacity').val()),
    barSeparator: $('#bar-separator').prop('checked'),
    barTooltip: $('#bar-tooltip').prop('checked'),
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
  $('#bar-position-bottom').click()
  $('#bar-color-blue-gray').click()
  $('#bar-height')[0].MaterialSlider.change(4)
  $('#bar-height').change()
  $('#bar-opacity')[0].MaterialSlider.change(100)
  $('#bar-opacity').change()
  if ($('#bar-separator').prop('checked')) {
    $('#bar-separator').click()
  }
  if (!$('#bar-tooltip').prop('checked')) {
    $('#bar-tooltip').click()
  }
  if ($('#show-percentage').prop('checked')) {
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
  restoreOptions()
  setTimeout(function () {
    updateCss()
  })
})