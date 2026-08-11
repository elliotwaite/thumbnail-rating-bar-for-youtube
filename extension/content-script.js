// Variables for throttling handling DOM mutations.
const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100;
let domMutationsAreThrottled = false;
let hasUnseenDomMutations = false;

// Variables for handling what to do when an API request fails.
const MAX_API_RETRIES_PER_THUMBNAIL = 10;
const API_RETRY_DELAY_MIN_MS = 3000;
const API_RETRY_UNIFORM_DISTRIBUTION_WIDTH_MS = 3000;

// Content-script cache and in-flight dedupe for likes/dislikes data. Prevents
// spamming the service worker when thumbnail nodes are recreated.
const videoDataCache = new Map();
const videoDataInFlight = new Map();

// Whether we are currently viewing the mobile version of the YouTube website.
const IS_MOBILE_SITE = window.location.href.startsWith("https://m.youtube.com");
const IS_YOUTUBE_KIDS_SITE = window.location.href.startsWith(
  "https://www.youtubekids.com",
);

// Whether the site is currently using the dark theme.
const IS_USING_DARK_THEME =
  getComputedStyle(document.body).getPropertyValue(
    "--yt-spec-general-background-a",
  ) === " #181818";

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
};

// `userSettings` is replaced with the stored user's settings once they are
// loaded.
let userSettings = DEFAULT_USER_SETTINGS;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVideoDataObject(likes, dislikes) {
  const total = likes + dislikes;
  const rating = total ? likes / total : null;
  return {
    likes: likes,
    dislikes: dislikes,
    total: total,
    rating: rating,
  };
}

async function fetchVideoDataFromApi(videoId) {
  for (let i = 0; i <= MAX_API_RETRIES_PER_THUMBNAIL; i++) {
    let likesData = await chrome.runtime.sendMessage({
      query: "getLikesData",
      videoId: videoId,
    });

    if (likesData !== null) {
      return getVideoDataObject(likesData.likes, likesData.dislikes);
    }

    await sleep(
      API_RETRY_DELAY_MIN_MS +
        Math.random() * API_RETRY_UNIFORM_DISTRIBUTION_WIDTH_MS,
    );
  }
}

async function getVideoDataFromApi(videoId) {
  if (videoDataCache.has(videoId)) {
    return videoDataCache.get(videoId);
  }

  if (videoDataInFlight.has(videoId)) {
    return videoDataInFlight.get(videoId);
  }

  const promise = fetchVideoDataFromApi(videoId)
    .then((videoData) => {
      if (videoData) {
        videoDataCache.set(videoId, videoData);
      }
      return videoData;
    })
    .finally(() => {
      videoDataInFlight.delete(videoId);
    });

  videoDataInFlight.set(videoId, promise);
  return promise;
}

function ratingToPercentageString(rating) {
  // When the rating is 100%, we display "100%" instead of "100.0%".
  if (rating === 1) {
    return (100).toLocaleString() + "%";
  }

  // We use `floor` instead of `round` to ensure that any rating lower than 100%
  // does not round up to 100% and display as "100.0%".
  return (
    (Math.floor(rating * 1000) / 10).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
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
  );
}

function exponentialRatingWidthPercentage(rating) {
  return 100 * Math.pow(2, 10 * (rating - 1));
}

function getRatingBarElement(videoData) {
  const barElement = document.createElement("ytrb-bar");

  if (userSettings.barOpacity !== 100) {
    barElement.style.opacity = (userSettings.barOpacity / 100).toString();
  }

  let ratingElement;
  if (videoData.rating == null) {
    ratingElement = document.createElement("ytrb-no-rating");
  } else {
    const likesWidthPercentage = userSettings.useExponentialScaling
      ? exponentialRatingWidthPercentage(videoData.rating)
      : 100 * videoData.rating;

    ratingElement = document.createElement("ytrb-rating");

    const likesElement = document.createElement("ytrb-likes");
    likesElement.style.width = `${likesWidthPercentage}%`;

    const dislikesElement = document.createElement("ytrb-dislikes");

    ratingElement.appendChild(likesElement);
    ratingElement.appendChild(dislikesElement);
  }

  barElement.appendChild(ratingElement);

  if (userSettings.barTooltip) {
    const tooltipElement = document.createElement("ytrb-tooltip");
    const divElement = document.createElement("div");
    divElement.innerHTML = getToolTipHtml(videoData);
    tooltipElement.appendChild(divElement);
    barElement.appendChild(tooltipElement);
  }

  return barElement;
}

