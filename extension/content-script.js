// Setting debug to true will turn on console.log messages used for debugging.
let debug = false

// Variables for handling throttling DOM searches.
const THROTTLE_MS = 100
let hasUnseenMutations = false
let isThrottled = false

// The YouTube API limit of the number of video IDs you can pass in per request.
const MAX_IDS_PER_API_CALL = 50

// A cache to store video ratings, to limit API calls and improve performance.
let videoCache = {}

// Enum values for which YouTube theme is currently begin viewed.
let curTheme = 0  // No theme set yet.
const THEME_MODERN = 1  // The new Material Design theme.
const THEME_CLASSIC = 2  // The classic theme.
const THEME_GAMING = 3  // The YouTube Gaming theme.
const NUM_THEMES = 3

// `isDarkTheme` will be true if the appearance setting is in dark theme mode.
let isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') == ' #181818'

// We use these JQuery selectors to find new thumbnails on the page. We use
// :not([data-ytrb-found]) to make sure these aren't thumbnails that we've
// already added a rating bar to. We need to check all combinations of these
// modes and types:
//   Modes:
//     * Classic (Can be enabled by add &disable_polymer=true to the URL)
//     * Modern (The new Material Design theme)
//     * Gaming (YouTube Gaming)
//   Types:
//     * Search results videos
//     * Search results playlist
//     * Creator's videos
//     * Creator's playlist
//     * Sidebar suggested videos
//     * Sidebar suggested playlists
//     * Playlist page big thumbnail
//     * Playlist page small thumbnails
//     * Playing playlist small icons
//     * Video wall (suggested videos after the video ends)
//
// (Note: the gaming playlist page big thumbnail will be ignored due to
//  complications in getting the associated video ID from the thumbnail.
//  Also, since the ratings for the videos in the playlist are shown in the
//  smaller icons right below the big icon, adding a rating bar to the
//  big icon doesn't add much value.)
//
// Listed below are which type of thumbnails that part of selector identifies,
// and where the link tag element is relative to the thumbnail element for
// figuring out the video ID associated with that thumbnail.
const THUMBNAIL_SELECTORS = []
THUMBNAIL_SELECTORS[THEME_MODERN] = '' +
    // All types except the video wall. The URL is on the selected a link.
    // The mini-player thumbnail will not have an href attribute, which is why
    // we require that it exists.
    'a#thumbnail[href]'

THUMBNAIL_SELECTORS[THEME_CLASSIC] = '' +
    // Search results videos. (url on parent)
    // Creator's videos. (url on parent)
    // Playlist page small thumbnails. (url on parent)
    // Sidebar suggested playlist. (url on grandparent)
    // Playing playlist small thumbnails. (url on parent)
    '.video-thumb' +
    ':not(.yt-thumb-20)' +
    ':not(.yt-thumb-27)' +
    ':not(.yt-thumb-32)' +
    ':not(.yt-thumb-36)' +
    ':not(.yt-thumb-48)' +
    ':not(.yt-thumb-64), ' +
    // (For search results, if a channel is in the results, it's thumbnail will
    //  be caught by this selector, but won't have an matchable video URL.
    //  Since this does not cause an error, it should be fine to ignore it.)

    // Sidebar suggested video. (url on first child)
    '.thumb-wrapper, ' +

    // Playlist page big thumbnail. (url on second child)
    '.pl-header-thumb'

THUMBNAIL_SELECTORS[THEME_GAMING] = '' +
    // Gaming all types except video wall. URL is on the great grandparent,
    // except for search result playlists it is on the grandparent.
    'ytg-thumbnail' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

// All themes use this selector for video wall videos.
const THUMBNAIL_SELECTOR_VIDEOWALL = '' +
    'a.ytp-videowall-still'

