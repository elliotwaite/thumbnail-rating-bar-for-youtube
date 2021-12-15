// All AJAX requests are made from this background script to avoid CORB errors.

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.query === 'videoApiRequest') {
        let url = 'https://returnyoutubedislikeapi.com/Votes?videoId=' + message.videoId
        fetch(url)
            .then(response => response.json())
            .then(data => sendResponse(data))

        // Returning `true` signals to the browser that we will send our
        // response asynchronously using `sendResponse()`.
        return true

    } else if (message.query === 'insertCss') {
      chrome.tabs.insertCSS(sender.tab.id, {file: message.url})
    }
  }
)