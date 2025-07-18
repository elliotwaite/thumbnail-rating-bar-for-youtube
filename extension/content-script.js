// Variables for throttling handling DOM mutations.
const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100
let domMutationsAreThrottled = false
let hasUnseenDomMutations = false

// Variables for handling what to do when an API request fails.
const MAX_API_RETRIES_PER_THUMBNAIL = 10
const API_RETRY_DELAY_MIN_MS = 3000
const API_RETRY_UNIFORM_DISTRIBUTION_WIDTH_MS = 3000
let isPendingApiRetry = false
let thumbnailsToRetry = []

// Used for marking thumbnails as processed.
const PROCESSED_DATA_ATTRIBUTE_NAME = "data-ytrb-processed"

// Whether we are currently viewing the mobile version of the YouTube website.
const IS_MOBILE_SITE = window.location.href.startsWith("https://m.youtube.com")
const IS_YOUTUBE_KIDS_SITE = window.location.href.startsWith(
  "https://www.youtubekids.com",
)

// Whether the site is currently using the dark theme.
const IS_USING_DARK_THEME =
  getComputedStyle(document.body).getPropertyValue(
    "--yt-spec-general-background-a",
  ) === " #181818"

// The default user settings.
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

// `userSettings` is replaced with the stored user's settings once they are
// loaded.
let userSettings = DEFAULT_USER_SETTINGS

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

async function getVideoDataFromApi(videoId) {
  for (let i = 0; i <= MAX_API_RETRIES_PER_THUMBNAIL; i++) {
    let likesData = await chrome.runtime.sendMessage({
      query: "getLikesData",
      videoId: videoId,
    })

    if (likesData !== null) {
      return getVideoDataObject(likesData.likes, likesData.dislikes)
    }

    await sleep(
      API_RETRY_DELAY_MIN_MS +
        Math.random() * API_RETRY_UNIFORM_DISTRIBUTION_WIDTH_MS,
    )
  }
}

