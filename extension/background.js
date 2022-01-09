// All AJAX requests are made from this background script to avoid CORB errors.

let cache = {}
let cacheTimes = []
let cacheDuration = 600000

chrome.storage.sync.get({cacheDuration: 600000}, function(settings) {
  if (settings) {
    cacheDuration = settings.cacheDuration
  }
})

chrome.runtime.onMessage.addListener(
  function(message, sender, sendResponse) {
    if (message.query === 'videoApiRequest') {

      // Remove expired cache data.
      let now = new Date().getTime()
      let numRemoved = 0
      for (const [videoId, fetchTime] of cacheTimes) {
        if (now - fetchTime > cacheDuration) {
          delete cache[videoId]
          numRemoved++;
        } else {
          break
        }
      }
      if (numRemoved > 0) {
        cacheTimes = cacheTimes.slice(numRemoved)
      }

      if (message.videoId in cache) {
        // Use cached data if it exists.
        sendResponse(cache[message.videoId])

      } else {
        // Otherwise, fetch new data and cache it.
        fetch('https://returnyoutubedislikeapi.com/Votes?videoId=' + message.videoId)
          .then(response => {
            if (!response.ok) {
              sendResponse(null)
            } else {
              response.json().then(data => {
                let likesData = {
                  'likes': data.likes,
                  'dislikes': data.dislikes,
                }
                if (!(message.videoId in cache)) {
                  cache[message.videoId] = likesData
                  cacheTimes.push([message.videoId, new Date().getTime()])
                }
                sendResponse(likesData)
              })
            }
          })

        // Returning `true` signals to the browser that we will send our
        // response asynchronously using `sendResponse()`.
        return true
      }

    } else if (message.query === 'insertCss') {
      chrome.tabs.insertCSS(sender.tab.id, {file: message.url})

    } else if (message.query === 'updateSettings') {
      cacheDuration = message.cacheDuration
    }
  }
)