function getRatingPercentageElement(videoData) {
  const span = document.createElement("span");
  span.role = "text";

  const ratingTextNode = document.createTextNode(
    ratingToPercentageString(videoData.rating),
  );

  if (videoData.likes === 0) {
    // Don't colorize the text percentage for videos with 0 likes, since that
    // could mean that the creator of the video has disabled showing the like
    // count for that video.
    // See: https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83
    span.appendChild(ratingTextNode);
  } else {
    // Create inner span for colorized text.
    const innerSpan = document.createElement("span");

    // Calculate the color based on the rating.
    const r = Math.round((1 - videoData.rating) * 1275);
    let g = videoData.rating * 637.5 - 255;
    if (!IS_USING_DARK_THEME) {
      g = Math.min(g, 255) * 0.85;
    }

    // Apply the color to the inner span and add the text.
    const color = `rgb(${r},${Math.round(g)},0)`;
    innerSpan.style.setProperty("color", color, "important");
    innerSpan.appendChild(ratingTextNode);
    span.appendChild(innerSpan);
  }

  return span;
}

function getRatingBarTargetParent(thumbnailElement) {
  return (
    thumbnailElement.closest(
      "yt-thumbnail-view-model, div[id='media-container']",
    ) ?? thumbnailElement.parentElement
  );
}

// Adds the rating bar after the thumbnail img tag.
function addRatingBar(thumbnailElement, videoData) {
  let parent = getRatingBarTargetParent(thumbnailElement);

  // Sometimes by the time we are ready to add a rating bar after the thumbnail
  // element, it won't have a parent. I'm not sure why this happens, but it
  // might be related to how YouTube's UI framework works. Regardless, it means
  // the thumbnail is currently not on the page in a normal position, so we can
  // skip trying to add a rating bar after it. Also the code we use below to
  // add the rating bar after the thumbnail requires the parent to exist.
  if (parent) {
    // The thumbnail <img> may be recreated while our previous bar remains on
    // the parent, so clear any existing bars before adding the current one.
    parent.querySelectorAll("ytrb-bar").forEach((el) => el.remove());
    parent.appendChild(getRatingBarElement(videoData));
  }
}

// Removes the rating bar after the thumbnail img tag.
function removeRatingBar(thumbnailElement) {
  const parent = getRatingBarTargetParent(thumbnailElement);
  if (parent) {
    parent.querySelectorAll("ytrb-bar").forEach((el) => el.remove());
  }
}

// This provides a list of ways we try to find the metadata line for appending
// the text percentage to it. Each item in the list contains:
// - The CSS selector for the closest common element of the thumbnail element
//   and the metadata line element.
// - The CSS selector for the metadata line element.
// - The classes that should be added to the inserted percentage text span.
const METADATA_LINE_DATA_DESKTOP = [
  // - Homepage videos
  // - Subscriptions page videos
  // - Search results playlists
  // - Sidebar suggested videos
  [
    "yt-lockup-view-model",
    ".ytContentMetadataViewModelMetadataRow:last-child",
    "ytAttributedStringHost ytContentMetadataViewModelMetadataText ytAttributedStringWhiteSpacePreWrap ytAttributedStringLinkInheritColor",
  ],
  // - Search results videos
  // - Search results Shorts listed individually
  [
    // The `div.` is required for the playlist page small thumbnails because
    // they have a closer `ytd-thumbnail` element that also has the
    // "ytd-playlist-video-renderer" class.
    "ytd-video-renderer",
    "#metadata-line",
    "inline-metadata-item style-scope ytd-video-meta-block",
  ],
  // - Homepage Shorts in horizontal carousel
  // - Subscriptions page Shorts in horizontal carousel
  // - Search results Shorts in horizontal carousel
  // - Sidebar suggested Shorts in horizontal carousel
  [
    "ytm-shorts-lockup-view-model",
    ".shortsLockupViewModelHostMetadataSubhead",
    "yt-core-attributed-string yt-core-attributed-string--white-space-pre-wrap",
  ],
  // - Profile page "Videos" tab videos
  [
    "ytd-rich-grid-media",
    "#metadata-line",
    "inline-metadata-item style-scope ytd-video-meta-block",
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
];
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
];

