// Distribute the load over multiple APIs by selecting one randomly.
const YOUTUBE_API_KEY = YOUTUBE_API_KEYS[
  Math.floor(Math.random() * YOUTUBE_API_KEYS.length)]

// Do the ajax request from this background script to avoid CORB.
chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.contentScriptQuery === 'videoStatistics') {
      let url = 'https://www.googleapis.com/youtube/v3/videos?id=' +
        message.videoIds.join(',') + '&part=statistics&key=' + YOUTUBE_API_KEY
      fetch(url)
        .then(response => response.json())
        .then(data => sendResponse(data))
      return true  // Will respond asynchronously.
    }
  })