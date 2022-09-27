// Variables for throttling handling DOM mutations.
const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100
let domMutationsAreThrottled = false
let hasUnseenDomMutations = false

// Variables for handling what to do when an API request fails.
const API_RETRY_DELAY = 5000
const MAX_RETRIES_PER_THUMBNAIL = 10
let isPendingApiRetry = false
let thumbnailsToRetry = []

// Enum values for which YouTube theme is currently being viewed.
let curTheme = 0  // No theme set yet.
const THEME_MODERN = 1  // The new Material Design theme.
const THEME_CLASSIC = 2  // The classic theme.
const THEME_GAMING = 3  // The YouTube Gaming theme.
const THEME_MOBILE = 4  // The YouTube mobile theme (m.youtube.com).
const NUM_THEMES = 4

// `isDarkTheme` will be true if the appearance setting is in dark theme mode.
const isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') === ' #181818'

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
    // Gaming all types except video wall. URL is on the great-grandparent,
    // except for search result playlists it is on the grandparent.
    'ytg-thumbnail' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

THUMBNAIL_SELECTORS[THEME_MOBILE] = '' +
    'a.media-item-thumbnail-container, ' +
    'a.compact-media-item-image, ' +
    'a.video-card-image'

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

function getToolTipText(videoData) {
  return videoData.likes.toLocaleString() + '&nbsp;/&nbsp;' +
    videoData.dislikes.toLocaleString() + ' &nbsp;&nbsp; ' +
    ratingToPercentage(videoData.rating) + ' &nbsp;&nbsp; ' +
    videoData.total.toLocaleString() + '&nbsp;total'
}

function exponentialRatingWidthPercentage(rating) {
  return 100 * Math.pow(2, 10 * (rating - 1))
}

// function getLikesToViewsPercentage(likes, views) {
//   if (likes <= 0) return 0
//   if (likes >= views) return 100
//
//   let ratio = likes / views
//   let r = (ratio ** 0.21032389998435974 - 0.4999999701976776) / 0.09012361615896225
//   let v = (Math.log(views) - 12.015865325927734) / 2.8472495079040527
//
//   let m0 = 0.040817804634571075
//   let m1 = -0.27621328830718994
//   let m2 = -0.05106991529464722
//   let m3 = -0.02893015556037426
//   let mean = m0 + m1 * v + m2 * v ** 2 + m3 * v ** 3
//
//   let s0 = -0.09283683449029922
//   let s1 = -0.13813409209251404
//   let s2 = 0.003354990854859352
//   let s3 = 0.004593323916196823
//   let log_std = s0 + s1 * v + s2 * v ** 2 + s3 * v ** 3
//   let std = Math.exp(log_std)
//
//   let cdf = jStat.normal.cdf(r, mean, std)
//   return cdf * 100
// }

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