// Returns the metadata line element and the classes of the metadata line items.
function getMetadataLineElementAndItemClasses(thumbnailElement) {
  let metadataLineFinderAndElementClasses = IS_MOBILE_SITE
    ? METADATA_LINE_DATA_MOBILE
    : METADATA_LINE_DATA_DESKTOP;

  for (let i = 0; i < metadataLineFinderAndElementClasses.length; i++) {
    const [containerSelector, metadataLineSelector, metadataLineItemClasses] =
      metadataLineFinderAndElementClasses[i];

    const containerElement = thumbnailElement.closest(containerSelector);

    if (containerElement) {
      // We found the container.
      const metadataLineElement =
        containerElement.querySelector(metadataLineSelector);

      if (metadataLineElement) {
        // We found the metadata line.
        return [metadataLineElement, metadataLineItemClasses];
      }
    }
  }

  return [null, null];
}

// Adds the rating text percentage to the video metadata line.
function addRatingPercentage(thumbnailElement, videoData) {
  const [metadataLineElement, metadataLineItemClasses] =
    getMetadataLineElementAndItemClasses(thumbnailElement);

  if (!metadataLineElement) {
    // The metadata line was not found.
    return;
  }

  // Clear any existing percentage first. The metadata line can retain an old
  // one when the thumbnail's video ID changes or nodes are recreated.
  // Previously we skipped when one existed, which avoided duplicates
  // (https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/101)
  // but could leave a stale percentage for the wrong video.
  metadataLineElement.querySelectorAll(".ytrb-percentage").forEach((el) => {
    el.remove();
  });

  // We create the rating percentage element and give it the same classes as the
  // other metadata line items in the metadata line, plus "ytrb-percentage".
  const ratingPercentageElement = getRatingPercentageElement(videoData);
  ratingPercentageElement.className =
    metadataLineItemClasses + " ytrb-percentage";

  // Append the rating percentage element to the end of the metadata line.
  metadataLineElement.appendChild(ratingPercentageElement);
}

// Removes the rating text percentage in the video metadata line.
function removeRatingPercentage(thumbnailElement) {
  const [metadataLineElement, _] =
    getMetadataLineElementAndItemClasses(thumbnailElement);

  if (!metadataLineElement) {
    // The metadata line was not found.
    return;
  }

  // Remove any old percentages.
  metadataLineElement.querySelectorAll(".ytrb-percentage").forEach((el) => {
    el.remove();
  });
}

async function processThumbnail(thumbnailElement, thumbnailUrl) {
  // We skip these specific thumbnails.
  // - In snackbars (e.g. the "Saved to Watch Later" snackbar shown after saving
  //   a video to your Watch Later playlist).
  // - Chapter thumbnails in search results (when the chapters container is both
  //   collapsed and expanded)
  // - Chapter thumbnails on the video page in the expanded video description.
  // - The frame preview shown when hovering over the progress bar of Short
  //   videos.
  if (
    thumbnailElement.closest(
      "snackbar-container, ytd-expandable-metadata-renderer, ytd-macro-markers-list-item-renderer, yt-player-storyboard",
    ) !== null
  ) {
    return;
  }

  let splitUrl = thumbnailUrl.split("/");
  let videoId = splitUrl[4];

  // Skip URLs that don't have a parseable video ID in the expected path spot.
  if (!videoId) {
    return;
  }

  // Check if this thumbnail has already been processed for its video ID.
  let prevVideoId = thumbnailElement.getAttribute("data-ytrb-video-id");
  if (prevVideoId === videoId) {
    // This thumbnail has already been processed for its current video ID.
    return;
  }

  // If this element was previously processed for a different video, remove the
  // old rating UI before the async fetch so it isn't left showing the wrong
  // video's data while we wait.
  if (prevVideoId) {
    if (userSettings.barHeight !== 0) {
      removeRatingBar(thumbnailElement);
    }
    if (userSettings.showPercentage) {
      removeRatingPercentage(thumbnailElement);
    }
  }

  // Set an attribute to remember what video ID the thumbnail was processed for.
  thumbnailElement.setAttribute("data-ytrb-video-id", videoId);

  let videoData = await getVideoDataFromApi(videoId);

  if (!videoData) {
    // We failed to retrieve the video data so we remove the attribute that
    // remembers what video ID the thumbnail was processed for so that we can
    // try again in the future. Any previous rating UI was already cleared
    // above when the video ID changed.
    thumbnailElement.removeAttribute("data-ytrb-video-id");
    return;
  }

  // We only add the rating bar if the user has enabled it. If barHeight is 0,
  // it means the user has disabled it.
  if (userSettings.barHeight !== 0) {
    addRatingBar(thumbnailElement, videoData);
  }

  // We only add the rating percentage if the user has enabled it, the video has
  // a rating (rating will only be null if the video has no likes or dislikes),
  // and if the video creator has not disabled showing like counts for that
  // video (videos with 0 likes and 10+ dislikes probably mean the creator has
  // disabled showing like counts for that video, see:
  // https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/83).
  if (userSettings.showPercentage) {
    if (
      videoData.rating != null &&
      !(videoData.likes === 0 && videoData.dislikes >= 10)
    ) {
      addRatingPercentage(thumbnailElement, videoData);
    } else {
      // This video shouldn't show a percentage; clear any previous one (e.g. if
      // the thumbnail node was recreated and still has a stale percentage).
      removeRatingPercentage(thumbnailElement);
    }
  }
}

