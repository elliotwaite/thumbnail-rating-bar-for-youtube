let youtubeApiKey = ''

chrome.storage.sync.get({apiKey: ''}, function(settings) {
  if (settings) {
    youtubeApiKey = settings.apiKey
  }
})

// Do the ajax request from this background script to avoid CORB.
chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.contentScriptQuery === 'videoStatistics') {
      let combined_data = {'items': []}
      let promises = []
      if (youtubeApiKey === 'invidious') {
        for (let videoId of message.videoIds) {
          let promise = fetch(`https://ytprivate.com/api/v1/videos/${videoId}?fields=likeCount,dislikeCount`)
            .then(response => response.json())
            .then(data => {
              combined_data.items.push({
                'id': videoId,
                'statistics': data})
            })
          promises.push(promise)
        }
        Promise.all(promises).then(() => {
            sendResponse(combined_data)
        })
        return true  // Will respond asynchronously with `sendResponse()`.
      } else if (youtubeApiKey.length) {
        let url = 'https://www.googleapis.com/youtube/v3/videos?id=' +
            message.videoIds.join(',') + '&part=statistics&key=' + youtubeApiKey
        fetch(url)
            .then(response => response.json())
            .then(data => sendResponse(data))
        return true  // Will respond asynchronously with `sendResponse()`.
      } else {
       return false
      }
    } else if (message.contentScriptQuery === 'apiKey') {
      youtubeApiKey = message.apiKey
    } else if (message.contentScriptQuery === 'insertCss') {
      chrome.tabs.insertCSS(sender.tab.id, {file: message.url})
    }
  }
)