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
let curTheme = 0 // No theme set yet.
const THEME_MODERN = 1 // The new Material Design theme.
const THEME_CLASSIC = 2 // The classic theme.
const THEME_GAMING = 3 // The YouTube Gaming theme.
const THEME_MOBILE = 4 // The YouTube mobile theme (m.youtube.com).
const NUM_THEMES = 4

const ADD_RATING_BAR_TO_SHORTS = false

// `isDarkTheme` will be true if the appearance setting is in dark theme mode.
const isDarkTheme =
  getComputedStyle(document.body).getPropertyValue(
    "--yt-spec-general-background-a",
  ) === " #181818"

// We use these JQuery selectors to find new thumbnails on the page. We need to
// check all combinations of these modes and types:
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
THUMBNAIL_SELECTORS[THEME_MODERN] =
  "" +
  // All types except the video wall. The URL is on the selected a link.
  // The mini-player thumbnail will not have an href attribute, which is why
  // we require that it exists.
  "a#thumbnail[href]"

THUMBNAIL_SELECTORS[THEME_CLASSIC] =
  "" +
  // Search results videos. (url on parent)
  // Creator's videos. (url on parent)
  // Playlist page small thumbnails. (url on parent)
  // Sidebar suggested playlist. (url on grandparent)
  // Playing playlist small thumbnails. (url on parent)
  ".video-thumb" +
  ":not(.yt-thumb-20)" +
  ":not(.yt-thumb-27)" +
  ":not(.yt-thumb-32)" +
  ":not(.yt-thumb-36)" +
  ":not(.yt-thumb-48)" +
  ":not(.yt-thumb-64), " +
  // (For search results, if a channel is in the results, it's thumbnail will
  //  be caught by this selector, but won't have an matchable video URL.
  //  Since this does not cause an error, it should be fine to ignore it.)

  // Sidebar suggested video. (url on first child)
  ".thumb-wrapper, " +
  // Playlist page big thumbnail. (url on second child)
  ".pl-header-thumb"

THUMBNAIL_SELECTORS[THEME_GAMING] =
  "" +
  // Gaming all types except video wall. URL is on the great-grandparent,
  // except for search result playlists it is on the grandparent.
  "ytg-thumbnail" +
  ":not([avatar])" +
  ":not(.avatar)" +
  ":not(.ytg-user-avatar)" +
  ":not(.ytg-box-art)" +
  ":not(.ytg-compact-gaming-event-renderer)" +
  ":not(.ytg-playlist-header-renderer)"

THUMBNAIL_SELECTORS[THEME_MOBILE] =
  "" +
  "a.media-item-thumbnail-container, " +
  "a.compact-media-item-image, " +
  "a.video-card-image"

// All themes use this selector for video wall videos.
const THUMBNAIL_SELECTOR_VIDEOWALL = "" + "a.ytp-videowall-still"

// The default user settings. `userSettings` is replaced with the stored user's
// settings once they are loaded.
const DEFAULT_USER_SETTINGS = {
  barPosition: "bottom",
  barColor: "blue-gray",
  barLikesColor: "#3095e3",
  barDislikesColor: "#cfcfcf",
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
  // When the rating is 100%, we display "100%" instead of "100.0%".
  if (rating === 1) {
    return (100).toLocaleString() + "%"
  }

  // We use `floor` instead of `round` to ensure that any rating lower than 100%
  // does not round up to 100% and display as "100.0%".
  return (
    (Math.floor(rating * 1000) / 10).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  )
}

function getToolTipText(videoData) {
  return (
    videoData.likes.toLocaleString() +
    "&nbsp;/&nbsp;" +
    videoData.dislikes.toLocaleString() +
    " &nbsp;&nbsp; " +
    ratingToPercentage(videoData.rating) +
    " &nbsp;&nbsp; " +
    videoData.total.toLocaleString() +
    "&nbsp;total"
  )
}

function exponentialRatingWidthPercentage(rating) {
  return 100 * Math.pow(2, 10 * (rating - 1))
}

