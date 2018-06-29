const MAX_VIDEO_RESULTS = 50
const THROTTLE_MS = 200
const LIKES_BLUE = '3095e3'
const DISLIKES_GRAY = 'cfcfcf'

let barPrefix = '<div class="ytrb-bar"><div style="width:'
let barSuffix = '%"></div></div>'

let videoRatings = {}
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
  // Check for any unprocessed thumbnails.
  let new_thumbnails = $(
    // For: https://www.youtube.com/user/TheSpiritualCatalyst/videos
    'ytd-thumbnail:not([data-ytrb-thumbnail]), ' +

    // For: https://gaming.youtube.com/
    '#thumbnail-container:not([data-ytrb-thumbnail]), ' +

    // For: (playlists) https://gaming.youtube.com/
    'ytg-thumbnail:not([data-ytrb-thumbnail]), ' +

    // For: Classic mode suggested videos.
    // https://www.youtube.com/features
    '.yt-uix-simple-thumb-wrap:not([data-ytrb-thumbnail]), ' +

    // For: Classic mode playlist videos.
    // https://www.youtube.com/features
    '.yt-thumb:not([data-ytrb-thumbnail])',

    // The below selectors were no longer needed, but I've left here for now
    // for debugging purposes:

    // // For: https://www.youtube.com/playlist?list=PLiDGSQiS-Y3T9Y4KPrBpjECtrrTTqgADq&disable_polymer=true
    // '.pl-header-thumb:not([data-ytrb-thumbnail]), ' +
    // '.pl-video-thumb:not([data-ytrb-thumbnail]), ' +
    //
    // // For: https://www.youtube.com/user/TheSpiritualCatalyst/videos?disable_polymer=1
    // '.yt-lockup-thumbnail:not([data-ytrb-thumbnail]), ' +
    //
    // // For: Classic mode suggested videos.
    // // https://www.youtube.com/features
    // '.thumb-wrapper:not([data-ytrb-thumbnail]), ' +
    //
    // // For: Classic mode suggested videos playlist.
    // // https://www.youtube.com/features
    // '.yt-pl-thumb:not([data-ytrb-thumbnail]), ' +
  )
  if (new_thumbnails.length) {
    let ids = []
    let new_thumbnails_with_ids = []
    $.each(new_thumbnails, function (i, thumbnail) {
      // Add a tag marking this thumbnail as having been found.
      $(thumbnail).attr('data-ytrb-thumbnail', '')

      // Find the URL for this thumbnail.
      // Check first child.
      let url = $(thumbnail).children(':first').attr('href')
      if (!url) {
        // Check parent.
        url =  $(thumbnail).parent().attr('href')
      }
      if (!url) {
        // Check grandparent.
        url =  $(thumbnail).parent().parent().attr('href')
      }
      // These checks are currently not needed, but have been left for
      // debugging purposes.
      // if (!url) {
      //   // Check first descendant a tag.
      //   url = $(thumbnail).find('a:lt(1)').attr('href')
      // }
      // if (!url) {
      //   // Check closest ancestor a tag.
      //   url = $(thumbnail).closest('a').attr('href')
      // }

      // Extract the video ID from the URL.
      if (url) {
        let match = url.match(/.*[?&]v=([^&]+).*/)
        if (match && match.length >= 1) {
          let id = match[1]
          ids.push(id)
          new_thumbnails_with_ids.push(thumbnail)
        }
      } else {
        if (debug) console.log('url not found', thumbnail)
      }
    })
    getRatings(ids, new_thumbnails_with_ids)
  }
}

function getRatings(ids, thumbnails) {
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
  Promise.all(promises).then(function () {
    addRatingBars(ids, thumbnails)
  })
}

function addRatingBars(ids, thumbnails) {
  // Add a rating bar to each thumbnail.
  for (let i = 0; i < ids.length; i++) {
    let rating
    if (ids[i] in videoRatings) {
      rating = videoRatings[ids[i]]
      $(thumbnails[i]).prepend(barPrefix + (rating * 100) + barSuffix)
    } else {
      // If the video data isn't retrieved on the first try, allow a second
      // try, but after the second failed attempt, don't try again.
      if (!missingIds.has(ids[i])) {
        if (debug) console.log('missing 1', ids[i])
        missingIds.add(ids[i])
        $(thumbnails[i]).removeAttr('data-ytrb-thumbnail')
        handleMutations()
      } else {
        if (debug) console.log('missing 2', ids[i])
      }
    }
  }
}

function checkForRatingBarTooltip() {
  // $('ytd-sentiment-bar-renderer #tooltip')
}

chrome.storage.sync.get({
  barColorStyle: 'blueGray',
  likesColor: LIKES_BLUE,
  dislikesColor: DISLIKES_GRAY
}, function(settings) {
  if(settings.barColorStyle === 'greenRed') {
    $('html').addClass('ytrb-green-red')
  } else if(settings.barColorStyle === 'custom') {
    barPrefix = '<div class="ytrb-bar" ' +
      'style="background-color:#' + settings.dislikesColor + '"><div ' +
      'style="background-color:#' + settings.likesColor + ';width:'
  }
  handleMutations()
  observer.observe(document.body, {childList: true, subtree: true})
});
