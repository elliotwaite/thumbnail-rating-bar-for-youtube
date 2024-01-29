// All API requests are made through this background script to avoid CORB
// errors and to cache results.

let cache = {}
let cacheTimes = []
let cacheDuration = 600000 // Default is 10 mins.

chrome.storage.local.get({ cacheDuration: 600000 }, function (settings) {
  if (settings && settings.cacheDuration !== undefined) {
    cacheDuration = settings.cacheDuration
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.query) {
    case 'videoApiRequest':
      // Remove expired cache data.
      const now = Date.now()
      let numRemoved = 0
      for (const [fetchTime, videoId] of cacheTimes) {
        if (now - fetchTime > cacheDuration) {
          delete cache[videoId]
          numRemoved++
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
        return
      }

      // Otherwise, fetch new data and cache it.
      fetch(
        'https://returnyoutubedislikeapi.com/Votes?videoId=' + message.videoId,
      ).then((response) => {
        if (!response.ok) {
          sendResponse(null)
        } else {
          response.json().then((data) => {
            const likesData = {
              likes: data.likes,
              dislikes: data.dislikes,
            }
            if (!(message.videoId in cache)) {
              cache[message.videoId] = likesData
              cacheTimes.push([Date.now(), message.videoId])
            }
            sendResponse(likesData)
          })
        }
      })

      // Returning `true` signals to the browser that we will send our
      // response asynchronously using `sendResponse()`.
      return true

    case 'insertCss':
      for (const file of message.files) {
        chrome.tabs.insertCSS(sender.tab.id, { file })
      }
      break

    case 'updateSettings':
      cacheDuration = message.cacheDuration
      break
  }
})
