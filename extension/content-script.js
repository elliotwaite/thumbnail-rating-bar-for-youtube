// Setting debug to true will turn on console.log messages used for debugging.
let debug = false

// Variables for handling throttling DOM searches.
const THROTTLE_MS = 100
let hasUnseenMutations = false
let isThrottled = false

// A cache to store video ratings, to limit API calls and improve performance.
let videoCache = {}

// Enum values for which YouTube theme is currently being viewed.
let curTheme = 0  // No theme set yet.
const THEME_MODERN = 1  // The new Material Design theme.
const THEME_CLASSIC = 2  // The classic theme.
const THEME_GAMING = 3  // The YouTube Gaming theme.
const NUM_THEMES = 3

// `isDarkTheme` will be true if the appearance setting is in dark theme mode.
let isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') === ' #181818'

// We use these JQuery selectors to find new thumbnails on the page. We use
// :not([data-ytrb-processed]) to make sure these aren't thumbnails that we've
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

// A regex for cleaning the tooltip text on the video page before processing.
const NON_DIGITS_OR_FORWARDSLASH_REGEX = /[^\d/]/g;

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
  useExponentialScaling: false,
  barTooltip: true,
  useOnVideoPage: false,
  showPercentage: false,
}
let userSettings = DEFAULT_USER_SETTINGS

function ratingToPercentage(rating) {
  if (rating === 1) {
    return '100%'
  }
  // Note: We use floor instead of round to ensure that anything lower than
  // 100% does not display "100.0%".
  return (Math.floor(rating * 1000) / 10).toFixed(1) + '%'
}

function getToolTipText(video) {
  return video.likes + '&nbsp;/&nbsp;' + video.dislikes + ' &nbsp;&nbsp; '
      + ratingToPercentage(video.rating) + ' &nbsp;&nbsp; ' + video.total + '&nbsp;total'
}

function exponentialRatingWidthPercentage(rating) {
  return 100 * Math.pow(2, 10 * (rating - 1))
}

function getRatingBarHtml(videoData) {
  let ratingElement
  if (videoData.rating == null) {
    ratingElement = '<ytrb-no-rating></ytrb-no-rating>'
  } else {
    let likesWidthPercentage
    if (userSettings.useExponentialScaling) {
      likesWidthPercentage = exponentialRatingWidthPercentage(videoData.rating)
    } else {
      likesWidthPercentage = 100 * videoData.rating
    }
    ratingElement = '<ytrb-rating>' +
                      '<ytrb-likes style="width:' + likesWidthPercentage + '%"></ytrb-likes>' +
                      '<ytrb-dislikes></ytrb-dislikes>' +
                    '</ytrb-rating>'
  }

  return '<ytrb-bar' +
      (userSettings.barOpacity !== 100
          ? ' style="opacity:' + (userSettings.barOpacity / 100) + '"'
          : ''
      ) +
      '>' +
      ratingElement +
      (userSettings.barTooltip
          ? '<ytrb-tooltip><div>' + getToolTipText(videoData) + '</div></ytrb-tooltip>'
          : ''
      ) +
      '</ytrb-bar>'
}

function getRatingPercentageHtml(video) {
  let r = (1 - video.rating) * 1275
  let g = video.rating * 637.5 - 255
  if (!isDarkTheme) {
    g = Math.min(g, 255) * 0.85
  }
  let rgb = 'rgb(' + r + ',' + g + ',0)'

  return '<span class="style-scope ytd-video-meta-block ytrb-percentage" style="color:' +
      rgb + '">' + ratingToPercentage(video.rating) + '</span>'
}

function getNewThumbnails() {
  // Returns an array of thumbnails that have not been processed yet, and sets
  // the theme if it hasn't been set yet.
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
  thumbnails = $.merge(thumbnails, $(THUMBNAIL_SELECTOR_VIDEOWALL))
  return thumbnails
}

function getThumbnailsAndIds(thumbnails) {
  // Finds the video ID associated with each thumbnail and returns an array of
  // arrays of [thumbnail element, video ID string].
  let thumbnailsAndVideoIds = []
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
      // The theme may not be set if only video-wall thumbnails were found.
      url = $(thumbnail).attr('href')
    }

    if (!url) {
      if (debug) console.log('DEBUG: Url not found.', thumbnail, url)
      return true
    }

    // Check if this thumbnail was previously found.
    let previousUrl = $(thumbnail).attr('data-ytrb-processed')
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
    $(thumbnail).attr('data-ytrb-processed', url)

    // Extract the video ID from the URL.
    let match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      let id = match[1]
      thumbnailsAndVideoIds.push([thumbnail, id])
    } else if (debug) {
      console.log('DEBUG: Match not found.', thumbnail, url)
    }
  })
  return thumbnailsAndVideoIds
}

function getVideoDataObject(likes, dislikes) {
  let total = likes + dislikes
  let rating = total ? likes / total : null
  return {
    likes: likes,
    dislikes: dislikes,
    total: total,
    rating: rating,
  }
}

async function getVideoData(videoId) {
  if (videoId in videoCache) {
    return videoCache[videoId]
  }

  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      {query: 'videoApiRequest', videoId: videoId},
      data => {
        let videoData = getVideoDataObject(data.likes, data.dislikes)
        videoCache[videoId] = videoData
        resolve(videoData)
      },
    )
  })
}

