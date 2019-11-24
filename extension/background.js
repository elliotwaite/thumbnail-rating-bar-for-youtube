let youtubeApiKey = ''

chrome.storage.sync.get({
    apiKey: '',
  }, function(settings) {
    youtubeApiKey = settings.apiKey
  })

// Do the ajax request from this background script to avoid CORB.
chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.contentScriptQuery === 'videoStatistics') {
      if (youtubeApiKey.length) {
        let url = 'https://www.googleapis.com/youtube/v3/videos?id=' +
            message.videoIds.join(',') + '&part=statistics&key=' + youtubeApiKey
        fetch(url)
            .then(response => response.json())
            .then(data => sendResponse(data))
        return true  // Will respond asynchronously.
      } else {
       return false
      }
    } else if (message.contentScriptQuery === 'apiKey') {
      youtubeApiKey = message.apiKey
    }
  })