function getRatingBarHtml(videoData) {
  let ratingElement
  if (videoData.rating == null) {
    ratingElement = "<ytrb-no-rating></ytrb-no-rating>"
  } else {
    let likesWidthPercentage
    if (userSettings.useExponentialScaling) {
      likesWidthPercentage = exponentialRatingWidthPercentage(videoData.rating)
    } else {
      likesWidthPercentage = 100 * videoData.rating
    }
    ratingElement =
      "<ytrb-rating>" +
      '<ytrb-likes style="width:' +
      likesWidthPercentage +
      '%"></ytrb-likes>' +
      "<ytrb-dislikes></ytrb-dislikes>" +
      "</ytrb-rating>"
  }

  return (
    "<ytrb-bar" +
    (userSettings.barOpacity !== 100
      ? ' style="opacity:' + userSettings.barOpacity / 100 + '"'
      : "") +
    ">" +
    ratingElement +
    (userSettings.barTooltip
      ? "<ytrb-tooltip><div>" +
        getToolTipText(videoData) +
        "</div></ytrb-tooltip>"
      : "") +
    "</ytrb-bar>"
  )
}

function getRatingPercentageHtml(videoData) {
  if (videoData.likes === 0) {
    // Don't colorize the text percentage for videos with 0 likes, since that
    // could mean that the creator of the video has disabled showing the like
    // count for that video.
    // See: https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83
    return (
      '<span class="style-scope ytd-video-meta-block ytd-grid-video-renderer ytrb-percentage">' +
      ratingToPercentage(videoData.rating) +
      "</span>"
    )
  }

  const r = (1 - videoData.rating) * 1275
  let g = videoData.rating * 637.5 - 255
  if (!isDarkTheme) {
    g = Math.min(g, 255) * 0.85
  }
  const rgb = "rgb(" + r + "," + g + ",0)"

  return (
    '<span class="style-scope ytd-video-meta-block ytd-grid-video-renderer ytrb-percentage"><span style="color:' +
    rgb +
    ' !important">' +
    ratingToPercentage(videoData.rating) +
    "</span></span>"
  )
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
  $(thumbnails).each(function (_, thumbnail) {
    // Find the link tag element of the thumbnail and its URL.
    let url
    if (curTheme === THEME_MODERN) {
      // The URL should be on the current element.
      url = $(thumbnail).attr("href")
    } else if (curTheme === THEME_CLASSIC) {
      // Check the current element, then the parent, then the grandparent,
      // then the first child, then the second child.
      url =
        $(thumbnail).attr("href") ||
        $(thumbnail).parent().attr("href") ||
        $(thumbnail).parent().parent().attr("href") ||
        $(thumbnail).children(":first").attr("href") ||
        $(thumbnail).children(":first").next().attr("href")
    } else if (curTheme === THEME_GAMING) {
      // Check the current element, then the grandparent.
      url =
        $(thumbnail).attr("href") ||
        $(thumbnail).parent().parent().attr("href") ||
        $(thumbnail).parent().parent().parent().attr("href")

      // Unless the element is a video wall thumbnail, change the thumbnail
      // element to the parent element, so that it will show over the thumbnail
      // preview video that plays when you hover over the thumbnail.
      if (!$(thumbnail).is("a")) {
        thumbnail = $(thumbnail).parent()
      }
    } else if (curTheme === THEME_MOBILE) {
      // The URL should be on the current element.
      url = $(thumbnail).attr("href")

      // On mobile gaming (m.youtube.com/gaming), the thumbnail should be
      // reassigned to the child container.
      const firstChild = $(thumbnail).children(":first")[0]
      if ($(firstChild).is(".video-thumbnail-container-compact")) {
        thumbnail = firstChild
      }
    } else {
      // The theme may not be set if only video-wall thumbnails were found.
      url = $(thumbnail).attr("href")
    }

    if (!url) {
      return true
    }

    // Check if this thumbnail was previously found.
    const previousUrl = $(thumbnail).attr("data-ytrb-url")
    if (previousUrl) {
      // Check if this thumbnail is for the same URL as previously.
      if (previousUrl === url) {
        // If it is for the same URL, continue the next thumbnail, except on
        // mobile where we have to make on additional check.
        if (curTheme === THEME_MOBILE) {
          // On mobile, we have to check to make sure the bar is still present,
          // because thumbnails can sometimes be recreated (such as when they
          // are scrolled out of view) which causes the bar to be removed.
          if ($(thumbnail).children().last().is("ytrb-bar")) {
            return true
          }
        } else {
          return true
        }
      } else {
        // If not, remove the old rating bar and retries count.
        $(thumbnail).children("ytrb-bar").remove()
        $(thumbnail).removeAttr("data-ytrb-retries")
      }
    }

    // Save the URL that corresponds with this thumbnail in a separate
    // attribute so that we can check if the URL has changed in the future, in
    // which case we'll have to update the rating bar.
    $(thumbnail).attr("data-ytrb-url", url)

    // Extract the video ID from the URL.
    const match =
      url.match(/.*[?&]v=([^&]+).*/) ||
      (ADD_RATING_BAR_TO_SHORTS && url.match(/^\/shorts\/(.+)$/))
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
      thumbnailsToRetry.forEach((thumbnail) => {
        const retriesAttr = $(thumbnail).attr("data-ytrb-retries")
        const retriesNum = retriesAttr ? Number.parseInt(retriesAttr, 10) : 0
        if (retriesNum < MAX_RETRIES_PER_THUMBNAIL) {
          $(thumbnail).attr("data-ytrb-retries", retriesNum + 1)
          $(thumbnail).removeAttr("data-ytrb-url")
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
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { query: "videoApiRequest", videoId: videoId },
      (likesData) => {
        if (likesData === null) {
          // The API request failed, which is usually due to rate limiting, so
          // we will retry processing the thumbnail in the future.
          retryProcessingThumbnailInTheFuture(thumbnail)
          resolve(null)
        } else {
          resolve(getVideoDataObject(likesData.likes, likesData.dislikes))
        }
      },
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
    metadataLine = $(thumbnail)
      .closest("ytm-media-item")
      .find("ytm-badge-and-byline-renderer")
      .last()
  } else {
    metadataLine = $(thumbnail)
      .closest(
        ".ytd-rich-item-renderer, " + // Home page.
          ".ytd-grid-renderer, " + // Trending and subscriptions page.
          ".ytd-expanded-shelf-contents-renderer, " + // Subscriptions page.
          ".yt-horizontal-list-renderer, " + // Channel page.
          ".ytd-item-section-renderer, " + // History page.
          ".ytd-horizontal-card-list-renderer, " + // Gaming page.
          ".ytd-playlist-video-list-renderer", // Playlist page.
      )
      .find("#metadata-line")
      .last()
  }

  if (metadataLine) {
    // Remove any previously added percentages.
    for (const oldPercentage of metadataLine.children(".ytrb-percentage")) {
      oldPercentage.remove()
    }
    if (curTheme === THEME_MOBILE) {
      for (const oldPercentage of metadataLine.children(
        ".ytrb-percentage-separator",
      )) {
        oldPercentage.remove()
      }
    }

    // Add new percentage.
    //
    // We also check if the video has 0 likes and 10+ dislikes, since that
    // probably means that the creator of the video has disabled showing the
    // like count for that video.
    // See: https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83
    if (
      videoData.rating != null &&
      !(videoData.likes === 0 && videoData.dislikes >= 10)
    ) {
      const ratingPercentageHtml = getRatingPercentageHtml(videoData)
      const lastSpan = metadataLine.children("span").last()
      if (lastSpan.length) {
        lastSpan.after(ratingPercentageHtml)
        if (curTheme === THEME_MOBILE) {
          // On mobile, we have to add the separator dot manually.
          lastSpan.after(
            '<span class="ytm-badge-and-byline-separator ytrb-percentage-separator" aria-hidden="true">•</span>',
          )
        }
      } else {
        // This handles metadata lines that are initially empty, which
        // occurs on playlist pages. We prepend the rating percentage as well
        // as an empty meta block element to add a separating dot before the
        // rating percentage.
        metadataLine.prepend(ratingPercentageHtml)
        metadataLine.prepend(
          '<span class="style-scope ytd-video-meta-block"></span>',
        )
      }
    }
  }
}

function processNewThumbnails() {
  const thumbnails = getNewThumbnails()
  const thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)

  for (const [thumbnail, videoId] of thumbnailsAndVideoIds) {
    getVideoData(thumbnail, videoId).then((videoData) => {
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

// The `NUMBERING_SYSTEM_DIGIT_STRINGS` constant below was generated using this
// code:
//
//   // The list of all possible numbering systems can be found here:
//   // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#parameters):
//   const numberingSystems = [
//     "arab", "arabext", "bali", "beng", "deva", "fullwide", "gujr", "guru",
//     "hanidec", "khmr", "knda", "laoo", "latn", "limb", "mlym", "mong",
//     "mymr", "orya", "tamldec", "telu", "thai", "tibt",
//   ]
//   const digitStrings = []
//   for (const numberingSystem of numberingSystems) {
//     let digitString = ""
//     for (let i = 0; i < 10; i++) {
//       digitString += i.toLocaleString("en-US-u-nu-" + numberingSystem)
//     }
//     digitStrings.push(digitString)
//   }
//   console.log(
//     "const NUMBERING_SYSTEM_DIGIT_STRINGS = [" +
//       digitStrings.map((s) => '\n  "' + s + '",').join("") +
//       "\n]",
//   )
//
const NUMBERING_SYSTEM_DIGIT_STRINGS = [
  "٠١٢٣٤٥٦٧٨٩",
  "۰۱۲۳۴۵۶۷۸۹",
  "᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙",
  "০১২৩৪৫৬৭৮৯",
  "०१२३४५६७८९",
  "０１２３４５６７８９",
  "૦૧૨૩૪૫૬૭૮૯",
  "੦੧੨੩੪੫੬੭੮੯",
  "〇一二三四五六七八九",
  "០១២៣៤៥៦៧៨៩",
  "೦೧೨೩೪೫೬೭೮೯",
  "໐໑໒໓໔໕໖໗໘໙",
  "0123456789",
  "᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏",
  "൦൧൨൩൪൫൬൭൮൯",
  "᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙",
  "၀၁၂၃၄၅၆၇၈၉",
  "୦୧୨୩୪୫୬୭୮୯",
  "௦௧௨௩௪௫௬௭௮௯",
  "౦౧౨౩౪౫౬౭౮౯",
  "๐๑๒๓๔๕๖๗๘๙",
  "༠༡༢༣༤༥༦༧༨༩",
]

function parseInternationalInt(string) {
  // Parses an internationalized integer string (e.g. "1,234" or "١٬٢٣٤") into a
  // JavaScript integer.
  string = string.replace(/[\s,.]/g, "")

  if (/[^0-9]/.test(string)) {
    let newString = ""
    for (const char of string) {
      for (const digitString of NUMBERING_SYSTEM_DIGIT_STRINGS) {
        const index = digitString.indexOf(char)
        if (index !== -1) {
          newString += index
          break
        }
      }
    }
    string = newString
  }

  return parseInt(string, 10)
}

function getVideoDataFromTooltipText(text) {
  // This function parses the Return YouTube Dislike tooltip text (see:
  // https://github.com/Anarios/return-youtube-dislike/blob/main/Extensions/combined/src/bar.js#L33).
  // Currently, this function does not support the case where the user has set
  // their Return YouTube Dislike tooltip setting to "only_like" (only show the
  // likes count) or "only_dislike" (only show the dislikes count). In those
  // cases, this function will return null and the tooltip and rating bar will
  // not be updated. Support for those options could potentially be added in
  // the future by having this function fall back to retrieving the rating from
  // the API when it can't compute the rating using only the tooltip text.
  let match = text.match(/^([^\/]+)\/([^-]+)(-|$)/)
  if (match && match.length >= 4) {
    const likes = parseInternationalInt(match[1])
    const dislikes = parseInternationalInt(match[2])
    return getVideoDataObject(likes, dislikes)
  }
  return null
}

function updateVideoRatingBar() {
  $(".ryd-tooltip").each(function (_, rydTooltip) {
    const tooltip = $(rydTooltip).find("#tooltip")
    const curText = $(tooltip).text()

    // We add a zero-width space to the end of any processed tooltip text to
    // prevent it from being reprocessed.
    if (!curText.endsWith("\u200b")) {
      const videoData = getVideoDataFromTooltipText(curText)

      if (userSettings.barTooltip && videoData) {
        $(tooltip).text(
          `${curText} \u00A0\u00A0 ` +
            `${ratingToPercentage(videoData.rating ?? 0)} \u00A0\u00A0 ` +
            `${videoData.total.toLocaleString()} total\u200b`,
        )
      } else {
        $(tooltip).text(`${curText}\u200b`)
      }

      if (userSettings.useExponentialScaling && videoData && videoData.rating) {
        const rydBar = $(rydTooltip).find("#ryd-bar")[0]
        if (rydBar) {
          rydBar.style.width =
            exponentialRatingWidthPercentage(videoData.rating) + "%"
        }
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

    setTimeout(function () {
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

chrome.storage.local.get(DEFAULT_USER_SETTINGS, function (storedSettings) {
  // In Firefox, `storedSettings` will be undeclared if not previously set.
  if (storedSettings) {
    userSettings = storedSettings
  }

  const cssFiles = []
  if (userSettings.barHeight !== 0) {
    cssFiles.push("css/bar.css")

    if (userSettings.barPosition === "top") {
      cssFiles.push("css/bar-top.css")
    } else {
      cssFiles.push("css/bar-bottom.css")
    }

    if (userSettings.barSeparator) {
      if (userSettings.barPosition === "top") {
        cssFiles.push("css/bar-top-separator.css")
      } else {
        cssFiles.push("css/bar-bottom-separator.css")
      }
    }

    if (userSettings.barTooltip) {
      cssFiles.push("css/bar-tooltip.css")
      if (userSettings.barPosition === "top") {
        cssFiles.push("css/bar-top-tooltip.css")
      } else {
        cssFiles.push("css/bar-bottom-tooltip.css")
      }
    }

    if (userSettings.useOnVideoPage) {
      cssFiles.push("css/bar-video-page.css")
    }
  }

  if (cssFiles.length > 0) {
    chrome.runtime.sendMessage({
      query: "insertCss",
      files: cssFiles,
    })
  }

  document.documentElement.style.setProperty(
    "--ytrb-bar-height",
    userSettings.barHeight + "px",
  )
  document.documentElement.style.setProperty(
    "--ytrb-bar-opacity",
    userSettings.barOpacity / 100,
  )

  if (userSettings.barColor === "blue-gray") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      "#3095e3",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#cfcfcf",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      "none",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "none",
    )
  } else if (userSettings.barColor === "green-red") {
    document.documentElement.style.setProperty("--ytrb-bar-likes-color", "#060")
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#c00",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      "1px 0 #fff",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "inset 1px 0 #fff",
    )
  } else if (userSettings.barColor === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      userSettings.barLikesColor,
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      userSettings.barDislikesColor,
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      userSettings.barColorsSeparator ? "1px 0 #fff" : "none",
    )
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      userSettings.barColorsSeparator ? "inset 1px 0 #fff" : "none",
    )
  }

  handleDomMutations()
  mutationObserver.observe(document.body, { childList: true, subtree: true })
})