function getRatingPercentageHtml(videoData) {
  const r = (1 - videoData.rating) * 1275
  let g = videoData.rating * 637.5 - 255
  if (!isDarkTheme) {
    g = Math.min(g, 255) * 0.85
  }
  const rgb = 'rgb(' + r + ',' + g + ',0)'

  return '<span class="style-scope ytd-video-meta-block ytrb-percentage" style="color:' +
      rgb + ' !important">' + ratingToPercentage(videoData.rating) + '</span>'
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
  const thumbnailsAndVideoIds = []
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

    } else if (curTheme === THEME_MOBILE) {
      // The URL should be on the current element.
      url = $(thumbnail).attr('href')

      // On mobile gaming (m.youtube.com/gaming), the thumbnail should be
      // reassigned to the child container.
      const firstChild = $(thumbnail).children(':first')[0]
      if ($(firstChild).is('.video-thumbnail-container-compact')) {
        thumbnail = firstChild
      }

    } else {
      // The theme may not be set if only video-wall thumbnails were found.
      url = $(thumbnail).attr('href')
    }

    if (!url) {
      return true
    }

    // Check if this thumbnail was previously found.
    const previousUrl = $(thumbnail).attr('data-ytrb-processed')
    if (previousUrl) {
      // Check if this thumbnail is for the same URL as previously.
      if (previousUrl === url) {
        // If it is for the same URL, continue the next thumbnail, except on
        // mobile where we have to make on additional check.
        if (curTheme === THEME_MOBILE) {
          // On mobile, we have to check to make sure the bar is still present,
          // because thumbnails can sometimes be recreated (such as when they
          // are scrolled out of view) which causes the bar to be removed.
          if ($(thumbnail).children().last().is('ytrb-bar')) {
            return true
          }
        } else {
          return true
        }
      } else {
        // If not, remove the old rating bar and retries count.
        $(thumbnail).children('ytrb-bar').remove()
        $(thumbnail).removeAttr('data-ytrb-retries')
      }
    }
    // Add an attribute that marks this thumbnail as found, and give it the
    // value of the URL the thumbnail is for.
    $(thumbnail).attr('data-ytrb-processed', url)

    // Extract the video ID from the URL.
    const match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      const id = match[1]
      thumbnailsAndVideoIds.push([thumbnail, id])
    }
  })
  return thumbnailsAndVideoIds
}

function getVideoDataObject(likes, dislikes) {
  const total = likes + dislikes
  const rating = total ? likes / total : null
  return {
    likes: likes,
    dislikes: dislikes,
    total: total,
    rating: rating,
  }
}

function retryProcessingThumbnailInTheFuture(thumbnail) {
  thumbnailsToRetry.push(thumbnail)
  if (!isPendingApiRetry) {
    isPendingApiRetry = true
    setTimeout(() => {
      isPendingApiRetry = false
      thumbnailsToRetry.forEach(thumbnail => {
        const retriesAttr = $(thumbnail).attr('data-ytrb-retries')
        const retriesNum = retriesAttr ? Number.parseInt(retriesAttr, 10) : 0
        if (retriesNum < MAX_RETRIES_PER_THUMBNAIL) {
          $(thumbnail).attr('data-ytrb-retries', retriesNum + 1)
          $(thumbnail).removeAttr('data-ytrb-processed')
          hasUnseenDomMutations = true
        }
      })
      thumbnailsToRetry = []

      // Note: `handleDomMutations()` must be called after updating
      // `isPendingApiRetry` and `thumbnailsToRetry` above to allow for
      // additional retries if needed.
      handleDomMutations()
    }, API_RETRY_DELAY)
  }
}

function getVideoData(thumbnail, videoId) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      {query: 'videoApiRequest', videoId: videoId},
      (likesData) => {
        if (likesData === null) {
          // The API request failed, which is usually due to rate limiting, so
          // we will retry processing the thumbnail in the future.
          retryProcessingThumbnailInTheFuture(thumbnail)
          resolve(null)
        } else {
          resolve(getVideoDataObject(likesData.likes, likesData.dislikes))
        }
      }
    )
  })
}

function addRatingBar(thumbnail, videoData) {
  // Add a rating bar to each thumbnail.
  $(thumbnail).append(getRatingBarHtml(videoData))
}