// The default user settings. `userSettings` is replaced with the stored user's
// settings once they are loaded.
const DEFAULT_USER_SETTINGS = {
  barPosition: 'bottom',
  barColor: 'blue-gray',
  barLikesColor: '#3095e3',
  barDislikesColor: '#cfcfcf',
  barColorsSeparator: false,
  barHeight: 4,
  barOpacity: 100,
  barSeparator: false,
  barTooltip: true,
  useOnVideoPage: false,
  showPercentage: false,
  // timeSincePublished: true,
}
let userSettings = DEFAULT_USER_SETTINGS

// An observer for watching changes to the body element.
let observer = new MutationObserver(handleMutations)

function handleMutations() {
  // When the DOM is updated, we search for items that should be modified.
  // However, we throttle these searches to not over tax the CPU.
  if (isThrottled) {
    // If updates are currently being throttled, we'll remember to handle
    // them later.
    hasUnseenMutations = true
  } else {
    // Run the updates.
    updateThumbnailRatingBars()
    updateVideoRatingBarTooltips()
    // if (userSettings.timeSincePublished)
    //   updateTimeSincePublishedElements()

    hasUnseenMutations = false

    // Turn on throttle.
    isThrottled = true

    setTimeout(function() {
      // After `THROTTLE_MS` milliseconds, turn off the throttle.
      isThrottled = false

      // If any mutations occurred while being throttled, handle them now.
      if (hasUnseenMutations) {
        handleMutations()
      }

    }, THROTTLE_MS)
  }
}

function updateThumbnailRatingBars() {
  // Get new thumbnails, and set the theme if it hasn't been set yet.
  let thumbnails = []
  if (curTheme) {
    thumbnails = $(THUMBNAIL_SELECTORS[curTheme])
  } else {
    for (let i = 1; i <= NUM_THEMES; i++) {
      thumbnails = $(THUMBNAIL_SELECTORS[i])
      if (thumbnails.length) {
        curTheme = i
        break
      }
    }
  }

  // Add the videowall thumbnails.
  thumbnails = $.merge(thumbnails, $(THUMBNAIL_SELECTOR_VIDEOWALL))

  let thumbnailsAndIds = []
  $(thumbnails).each(function(_, thumbnail) {
    // Find the link tag element of the thumbnail and its URL.
    let url
    if (curTheme === THEME_MODERN) {
      // The URL should be on the current element.
      url = $(thumbnail).attr('href')

    } else if (curTheme === THEME_CLASSIC) {
      // Check the current element, then the parent, then the grandparent,
      // then the first child, then the second child.
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).children(':first').attr('href')
          || $(thumbnail).children(':first').next().attr('href')

    } else if (curTheme === THEME_GAMING) {
      // Check the current element, then the grandparent.
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).parent().parent().parent().attr('href')

      // Unless the element is a video wall thumbnail, change the thumbnail
      // element to the parent element, so that it will show over the thumbnail
      // preview video that plays when you hover over the thumbnail.
      if (!$(thumbnail).is('a')) {
        thumbnail = $(thumbnail).parent()
      }

    } else {
      // The theme may not be set if only videowall thumbnails were found.
      url = $(thumbnail).attr('href')
    }

    if (!url) {
      if (debug) console.log('DEBUG: Url not found.', thumbnail, url)
      return true
    }

    // Check if this thumbnail was previously found.
    let previousUrl = $(thumbnail).attr('data-ytrb-found')
    if (previousUrl) {
      // Check if this thumbnail is for the same URL as previously.
      if (previousUrl === url) {
        // If so, continue the next thumbnail.
        return true
      } else {
        // If not, remove the old rating bar.
        $(thumbnail).children('ytrb-bar').remove()
      }
    }
    // Add an attribute that marks this thumbnail as found, and give it the
    // value of the URL the thumbnail is for.
    $(thumbnail).attr('data-ytrb-found', url)

    // Extract the video ID from the URL.
    let match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      let id = match[1]
      thumbnailsAndIds.push([thumbnail, id])
    } else if (debug) {
      console.log('DEBUG: Match not found.', thumbnail, url)
    }
  })

  if (thumbnailsAndIds.length) {
    addRatingsToCache(thumbnailsAndIds).then(function() {
      if (userSettings.barHeight !== 0) {
        addRatingBars(thumbnailsAndIds)
      }
      if (userSettings.showPercentage) {
        addRatingPercentage(thumbnailsAndIds)
      }
    })
  }
}

