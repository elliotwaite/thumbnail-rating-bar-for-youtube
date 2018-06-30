const MAX_VIDEO_RESULTS = 50
const THROTTLE_MS = 200
const LIKES_BLUE = '3095e3'
const DISLIKES_GRAY = 'cfcfcf'

let barPrefix = '<div class="ytrb-bar"><div style="width:'
let barSuffix = '%"></div></div>'

let videoRatingsCache = {}
let missingIds = new Set()
let unseenMutations = false
let isThrottled = false
let debug = false

let observer = new MutationObserver(handleMutations)

function handleMutations() {
  // Throttle calling `checkForNewThumbnails` to at most every `THROTTLE_MS`.
  if (isThrottled) {
    unseenMutations = true
  } else {
    isThrottled = true
    unseenMutations = false
    checkForNewThumbnails()
    checkForRatingBarTooltip()
    setTimeout(function () {
      isThrottled = false
      if (unseenMutations) {
        handleMutations()
      }
    }, THROTTLE_MS)
  }
}

function checkForNewThumbnails() {
  let ids = []
  let thumbnails = []
  // Check for any new thumbnails.
  // We need to check all combinations of these modes and types:
  //   Modes:
  //     * Modern
  //     * Classic
  //     * Gaming (YouTube Gaming)
  //   Types:
  //     * Search results
  //     * Creators videos
  //     * Suggested videos
  //     * Suggested playlists
  //     * Playlist page (big icon)
  //     * Playlist page (small icons)
  //     * Playing playlist (small icons)
  // (However, gaming playlist page (big icon) will be ignored since there
  //  isn't an easy way to get it's associated video ID, and since the ratings
  //  for the videos are right below it, it doesn't add much value.)
  $(
    // Modern search results:
    //   https://www.youtube.com/user/TheSpiritualCatalyst/videos
    // Modern creators videos:
    //   https://www.youtube.com/user/TheSpiritualCatalyst/videos
    // Modern suggested videos:
    //   https://www.youtube.com/watch?v=_FYqpvii9ok
    // Modern suggested playlists:
    //   https://www.youtube.com/watch?v=_FYqpvii9ok
    // Modern playlist page (small icons):
    //   https://www.youtube.com/playlist?list=PLiDGSQiS-Y3T9Y4KPrBpjECtrrTTqgADq&disable_polymer=0&disable_polymer=true
    // Modern playing playlist (small icons):
    //   https://www.youtube.com/watch?v=DkeiKbqa02g&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=1
    // (URL is on the first child.)
    'ytd-thumbnail:not([data-ytrb-found]), ' +

    // Modern playlist page (big icon):
    //   https://www.youtube.com/playlist?list=PLiDGSQiS-Y3T9Y4KPrBpjECtrrTTqgADq&disable_polymer=0&disable_polymer=true
    // (URL is on the first child.)
    'ytd-playlist-thumbnail:not([data-ytrb-found]), ' +

    // Classic search results:
    //   https://www.youtube.com/results?search_query=test&disable_polymer=1
    // Classic creators videos:
    //   https://www.youtube.com/user/TheSpiritualCatalyst/videos?disable_polymer=1
    // Classic playlist page (small icons):
    //   https://www.youtube.com/playlist?list=PLiDGSQiS-Y3T9Y4KPrBpjECtrrTTqgADq&disable_polymer=true
    // Classic suggested playlists:
    //   https://www.youtube.com/watch?v=_FYqpvii9ok&disable_polymer=1
    // Classic playing playlist (small icons):
    //   https://www.youtube.com/watch?v=aJOTlE1K90k&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&disable_polymer=1
    // (URL is on the parent, except for the classic suggested playlists it
    //  is on the grandparent.)
    '.video-thumb:not([data-ytrb-found])' +
    ':not(.yt-thumb-20)' +
    ':not(.yt-thumb-27)' +
    ':not(.yt-thumb-32)' +
    ':not(.yt-thumb-36)' +
    ':not(.yt-thumb-48)' +
    ':not(.yt-thumb-64), ' +
    // (For classic search results, if a channel is in the results, its will
    //  be caught here, but won't have an available URL. Since this is a rare
    //  case and does not cause an error, it should be fine to ignore it.)

    // Classic suggested videos:
    //   https://www.youtube.com/watch?v=_FYqpvii9ok&disable_polymer=1
    // (URL is on first child.)
    '.thumb-wrapper:not([data-ytrb-found]), ' +

    // Classic playlist page (big icon):
    //   https://www.youtube.com/playlist?list=PLiDGSQiS-Y3T9Y4KPrBpjECtrrTTqgADq&disable_polymer=true
    // (URL is on second child.)
    '.pl-header-thumb:not([data-ytrb-found]), ' +

    // Gaming all types:
    //   https://gaming.youtube.com/
    // (URL is on great grandparent, except for the suggested playlists it is
    //  on the grandparent, and for the playlist page (big icon) there is no
    //  convenient way to get the video ID so it will be skipped.)
    'ytg-thumbnail:not([data-ytrb-found])' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

  ).each(function (_, thumbnail) {
    // if (debug) console.log('found', thumbnail)

    // Add a tag marking this thumbnail as having been found.
    $(thumbnail).attr('data-ytrb-found', '')

    // Find the URL for this thumbnail. Check the first child, then the parent,
    // then the grandparent, then the second child, then the great grandparent.
    // This is in the order of most to least common.
    let url = $(thumbnail).children(':first').attr('href')
      || $(thumbnail).parent().attr('href')
      || $(thumbnail).parent().parent().attr('href')
      || $(thumbnail).children(':first').next().attr('href')
      || $(thumbnail).parent().parent().parent().attr('href')

    // If we've successfully found a url, extract the video ID from that URL.
    if (url) {
      // Check for the id in the href URL, or in the style image URL.
      let match = url.match(/.*[?&]v=([^&]+).*/)
      if (match) {
        let id = match[1]
        ids.push(id)
        thumbnails.push(thumbnail)
      } else if (debug) {
        console.log('match not found', thumbnail, url)
      }
    } else if (debug) {
      console.log('url not found', thumbnail, url)
    }
  })
  if (ids) {
    getRatings(ids, thumbnails)
  }
}

