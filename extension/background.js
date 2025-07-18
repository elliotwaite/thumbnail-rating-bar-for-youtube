// All API requests are made through this background script to avoid CORB
// errors and to cache results.

let cache = {}
let cacheTimes = []
let cacheDuration = 600000 // Default is 10 mins.
let getLikesDataCallbacks = {}

function removeExpiredCacheData() {
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
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ cacheDuration: 600000 }, function (settings) {
    if (settings && settings.cacheDuration !== undefined) {
      cacheDuration = settings.cacheDuration
    }
  })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.query) {
    case "getLikesData":
      removeExpiredCacheData()

      // If the data is in the cache, return it.
      if (message.videoId in cache) {
        // Return the cached data if it exists.
        sendResponse(cache[message.videoId])
        return
      }

      if (message.videoId in getLikesDataCallbacks) {
        // If a request for the same video ID is already in progress, add the
        // current `sendResponse` function to the `getLikesDataCallbacks`
        // array for this video ID.
        getLikesDataCallbacks[message.videoId].push(sendResponse)
      } else {
        // Otherwise, insert a new callbacks array for this video ID, then
        // start a new request to fetch the likes/dislikes data.
        getLikesDataCallbacks[message.videoId] = [sendResponse]

        fetch(
          "https://returnyoutubedislikeapi.com/Votes?videoId=" +
            message.videoId,
        )
          .then(
            (response) =>
              response.ok
                ? response.json().then((data) => ({
                    likes: data.likes,
                    dislikes: data.dislikes,
                  }))
                : null, // If the response failed, we return `null`.
          )
          .then((data) => {
            if (data !== null) {
              cache[message.videoId] = data
              cacheTimes.push([Date.now(), message.videoId])
            }

            for (const callback of getLikesDataCallbacks[message.videoId]) {
              callback(data)
            }

            delete getLikesDataCallbacks[message.videoId]
          })
      }

      // Returning `true` signals to the browser that we will send our
      // response asynchronously using `sendResponse()`.
      return true

    case "insertCss":
      chrome.scripting.insertCSS({
        target: {
          tabId: sender.tab.id,
        },
        files: message.files,
      })
      break

    case "updateSettings":
      cacheDuration = message.cacheDuration
      break
  }
})