function addRatingsToCache(thumbnailsAndIds) {
  // Get the set of all IDs we haven't seen yet.
  let unseenIds = new Set()
  for (let [thumbnail, id] of thumbnailsAndIds) {
    if (!(id in videoCache)) {
      unseenIds.add(id)
    }
  }

  // Go through the unseen IDs in batches of 50 and get their ratings.
  let unseenIdsArray = Array.from(unseenIds)
  let promises = []
  for (let i = 0; i < unseenIdsArray.length; i += MAX_IDS_PER_API_CALL) {
    let unseenIdsBatch = unseenIdsArray.slice(i, i + MAX_IDS_PER_API_CALL)

    let promise = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
          {contentScriptQuery: 'videoStatistics', videoIds: unseenIdsBatch},
          function(data) {
            if (typeof data === 'undefined') {
              console.error('[Missing Requirement] The "Thumbnail Rating ' +
                  'Bar for YouTube™" extension is missing a required ' +
                  'YouTube Data API key. To resolve this issue, visit the ' +
                  'extension\'s settings page, which is accessible by ' +
                  'clicking the extension\'s icon in the toolbar.')
              resolve()
            } else if (data && data.error) {
              console.error('[YouTube Data API Error] The "Thumbnail Rating ' +
                  'Bar for YouTube™" extension received an error when ' +
                  'trying to request data from the YouTube Data API. This ' +
                  'could be due to an invalid API key. To update the API ' +
                  'key, visit the extension\'s settings page, which is ' +
                  'accessible by clicking the extension\'s icon in the ' +
                  'toolbar.')
              resolve()
            } else {
              for (let item of data.items) {
                let video = getVideoObject(
                    item.statistics.likeCount || 0,
                    item.statistics.dislikeCount || 0)
                videoCache[item.id] = video
                resolve()
              }
            }
          })
    })

    promises.push(promise)
  }

  // Return a promise that resolves once all data has been retrieved and saved
  // to the cache.
  return Promise.all(promises)
}

function addRatingBars(thumbnailsAndIds) {
  // Add a rating bar to each thumbnail.
  for (let [thumbnail, id] of thumbnailsAndIds) {
    if (id in videoCache) {
      $(thumbnail).prepend(getRatingBarHtml(videoCache[id]))
    } else if (debug) {
      console.log('DEBUG: Missing ID.', id, thumbnail)
    }
  }
}

function addRatingPercentage(thumbnailsAndIds) {
  // Add the rating percentage below each thumbnail.
  for (let [thumbnail, id] of thumbnailsAndIds) {
    if (id in videoCache) {
      let metadataLine = $(thumbnail).closest(
        '.ytd-rich-item-renderer, ' +  // Home page.
        '.ytd-grid-renderer, ' +  // Trending page.
        '.ytd-expanded-shelf-contents-renderer, ' +  // Subscriptions page.
        '.yt-horizontal-list-renderer, ' +  // Channel page.
        '.ytd-item-section-renderer, ' +  // History page.
        '.ytd-horizontal-card-list-renderer'  // Gaming page.
      ).find('#metadata-line').last()
      if (metadataLine) {
        // Remove any previously added percentages.
        for (let oldPercentage of metadataLine.children('.ytrb-percentage')) {
          oldPercentage.remove()
        }
        let lastSpan = metadataLine.children('span').last()
        let video = videoCache[id]
        if (lastSpan && video.rating != null) {
          lastSpan.after(getRatingPercentageHtml(video.rating))
        }
      }
    } else if (debug) {
      console.log('DEBUG: Missing ID.', id, thumbnail)
    }
  }
}