function ratingToPercentageString(rating) {
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

function getToolTipHtml(videoData) {
  return (
    videoData.likes.toLocaleString() +
    "&nbsp;/&nbsp;" +
    videoData.dislikes.toLocaleString() +
    " &nbsp;&nbsp; " +
    ratingToPercentageString(videoData.rating) +
    " &nbsp;&nbsp; " +
    videoData.total.toLocaleString() +
    "&nbsp;total"
  )
}

function exponentialRatingWidthPercentage(rating) {
  return 100 * Math.pow(2, 10 * (rating - 1))
}

function getRatingBarElement(videoData) {
  const barElement = document.createElement("ytrb-bar")

  if (userSettings.barOpacity !== 100) {
    barElement.style.opacity = (userSettings.barOpacity / 100).toString()
  }

  let ratingElement
  if (videoData.rating == null) {
    ratingElement = document.createElement("ytrb-no-rating")
  } else {
    const likesWidthPercentage = userSettings.useExponentialScaling
      ? exponentialRatingWidthPercentage(videoData.rating)
      : 100 * videoData.rating

    ratingElement = document.createElement("ytrb-rating")

    const likesElement = document.createElement("ytrb-likes")
    likesElement.style.width = `${likesWidthPercentage}%`

    const dislikesElement = document.createElement("ytrb-dislikes")

    ratingElement.appendChild(likesElement)
    ratingElement.appendChild(dislikesElement)
  }

  barElement.appendChild(ratingElement)

  if (userSettings.barTooltip) {
    const tooltipElement = document.createElement("ytrb-tooltip")
    const divElement = document.createElement("div")
    divElement.innerHTML = getToolTipHtml(videoData)
    tooltipElement.appendChild(divElement)
    barElement.appendChild(tooltipElement)
  }

  return barElement
}

function getRatingPercentageElement(videoData) {
  const span = document.createElement("span")
  span.role = "text"

  const ratingTextNode = document.createTextNode(
    ratingToPercentageString(videoData.rating),
  )

  if (videoData.likes === 0) {
    // Don't colorize the text percentage for videos with 0 likes, since that
    // could mean that the creator of the video has disabled showing the like
    // count for that video.
    // See: https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83
    span.appendChild(ratingTextNode)
  } else {
    // Create inner span for colorized text.
    const innerSpan = document.createElement("span")

    // Calculate the color based on the rating.
    const r = Math.round((1 - videoData.rating) * 1275)
    let g = videoData.rating * 637.5 - 255
    if (!IS_USING_DARK_THEME) {
      g = Math.min(g, 255) * 0.85
    }

    // Apply the color to the inner span and add the text.
    const color = `rgb(${r},${Math.round(g)},0)`
    innerSpan.style.setProperty("color", color, "important")
    innerSpan.appendChild(ratingTextNode)
    span.appendChild(innerSpan)
  }

  return span
}

// Adds the rating bar after the thumbnail img tag.
function addRatingBar(thumbnailElement, videoData) {
  let parent = thumbnailElement.parentElement

  // Sometimes by the time we are ready to add a rating bar after the thumbnail
  // element, it won't have a parent. I'm not sure why this happens, but it
  // might be related to how YouTube's UI framework works. Regardless, it means
  // the thumbnail is currently not on the page in a normal position, so we can
  // skip trying to add a rating bar after it. Also the code we use below to
  // add the rating bar after the thumbnail requires the parent to exist.
  if (parent) {
    parent.appendChild(getRatingBarElement(videoData))
  }
}

function removeOldPercentages(element) {
  element.querySelectorAll(".ytrb-percentage").forEach((oldPercentage) => {
    oldPercentage.remove()
  })
}

// This provides a list of ways we try to find the metadata line for appending
// the text percentage to it. Each item in the list contains:
// - The CSS selector for the closest common element of the thumbnail element
//   and the metadata line element.
// - The CSS selector for the metadata line element.
// - The classes that should be added to the inserted percentage text span.
const METADATA_LINE_DATA_DESKTOP = [
  // - Homepage videos
  [
    "ytd-rich-grid-media",
    "#metadata-line",
    "style-scope ytd-video-meta-block ytd-grid-video-renderer",
  ],
  // - Search result videos
  // - Search result Shorts listed individually
  [
    // The `div.` is required for the playlist page small thumbnails because
    // they have a closer `ytd-thumbnail` element that also has the
    // "ytd-playlist-video-renderer" class.
    "ytd-video-renderer",
    "#metadata-line",
    "inline-metadata-item style-scope ytd-video-meta-block",
  ],
  // - Search result Shorts in horizontal carousel
  [
    "ytm-shorts-lockup-view-model",
    ".shortsLockupViewModelHostMetadataSubhead",
    "yt-core-attributed-string yt-core-attributed-string--white-space-pre-wrap",
  ],
  // - Subscriptions page videos
  [
    ".yt-lockup-view-model-wiz",
    ".yt-content-metadata-view-model-wiz__metadata-row:last-child",
    "yt-core-attributed-string yt-content-metadata-view-model-wiz__metadata-text yt-core-attributed-string--white-space-pre-wrap yt-core-attributed-string--link-inherit-color",
  ],
  // - Playlist page small thumbnails
  [
    // The `div.` part is required because there is a closer `ytd-thumbnail`
    // element that also has the "ytd-playlist-video-renderer" class.
    "div.ytd-playlist-video-renderer",
    "#metadata-line",
    "style-scope ytd-video-meta-block",
  ],
  // - Movies page movies
  ["ytd-grid-movie-renderer", ".grid-movie-renderer-metadata", ""],
  // - Your Courses page playlist
  [
    "ytd-grid-movie-renderer",
    "#byline-container",
    "style-scope ytd-video-meta-block",
  ],
  // - Your Clips page clips
  [
    // The `div.` part is required because there is a closer `ytd-thumbnail`
    // element that also has the "ytd-playlist-video-renderer" class.
    "div.ytd-grid-video-renderer",
    "#metadata-line",
    "style-scope ytd-grid-video-renderer",
  ],
  // - Home page sponsored video version 1
  [
    "ytd-promoted-video-renderer",
    "#metadata-line",
    "style-scope ytd-video-meta-block",
  ],
  // - Home page sponsored video version 2
  [
    ".ytd-video-display-full-buttoned-and-button-group-renderer",
    "#byline-container",
    "style-scope ytd-ad-inline-playback-meta-block yt-simple-endpoint",
  ],
  // - YouTube Music (music.youtube.com) home page videos
  [
    "ytmusic-two-row-item-renderer",
    "yt-formatted-string.subtitle",
    "style-scope yt-formatted-string",
  ],
]
const METADATA_LINE_DATA_MOBILE = [
  // Homepage videos
  [
    "ytm-media-item",
    "ytm-badge-and-byline-renderer",
    "ytm-badge-and-byline-item-byline small-text",
  ],
  // Subscriptions page Shorts in horizontal carousel
  [
    ".shortsLockupViewModelHostEndpoint",
    ".shortsLockupViewModelHostMetadataSubhead",
    "yt-core-attributed-string yt-core-attributed-string--white-space-pre-wrap",
  ],
  // Profile page History videos in horizontal carousel
  [
    "ytm-video-card-renderer",
    ".subhead .small-text:last-child",
    "yt-core-attributed-string",
  ],
  // Profile my videos
  [".compact-media-item", ".subhead", "compact-media-item-stats small-text"],
]

// Adds the rating text percentage below or next to the thumbnail in the video
// metadata line.
function addRatingPercentage(thumbnailElement, videoData) {
  let metadataLineFinderAndElementClasses = IS_MOBILE_SITE
    ? METADATA_LINE_DATA_MOBILE
    : METADATA_LINE_DATA_DESKTOP

  for (let i = 0; i < metadataLineFinderAndElementClasses.length; i++) {
    const [containerSelector, metadataLineSelector, metadataLineItemClasses] =
      metadataLineFinderAndElementClasses[i]
    const container = thumbnailElement.closest(containerSelector)
    if (container) {
      // We found the container.
      const metadataLine = container.querySelector(metadataLineSelector)
      if (metadataLine) {
        // We found the metadata line. Remove any old percentages.
        removeOldPercentages(metadataLine)

        // We create the rating percentage element and give it the same classes
        // as the other metadata line items in the metadata line, plus
        // "ytrb-percentage".
        const ratingPercentageElement = getRatingPercentageElement(videoData)
        ratingPercentageElement.className =
          metadataLineItemClasses + " ytrb-percentage"

        // Append the rating percentage element to the end of the metadata line.
        metadataLine.appendChild(ratingPercentageElement)

        return
      }
    }
  }
}

async function processNewThumbnail(thumbnailElement, thumbnailUrl) {
  let splitUrl = thumbnailUrl.split("/")

  // We don't want to add rating bars to the chapter thumbnails. Chapter
  // thumbnail filenames use the format: "hqdefault_*.jpg", where `*` is an
  // integer that is the number of milliseconds into the video that the
  // thumbnail was taken from. But we have to make sure not to match custom
  // thumbnails that use the format: "hqdefault_custom_*.jpg", where `*` is an
  // integer that is the ID of the custom thumbnail.
  let filenameAndQueryParams = splitUrl[5]
  if (
    filenameAndQueryParams.startsWith("hqdefault_") &&
    !filenameAndQueryParams.startsWith("hqdefault_custom_")
  ) {
    return
  }

  let videoId = splitUrl[4]
  let videoData = await getVideoDataFromApi(videoId)

  if (videoData === null) {
    // We failed to retrieve the video data so we mark the thumbnail as
    // unprocessed so that we can try again in the future.
    thumbnailElement.removeAttribute(PROCESSED_DATA_ATTRIBUTE_NAME)
    return
  }

  // We only add the rating bar if the user has enabled it. If barHeight is 0,
  // it means the user has disabled it.
  if (userSettings.barHeight !== 0) {
    addRatingBar(thumbnailElement, videoData)
  }

  // We only add the rating percentage if the user has enabled it, the video has
  // a rating (rating will only be null if the video has no likes or dislikes),
  // and if the video creator has not disabled showing like counts for that
  // video (videos with 0 likes and 10+ dislikes probably mean the creator has
  // disabled showing like counts for that video, see:
  // https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83).
  if (
    userSettings.showPercentage &&
    videoData.rating != null &&
    !(videoData.likes === 0 && videoData.dislikes >= 10)
  ) {
    addRatingPercentage(thumbnailElement, videoData)
  }
}

function processNewThumbnails() {
  // Process the unprocessed standard thumbnail images that use an img tag.
  const unprocessedThumbnailImgs = document.querySelectorAll(
    // This will match:
    // - https://i.ytimg.com/vi/<videoId>/... (standard thumbnails)
    // - https://i9.ytimg.com/vi/<videoId>/... (certain thumbnails, like the one for: https://youtu.be/XFl4q2FfkVg)
    // - https://i.ytimg.com/vi_webp/<videoId>/movieposter_en.webp" (Movies page)
    // - https://i.ytimg.com/an_webp/<videoId>/... (YouTube Kids)
    //
    // `:not(.ytCinematicContainerViewModelBackgroundImage` is added to avoid
    // matching the thumbnails that are used for the blurred backgrounds the big
    // playlist thumbnail on the playlist page.
    'img[src*=".ytimg.com/"]:not([data-ytrb-processed]):not(.ytCinematicContainerViewModelBackgroundImage)',
  )
  for (const thumbnailImg of unprocessedThumbnailImgs) {
    // Mark it as processed.
    thumbnailImg.setAttribute(PROCESSED_DATA_ATTRIBUTE_NAME, "")

    let thumbnailUrl = thumbnailImg.getAttribute("src")
    processNewThumbnail(thumbnailImg, thumbnailUrl)
  }

  // Process the unprocessed video wall still images that use a div with a
  // background image.
  const unprocessedVideoWallStillImages = document.querySelectorAll(
    ".ytp-videowall-still-image:not([data-ytrb-processed])",
  )
  for (const videoWallStillImage of unprocessedVideoWallStillImages) {
    // Mark it as processed.
    videoWallStillImage.setAttribute(PROCESSED_DATA_ATTRIBUTE_NAME, "")

    const backgroundImageUrl = videoWallStillImage.style.backgroundImage

    // `backgroundImageUrl` will be something like
    // 'url("https://i.ytimg.com/vi/..."', so this removes the 'url("' from the
    // start and the '")' from the end.
    const thumbnailUrl = backgroundImageUrl.slice(5, -2)

    processNewThumbnail(videoWallStillImage, thumbnailUrl)
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

// This function parses the Return YouTube Dislike tooltip text (see:
// https://github.com/Anarios/return-youtube-dislike/blob/main/Extensions/combined/src/bar.js#L33).
// Currently, this function does not support the case where the user has set
// their Return YouTube Dislike tooltip setting to "only_like" (only show the
// likes count) or "only_dislike" (only show the dislikes count). In those
// cases, this function will return null and the tooltip and rating bar will not
// be updated. Support for those options could potentially be added in the
// future by having this function fall back to retrieving the rating from the
// API when it can't compute the rating using only the tooltip text.
function getVideoDataFromTooltipText(text) {
  let match = text.match(/^([^\/]+)\/([^-]+)(-|$)/)
  if (match && match.length >= 4) {
    const likes = parseInternationalInt(match[1])
    const dislikes = parseInternationalInt(match[2])
    return getVideoDataObject(likes, dislikes)
  }
  return null
}

function updateVideoRatingBar() {
  for (const rydTooltip of document.querySelectorAll(".ryd-tooltip")) {
    const tooltip = rydTooltip.querySelector("#tooltip")
    if (!tooltip) continue

    const curText = tooltip.textContent

    // We add a zero-width space to the end of any processed tooltip text to
    // prevent it from being reprocessed.
    if (!curText.endsWith("\u200b")) {
      const videoData = getVideoDataFromTooltipText(curText)
      if (!videoData) continue

      if (userSettings.barTooltip) {
        tooltip.textContent =
          `${curText} \u00A0\u00A0 ` +
          `${ratingToPercentageString(videoData.rating ?? 0)} \u00A0\u00A0 ` +
          `${videoData.total.toLocaleString()} total\u200b`
      } else {
        tooltip.textContent = `${curText}\u200b`
      }

      if (userSettings.useExponentialScaling && videoData.rating) {
        const rydBar = rydTooltip.querySelector("#ryd-bar")
        if (rydBar) {
          rydBar.style.width = `${exponentialRatingWidthPercentage(
            videoData.rating,
          )}%`
        }
      }
    }
  }
}

// Handles when the DOM is mutated, which is when we search for items that
// should be modified. However, we throttle these searches to not over tax the
// CPU.
function handleDomMutations() {
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

chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function (storedSettings) {
  // In Firefox, `storedSettings` will be undeclared if not previously set.
  if (storedSettings) {
    userSettings = storedSettings
  }

  // On the YouTube Kids site, we never show text percentages, so we just
  // pretend the user has disabled them when on the YouTube Kids site.
  if (IS_YOUTUBE_KIDS_SITE) {
    userSettings.showPercentage = false
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

  if (userSettings.showPercentage) {
    cssFiles.push("css/text-percentage.css")
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