function addRatingPercentage(thumbnail, videoData) {
  // Add the rating text percentage below or next to the thumbnail.
  let metadataLine
  if (curTheme === THEME_MOBILE) {
    metadataLine = $(thumbnail).closest('ytm-media-item').find('ytm-badge-and-byline-renderer').last()
  } else {
    metadataLine = $(thumbnail).closest(
      '.ytd-rich-item-renderer, ' +  // Home page.
      '.ytd-grid-renderer, ' +  // Trending and subscriptions page.
      '.ytd-expanded-shelf-contents-renderer, ' +  // Subscriptions page.
      '.yt-horizontal-list-renderer, ' +  // Channel page.
      '.ytd-item-section-renderer, ' +  // History page.
      '.ytd-horizontal-card-list-renderer, ' +  // Gaming page.
      '.ytd-playlist-video-list-renderer' // Playlist page.
    ).find('#metadata-line').last()
  }

  if (metadataLine) {
    // Remove any previously added percentages.
    for (const oldPercentage of metadataLine.children('.ytrb-percentage')) {
      oldPercentage.remove()
    }
    if (curTheme === THEME_MOBILE) {
      for (const oldPercentage of metadataLine.children('.ytrb-percentage-separator')) {
        oldPercentage.remove()
      }
    }

    // Add new percentage.
    if (videoData.rating != null) {
      const ratingPercentageHtml = getRatingPercentageHtml(videoData)
      const lastSpan = metadataLine.children('span').last()
      if (lastSpan.length) {
        lastSpan.after(ratingPercentageHtml)
        if (curTheme === THEME_MOBILE) {
          // On mobile, we have to add the separator dot manually.
          lastSpan.after('<span class="ytm-badge-and-byline-separator ytrb-percentage-separator" aria-hidden="true">•</span>')
        }
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
  const thumbnails = getNewThumbnails()
  const thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)

  for (const [thumbnail, videoId] of thumbnailsAndVideoIds) {
    getVideoData(thumbnail, videoId).then(videoData => {
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
  let likes = 0
  let dislikes = 0
  let match = text.match(/\s*([0-9,.]+)([^0-9,.]+)([0-9,.]+)/)
  if (match && match.length >= 4) {
    likes = parseInt(match[1].replaceAll(/[^0-9]/g, ''), 10)
    dislikes = parseInt(match[3].replaceAll(/[^0-9]/g, ''), 10)
  }
  return getVideoDataObject(likes, dislikes)
}

function updateVideoRatingBar() {
  $('.ryd-tooltip').each(function(_, rydTooltip) {
    const tooltip = $(rydTooltip).find('#tooltip')
    const curText = $(tooltip).text()

    // We add a zero width space to the end of any processed tooltip text to
    // prevent it from being reprocessed.
    if (!curText.endsWith('\u200b')) {
      const videoData = getVideoDataFromTooltipText(curText)

      if (userSettings.barTooltip) {
        $(tooltip).text(`${curText} \u00A0\u00A0 ` +
          `${videoData.rating == null ? '0%' : ratingToPercentage(videoData.rating)} \u00A0\u00A0 ` +
          `${videoData.total.toLocaleString()} total\u200b`)
      } else {
        $(tooltip).text(`${curText}\u200b`)
      }

      if (userSettings.useExponentialScaling && videoData.rating) {
        $(rydTooltip).find('#ryd-bar')[0].style.width =  exponentialRatingWidthPercentage(videoData.rating) + '%'
      }
    }
  })
}

function handleDomMutations() {
  // When the DOM is updated, we search for items that should be modified.
  // However, we throttle these searches to not over tax the CPU.
  if (domMutationsAreThrottled) {
    // If updates are currently being throttled, we'll remember to handle
    // them later.
    hasUnseenDomMutations = true
  } else {
    // Turn on throttling.
    domMutationsAreThrottled = true

    // Run the updates.
    if (userSettings.barHeight !== 0 || userSettings.showPercentage) {
      processNewThumbnails()
    }
    if (userSettings.barTooltip || userSettings.useExponentialScaling) {
      updateVideoRatingBar()
    }

    hasUnseenDomMutations = false

    setTimeout(function() {
      // After the timeout, turn off throttling.
      domMutationsAreThrottled = false

      // If any mutations occurred while being throttled, handle them now.
      if (hasUnseenDomMutations) {
        handleDomMutations()
      }

    }, HANDLE_DOM_MUTATIONS_THROTTLE_MS)
  }
}

// An observer for watching changes to the body element.
const mutationObserver = new MutationObserver(handleDomMutations)

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
  mutationObserver.observe(document.body, {childList: true, subtree: true})
})