function getVideoObject(likes, dislikes) {
  likes = parseInt(likes)
  dislikes = parseInt(dislikes)
  let total = likes + dislikes
  let rating = total ? likes / total : null
  return {
    likes: likes.toLocaleString(),
    dislikes: dislikes.toLocaleString(),
    total: total.toLocaleString(),
    rating: rating,
  }
}

function ratingToPercentage(rating) {
  if (rating == 1) {
    return '100%'
  }
  // Note: We use floor instead of round to ensure that anything lower than
  // 100% does not display "100.0%".
  return (Math.floor(rating * 1000) / 10).toFixed(1) + '%'
}

function ratingToRgb(rating) {
  let r = (1 - rating) * 1275
  let g = rating * 637.5 - 255
  if (!isDarkTheme) {
    g = Math.min(g, 255) * 0.85
  }
  return 'rgb(' + r + ',' + g + ',0)'
}

function getRatingBarHtml(video) {
  return '<ytrb-bar' +
      (userSettings.barOpacity !== 100
          ? ' style="opacity:' + (userSettings.barOpacity / 100) + '"'
          : ''
      ) +
      '>' +
      (video.rating == null
          ? '<ytrb-no-rating></ytrb-no-rating>'
          : '<ytrb-rating>' +
              '<ytrb-likes style="width:' + (video.rating * 100) + '%"></ytrb-likes>' +
              '<ytrb-dislikes></ytrb-dislikes>' +
            '</ytrb-rating>'
      ) +
      (userSettings.barTooltip
          ? '<ytrb-tooltip><div>' + getToolTipText(video) + '</div></ytrb-tooltip>'
          : ''
      ) +
      '</ytrb-bar>'
}

function getRatingPercentageHtml(rating) {
  return '<span class="style-scope ytd-video-meta-block ytrb-percentage" style="color:' +
      ratingToRgb(rating) + '">' + ratingToPercentage(rating) + '</span>'
}

function getToolTipText(video) {
  return video.likes + '&nbsp;/&nbsp;' + video.dislikes + ' &nbsp;&nbsp; '
      + ratingToPercentage(video.rating) + ' &nbsp;&nbsp; ' + video.total + '&nbsp;total'
}

function updateVideoRatingBarTooltips() {
  // For modern theme.
  if (curTheme === THEME_MODERN || !curTheme) {
    $('.ytd-sentiment-bar-renderer #tooltip')
        .each(function(_, tooltip) {
          let text
          try {
            text = $(tooltip).text().slice(3, -1)
            // If the tooltip is empty, continue.
            if (text.length < 5) {
              if (debug) console.log('DEBUG: Empty tooltip.', tooltip)
              return true
            }
          } catch (e) {
            if (debug) console.log('DEBUG: Tooltip likes not found.', tooltip)
            return true
          }
          let previousText = $(tooltip).attr('data-ytrb-found')
          if (previousText) {
            if (previousText === text) {
              // This tooltip has already been processed correctly.
              return true
            }
            // This tooltip has to be reprocessed, so remove previously
            // added span.
            $(tooltip).children('span').remove()
          }

          // Mark this tooltip as found, and remember the text it is for.
          $(tooltip).attr('data-ytrb-found', text)

          // Extract the likes and dislikes from the tooltip's text.
          let match = text.match(/(.+) \/ (.+)/)
          if (match) {
            let likes = match[1].replace(/\D/g, '')
            let dislikes = match[2].replace(/\D/g, '')
            let video = getVideoObject(likes, dislikes)
            if (video.rating == null) {
              $(tooltip).append('<span> &nbsp;&nbsp; No ratings yet.</span>')
            } else {
              $(tooltip).append('<span> &nbsp;&nbsp; ' +
                  ratingToPercentage(video.rating) + ' &nbsp;&nbsp; ' +
                  video.total + '&nbsp;total</span>')
            }
          } else if (debug) {
            console.log('DEBUG: Tooltip match not found.', text, tooltip, $(tooltip))
          }
        })
  }

  // For classic theme.
  if (curTheme === THEME_CLASSIC || !curTheme) {
    $('#watch8-sentiment-actions:not([data-ytrb-found])')
        .each(function(_, tooltip) {
          $(tooltip).attr('data-ytrb-found', '')
          let likes = $(tooltip)
              .find('.like-button-renderer-like-button:first>span')
              .text()
              .replace(/\D/g, '')
          let dislikes = $(tooltip)
              .find('.like-button-renderer-dislike-button:first>span')
              .text()
              .replace(/\D/g, '')
          let video = getVideoObject(likes, dislikes)
          $(tooltip)
              .find('.video-extras-sparkbars')
              .append('<ytrb-classic-tooltip>' + getToolTipText(video) +
                  '</ytrb-classic-tooltip>')
        })
  }
}