function addRatingBar(thumbnail, videoData) {
  // Add a rating bar to each thumbnail.
  $(thumbnail).prepend(getRatingBarHtml(videoData))
}

function addRatingPercentage(thumbnail, videoData) {
  // Add the rating text percentage below or next to the thumbnail.
  let metadataLine = $(thumbnail).closest(
    '.ytd-rich-item-renderer, ' +  // Home page.
    '.ytd-grid-renderer, ' +  // Trending and subscriptions page.
    '.ytd-expanded-shelf-contents-renderer, ' +  // Also subscriptions page.
    '.yt-horizontal-list-renderer, ' +  // Channel page.
    '.ytd-item-section-renderer, ' +  // History page.
    '.ytd-horizontal-card-list-renderer, ' +  // Gaming page.
    '.ytd-playlist-video-list-renderer' // Playlist page.
  ).find('#metadata-line').last()

  if (metadataLine) {
    // Remove any previously added percentages.
    for (let oldPercentage of metadataLine.children('.ytrb-percentage')) {
      oldPercentage.remove()
    }

    // Add new percentage.
    if (videoData.rating != null) {
      let ratingPercentageHtml = getRatingPercentageHtml(videoData)
      let lastSpan = metadataLine.children('span').last()
      if (lastSpan.length) {
        lastSpan.after(ratingPercentageHtml)
      } else {
        // This handles metadata lines that are initially empty, which
        // occurs on playlist pages. We prepend the rating percentage as well
        // as an empty meta block element to add a separating dot before the
        // rating percentage.
        metadataLine.prepend(ratingPercentageHtml)
        metadataLine.prepend('<span class="style-scope ytd-video-meta-block"></span>')
      }
    }
  }
}

function processNewThumbnails() {
  let thumbnails = getNewThumbnails()
  let thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)

  for (let [thumbnail, videoId] of thumbnailsAndVideoIds) {
    getVideoData(videoId).then(videoData => {
      if (videoData !== null) {
        if (userSettings.barHeight !== 0) {
          addRatingBar(thumbnail, videoData)
        }
        if (userSettings.showPercentage) {
          addRatingPercentage(thumbnail, videoData)
        }
      }
    })
  }
}

function getVideoDataFromTooltipText(text) {
  let cleanedText = text.replaceAll(NON_DIGITS_OR_FORWARDSLASH_REGEX, '')
  let [likes, dislikes] = cleanedText.split('/').map(x => parseInt(x))
  return getVideoDataObject(likes, dislikes)
}

function updateVideoRatingBar() {
  $('.ryd-tooltip').each(function(_, rydTooltip) {
    let tooltip = $(rydTooltip).find('#tooltip')
    let curText = $(tooltip).text()

    // We add a zero width space to the end of any processed tooltip text to
    // prevent it from being reprocessed.
    if (!curText.endsWith('\u200b')) {
      let videoData = getVideoDataFromTooltipText(curText)

      if (userSettings.barTooltip) {
        $(tooltip).text(`${curText} \u00A0\u00A0 ` +
          `${videoData.rating == null ? '0%' : ratingToPercentage(videoData.rating)} \u00A0\u00A0 ` +
          `${videoData.total.toLocaleString()} total\u200b`)
      } else {
        $(tooltip).text(`${curText}\u200b`)
      }

      if (userSettings.useExponentialScaling) {
        $(rydTooltip).find('#ryd-bar')[0].style.width =  exponentialRatingWidthPercentage(videoData.rating) + '%'
      }
    }
  })
}

function handleDomMutations() {
  // When the DOM is updated, we search for items that should be modified.
  // However, we throttle these searches to not over tax the CPU.
  if (isThrottled) {
    // If updates are currently being throttled, we'll remember to handle
    // them later.
    hasUnseenMutations = true
  } else {
    // Run the updates.
    processNewThumbnails()

    if (userSettings.barTooltip || userSettings.useExponentialScaling) {
      updateVideoRatingBar()
    }

    hasUnseenMutations = false

    // Turn on throttle.
    isThrottled = true

    setTimeout(function() {
      // After `THROTTLE_MS` milliseconds, turn off the throttle.
      isThrottled = false

      // If any mutations occurred while being throttled, handle them now.
      if (hasUnseenMutations) {
        handleDomMutations()
      }

    }, THROTTLE_MS)
  }
}

// An observer for watching changes to the body element.
let observer = new MutationObserver(handleDomMutations)

function insertCss(url) {
  chrome.runtime.sendMessage({
    query: 'insertCss',
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
    document.documentElement.style.setProperty('--ytrb-bar-likes-shadow', 'none')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-shadow', 'none')
  } else if (userSettings.barColor === 'green-red') {
    document.documentElement.style.setProperty('--ytrb-bar-likes-color', '#060')
    document.documentElement.style.setProperty('--ytrb-bar-dislikes-color', '#c00')
    document.documentElement.style.setProperty('--ytrb-bar-likes-shadow', '1px 0 #fff')
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
      '--ytrb-bar-likes-shadow',
      userSettings.barColorsSeparator ? '1px 0 #fff' : 'none'
    )
    document.documentElement.style.setProperty(
      '--ytrb-bar-dislikes-shadow',
      userSettings.barColorsSeparator ? 'inset 1px 0 #fff' : 'none'
    )
  }

  handleDomMutations()
  observer.observe(document.body, {childList: true, subtree: true})
})