function getRatings(ids, thumbnails) {
  // Get the set of all IDs we haven't seen yet.
  let unseenIds = new Set()
  for (id of ids) {
    if (!(id in videoRatingsCache)) {
      unseenIds.add(id)
    }
  }

  // Go through the unseen IDs in batches of 50 and get their ratings.
  let unseenIdsArray = Array.from(unseenIds)
  let promises = []
  for (let i = 0; i < unseenIdsArray.length; i += MAX_VIDEO_RESULTS) {
    let unseenIdsBatch = unseenIdsArray.slice(i, i + MAX_VIDEO_RESULTS)
    let url = 'https://www.googleapis.com/youtube/v3/videos?id=' +
      unseenIdsBatch.join(',') + '&part=statistics&key=' + YOUTUBE_API_KEY
    let promise = $.get(url, function (data) {
      for (item of data.items) {
        let likes = parseInt(item.statistics.likeCount)
        let dislikes = parseInt(item.statistics.dislikeCount)
        let total = likes + dislikes
        let rating = 0.5
        if (total) {
          rating = likes / total
        }
        videoRatingsCache[item.id] = rating
      }
    })
    promises.push(promise)
  }

  // Once we've got all the ratings, add the rating bars.
  Promise.all(promises).then(function () {
    addRatingBars(ids, thumbnails)
  })
}

function addRatingBars(ids, thumbnails) {
  // Add a rating bar to each thumbnail.
  for (let i = 0; i < ids.length; i++) {
    let id = ids[i]
    let thumbnail = thumbnails[i]
    let rating
    if (id in videoRatingsCache) {
      rating = videoRatingsCache[id]
      $(thumbnail).prepend(barPrefix + (rating * 100) + barSuffix)
    } else {
      if (debug) console.log('missing id', id, thumbnail)
      // // If the video data isn't retrieved on the first try, allow a second
      // // try, but after the second failed attempt, don't try again.
      // if (!missingIds.has(id)) {
      //   if (debug) console.log('missing 1', id, thumbnail)
      //   missingIds.add(id)
      //   $(thumbnail).removeAttr('data-ytrb-found')
      //   handleMutations()
      // } else {
      //   if (debug) console.log('missing 2', id, thumbnail)
      // }
    }
  }
}

function checkForRatingBarTooltip() {
  $('.ytd-sentiment-bar-renderer #tooltip:not([data-ytrb-found])')
    .each(function (tooltip) {
      $(tooltip).attr('data-ytrb-found', '')
      likesDislikes = $(tooltip).text().split(' / ')
    })
}

chrome.storage.sync.get({
  barColorStyle: 'blueGray',
  likesColor: LIKES_BLUE,
  dislikesColor: DISLIKES_GRAY,
}, function (settings) {
  if (settings.barColorStyle === 'greenRed') {
    $('html').addClass('ytrb-green-red')
  } else if (settings.barColorStyle === 'custom') {
    barPrefix = '<div class="ytrb-bar" ' +
      'style="background-color:#' + settings.dislikesColor + '"><div ' +
      'style="background-color:#' + settings.likesColor + ';width:'
  }
  handleMutations()
  observer.observe(document.body, {childList: true, subtree: true})
})