// function updateTimeSincePublishedElements() {
//   // For modern theme.
//   if (curTheme === THEME_MODERN || !curTheme) {
//     $('#upload-info .date:not([data-ytrb-found])')
//       .each(function (_, dateSpan) {
//         let dateText = $(dateSpan).text().substring(13)
//         // let prevDateText = $(dateSpan).attr('data-ytrb-found')
//
//         $(dateSpan).attr('data-ytrb-found', dateText)
//
//         let dateFromNow = moment(dateText).fromNow()
//         console.log(dateText, dateFromNow, dateSpan)
//         $(dateSpan).append('<span class="ytrb-time-since">' + dateFromNow + '</span>')
//       })
//   }
// }

function insertCss(url) {
  chrome.runtime.sendMessage({
    contentScriptQuery: 'insertCss',
    url: url,
  })
}

chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function(storedSettings) {
  // In Firefox, `storedSettings` will be undeclared if not previously set.
  if (storedSettings) {
    userSettings = storedSettings
  }

  if (userSettings.barHeight !== 0) {
    insertCss('css/bar.css')

    if (userSettings.barPosition === 'top') {
      insertCss('css/bar-top.css')
    } else {
      insertCss('css/bar-bottom.css')
    }

    if (userSettings.barSeparator) {
      if (userSettings.barPosition === 'top') {
        insertCss('css/bar-top-separator.css')
      } else {
        insertCss('css/bar-bottom-separator.css')
      }
    }

    if (userSettings.barTooltip) {
      insertCss('css/bar-tooltip.css')
      if (userSettings.barPosition === 'top') {
        insertCss('css/bar-top-tooltip.css')
      } else {
        insertCss('css/bar-bottom-tooltip.css')
      }
    }

    if (userSettings.useOnVideoPage) {
      insertCss('css/bar-video-page.css')
    }
  }

  document.documentElement.style.setProperty('--ytrb-bar-height', userSettings.barHeight + 'px')
  document.documentElement.style.setProperty('--ytrb-bar-opacity',  userSettings.barOpacity / 100)

  if (userSettings.barColor === 'blue-gray') {
    document.documentElement.style.setProperty('--ytrb-bar-likes-color', '#3095e3')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-color', '#cfcfcf')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-shadow', 'none')
  } else if (userSettings.barColor === 'green-red') {
    document.documentElement.style.setProperty('--ytrb-bar-likes-color', '#060')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-color', '#c00')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-shadow', 'inset 1px 0 #fff')
  } else if (userSettings.barColor === 'custom-colors') {
    document.documentElement.style.setProperty(
      '--ytrb-bar-likes-color',
      userSettings.barLikesColor
    )
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-color',
      userSettings.barDislikesColor
    )
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-shadow',
      userSettings.barColorsSeparator ? 'inset 1px 0 #fff' : 'none'
    )
  }

  handleMutations()
  observer.observe(document.body, {childList: true, subtree: true})
})