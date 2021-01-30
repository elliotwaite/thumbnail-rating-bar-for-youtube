// Watch colors options.
$('#bar-color-blue-gray, #bar-color-green-red').change(function(event) {
  $('#thumbnail-preview').toggleClass('ytrb-bar-color-green-red',
    $('#bar-color-green-red').prop('checked'))
})

// Watch thickness slider.
$('#bar-thickness').on('input change', function(event) {
  $('#bar-thickness-text').text($('#bar-thickness').val() + ' px')
  $('#thumbnail-preview ytrb-bar, #thumbnail-preview ytrb-rating').height($('#bar-thickness').val() + 'px')
  // A ghetto implementation of making the slider bubble move with the handle.
  $('#bar-thickness-text').css('left', ($('#bar-thickness').val() / 16 * 210) + 'px')

})

// Watch opacity slider.
$('#bar-opacity').on('input change', function(event) {
  $('#bar-opacity-text').text($('#bar-opacity').val() + '%')

  // Temporarily disable the transition when updating the opacity.
  $('#thumbnail-preview ytrb-bar').css({
    'transition': 'none',
    'opacity': $('#bar-opacity').val() / 100
  })
  setTimeout(function () {
    $('#thumbnail-preview ytrb-bar').css('transition', 'opacity 0.2s ease-out 0.2s')
  })

  // A ghetto implementation of making the slider bubble move with the handle.
  $('#bar-opacity-text').css('left', ($('#bar-opacity').val() / 100 * 210) + 'px')
})

// Watch separator checkbox.
$('#bar-separator').change(function(event) {
  $('#thumbnail-preview').toggleClass('ytrb-bar-separator',
    $('#bar-separator').prop('checked'))
})

// Watch tooltip checkbox.
$('#bar-tooltip').change(function(event) {
  $('#thumbnail-preview').toggleClass('ytrb-bar-tooltip',
    $('#bar-tooltip').prop('checked'))
})

// Save settings.
$('#save-btn').click(function() {
  chrome.storage.sync.set({
    barColor: $('#bar-color-green-red').prop('checked')
      ? 'green-red'
      : 'blue-gray',
    barThickness: $('#bar-thickness').val(),
    barOpacity: $('#bar-opacity').val(),
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
  $('#bar-color-blue-gray').click()
  $('#bar-thickness')[0].MaterialSlider.change(4)
  $('#bar-thickness').change()
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
  chrome.storage.sync.get({
    barColor: 'blue-gray',
    barThickness: 4,
    barOpacity: 100,
    barSeparator: false,
    barTooltip: true,
    timeSincePublished: true,
    apiKey: '',
  }, function(settings) {
    $('#bar-color-' + settings.barColor).click()
    $('#bar-thickness')[0].MaterialSlider.change(settings.barThickness)
    $('#bar-thickness').change()
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

document.addEventListener('DOMContentLoaded', restoreOptions)
