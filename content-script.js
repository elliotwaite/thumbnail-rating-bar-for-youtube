const MAX_VIDEO_RESULTS = 50
const THROTTLE_MS = 200

let videoRatings = {}
let unseenMutations = false
let isThrottled = false

let observer = new MutationObserver(handleMutations);
observer.observe(document.body, {childList: true, subtree: true})

function handleMutations() {
  // Throttle calling `checkForNewThumbnails` to at most every `THROTTLE_MS`.
  if (isThrottled) {
    unseenMutations = true
  } else {
    isThrottled = true
    unseenMutations = false
    checkForNewThumbnails()
    setTimeout(function() {
      isThrottled = false
      if (unseenMutations) {
        handleMutations()
      }
    }, THROTTLE_MS)
  }
}

function checkForNewThumbnails() {
  // Check for any unprocessed thumbnails.
  let thumbnails = $('ytd-thumbnail:not([data-ytrb-added])')
  if (thumbnails.length) {
    let ids = []
    let elements = []
    $.each(thumbnails, function (i, thumbnail) {
      $(thumbnail).attr('data-ytrb-added', true)
      let id = $(thumbnail).find('a').attr('href').split('=')[1]
      ids.push(id)
      elements.push(thumbnail)
    })
    getRatings(ids, elements)
  }
}

function getRatings(ids, elements) {
  // Get the set of all IDs we haven't seen yet.
  let unseenIds = new Set()
  for (id of ids) {
    if (!(id in videoRatings)) {
      unseenIds.add(id)
    }
  }

  // Go through those IDs in batches and get their ratings.
  let unseenIdsArray = Array.from(unseenIds)
  let promises = []
  for (let i = 0; i < unseenIdsArray.length; i += MAX_VIDEO_RESULTS) {
    let unseenIdsBatch = unseenIdsArray.slice(
      i * MAX_VIDEO_RESULTS, MAX_VIDEO_RESULTS)
    let url = 'https://www.googleapis.com/youtube/v3/videos?id=' +
      unseenIdsBatch.join(',') + '&part=statistics&key=' + YOUTUBE_API_KEY
    promises.push($.get(url, function (data) {
      for (item of data.items) {
        let likes = parseInt(item.statistics.likeCount)
        let dislikes = parseInt(item.statistics.dislikeCount)
        let total = likes + dislikes
        let rating
        if (total) {
          rating = likes / total
        } else {
          rating = 0.5
        }
        videoRatings[item.id] = rating
      }
    }))
  }

  // Once we've got the ratings, add the rating bars.
  Promise.all(promises).then(function() {
    addRatingBars(ids, elements)
  })
}

function addRatingBars(ids, elements) {
  // Add a rating bar to each thumbnail element.
  for (let i = 0; i < ids.length; i++) {
    let rating
    if (ids[i] in videoRatings) {
      rating = videoRatings[ids[i]]
    } else {
      rating = 0.5
    }
    $(elements[i]).prepend('<div class="ytrb-bar"><div class="ytrb-likes" ' +
      'style="width: ' + (rating * 100) + '%"></div></div>')
  }
}