function processNewThumbnails() {
  // Process the unprocessed standard thumbnail images that use an img tag.
  const thumbnailElements = document.querySelectorAll(
    // This will match:
    // - https://i.ytimg.com/vi/<videoId>/... (standard thumbnails)
    // - https://i9.ytimg.com/vi/<videoId>/... (certain thumbnails, like the one for: https://youtu.be/XFl4q2FfkVg)
    // - https://i.ytimg.com/vi_webp/<videoId>/movieposter_en.webp" (Movies page)
    // - https://i.ytimg.com/an_webp/<videoId>/... (YouTube Kids)
    //
    // `:not(...)` is added to avoid matching:
    // - `.ytCinematicContainerViewModelBackgroundImage`: blurred backgrounds
    //   for the big playlist thumbnail on the playlist page.
    // - `.branding-img`: channel watermark branding image.
    'img[src*=".ytimg.com/"]:not(.ytCinematicContainerViewModelBackgroundImage):not(.branding-img)',
  );
  for (const thumbnailElement of thumbnailElements) {
    let thumbnailUrl = thumbnailElement.getAttribute("src");
    processThumbnail(thumbnailElement, thumbnailUrl);
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
];

function parseInternationalInt(string) {
  // Parses an internationalized integer string (e.g. "1,234" or "١٬٢٣٤") into a
  // JavaScript integer.
  string = string.replace(/[\s,.]/g, "");

  if (/[^0-9]/.test(string)) {
    let newString = "";
    for (const char of string) {
      for (const digitString of NUMBERING_SYSTEM_DIGIT_STRINGS) {
        const index = digitString.indexOf(char);
        if (index !== -1) {
          newString += index;
          break;
        }
      }
    }
    string = newString;
  }

  return parseInt(string, 10);
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
  let match = text.match(/^([^\/]+)\/([^-]+)(-|$)/);
  if (match && match.length >= 4) {
    const likes = parseInternationalInt(match[1]);
    const dislikes = parseInternationalInt(match[2]);
    return getVideoDataObject(likes, dislikes);
  }
  return null;
}

function updateVideoRatingBar() {
  for (const rydTooltip of document.querySelectorAll(".ryd-tooltip")) {
    const tooltip = rydTooltip.querySelector("#tooltip");
    if (!tooltip) continue;

    const curText = tooltip.textContent;

    // We add a zero-width space to the end of any processed tooltip text to
    // prevent it from being reprocessed.
    if (!curText.endsWith("\u200b")) {
      const videoData = getVideoDataFromTooltipText(curText);
      if (!videoData) continue;

      if (userSettings.barTooltip) {
        tooltip.textContent =
          `${curText} \u00A0\u00A0 ` +
          `${ratingToPercentageString(videoData.rating ?? 0)} \u00A0\u00A0 ` +
          `${videoData.total.toLocaleString()} total\u200b`;
      } else {
        tooltip.textContent = `${curText}\u200b`;
      }

      if (userSettings.useExponentialScaling && videoData.rating) {
        const rydBar = rydTooltip.querySelector("#ryd-bar");
        if (rydBar) {
          rydBar.style.width = `${exponentialRatingWidthPercentage(
            videoData.rating,
          )}%`;
        }
      }
    }
  }
}

function isOwnModificationNode(node) {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node.tagName.startsWith("YTRB-") ||
      node.classList.contains("ytrb-percentage") ||
      node.closest("ytrb-bar") !== null)
  );
}

function mutationIsRelevant(mutation) {
  if (mutation.type === "childList") {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && !isOwnModificationNode(node)) {
        return true;
      }
    }
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && !isOwnModificationNode(node)) {
        return true;
      }
    }
    return false;
  }

  if (mutation.type === "attributes") {
    const target = mutation.target;
    if (!(target instanceof Element) || target.closest("ytrb-bar")) {
      return false;
    }

    if (mutation.attributeName === "src") {
      // Only re-scan when an image points at a YouTube thumbnail host. This
      // ignores src changes to data/blob/other CDN URLs.
      if (target.tagName !== "IMG") {
        return false;
      }
      const src = target.getAttribute("src") || "";
      return src.includes(".ytimg.com/");
    }
  }

  return false;
}

// Handles when the DOM is mutated, which is when we search for items that
// should be modified. However, we throttle these searches to not over tax the
// CPU.
function handleDomMutations(mutations) {
  // Skip batches that only contain our own nodes or irrelevant attribute
  // changes (e.g. thumbnail src swapping away from ytimg).
  if (mutations && mutations.length > 0) {
    let relevant = false;
    for (const mutation of mutations) {
      if (mutationIsRelevant(mutation)) {
        relevant = true;
        break;
      }
    }
    if (!relevant) {
      return;
    }
  }

  if (domMutationsAreThrottled) {
    // If updates are currently being throttled, we'll remember to handle
    // them later.
    hasUnseenDomMutations = true;
  } else {
    // Turn on throttling.
    domMutationsAreThrottled = true;

    // Run the updates.
    if (userSettings.barHeight !== 0 || userSettings.showPercentage) {
      processNewThumbnails();
    }
    if (userSettings.barTooltip || userSettings.useExponentialScaling) {
      updateVideoRatingBar();
    }

    hasUnseenDomMutations = false;

    setTimeout(function () {
      // After the timeout, turn off throttling.
      domMutationsAreThrottled = false;

      // If any mutations occurred while being throttled, handle them now.
      if (hasUnseenDomMutations) {
        handleDomMutations();
      }
    }, HANDLE_DOM_MUTATIONS_THROTTLE_MS);
  }
}

// Observer for page-wide childList/src changes.
const mutationObserver = new MutationObserver(handleDomMutations);

chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function (storedSettings) {
  // In Firefox, `storedSettings` will be undeclared if not previously set.
  if (storedSettings) {
    userSettings = storedSettings;
  }

  // On the YouTube Kids site, we never show text percentages, so we just
  // pretend the user has disabled them when on the YouTube Kids site.
  if (IS_YOUTUBE_KIDS_SITE) {
    userSettings.showPercentage = false;
  }

  const cssFiles = [];
  if (userSettings.barHeight !== 0) {
    cssFiles.push("css/bar.css");

    if (userSettings.barPosition === "top") {
      cssFiles.push("css/bar-top.css");
    } else {
      cssFiles.push("css/bar-bottom.css");
    }

    if (userSettings.barSeparator) {
      if (userSettings.barPosition === "top") {
        cssFiles.push("css/bar-top-separator.css");
      } else {
        cssFiles.push("css/bar-bottom-separator.css");
      }
    }

    if (userSettings.barTooltip) {
      cssFiles.push("css/bar-tooltip.css");
      if (userSettings.barPosition === "top") {
        cssFiles.push("css/bar-top-tooltip.css");
      } else {
        cssFiles.push("css/bar-bottom-tooltip.css");
      }
    }

    if (userSettings.useOnVideoPage) {
      cssFiles.push("css/bar-video-page.css");
    }
  }

  if (userSettings.showPercentage) {
    cssFiles.push("css/text-percentage.css");
  }

  if (cssFiles.length > 0) {
    chrome.runtime.sendMessage({
      query: "insertCss",
      files: cssFiles,
    });
  }

  document.documentElement.style.setProperty(
    "--ytrb-bar-height",
    userSettings.barHeight + "px",
  );
  document.documentElement.style.setProperty(
    "--ytrb-bar-opacity",
    userSettings.barOpacity / 100,
  );

  if (userSettings.barColor === "blue-gray") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      "#3095e3",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#cfcfcf",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      "none",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "none",
    );
  } else if (userSettings.barColor === "green-red") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      "#060",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#c00",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      "1px 0 #fff",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "inset 1px 0 #fff",
    );
  } else if (userSettings.barColor === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      userSettings.barLikesColor,
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      userSettings.barDislikesColor,
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-shadow",
      userSettings.barColorsSeparator ? "1px 0 #fff" : "none",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      userSettings.barColorsSeparator ? "inset 1px 0 #fff" : "none",
    );
  }

  handleDomMutations();
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
});
