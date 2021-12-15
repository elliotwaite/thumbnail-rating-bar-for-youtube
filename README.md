<div align="center">
<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/extension/icons/icon128.png" />

# Thumbnail Rating Bar for YouTube&trade;

</div>

This extension adds a likes/dislikes rating bar to the bottom of every YouTube video thumbnail, so you can find higher quality content and avoid getting clickbaited.

## Install

Chrome Extension:<br />
https://chrome.google.com/webstore/detail/thumbnail-rating-bar-for/cmlddjbnoehmihdmfhaacemlpgfbpoeb

Firefox Add-on:<br />
https://addons.mozilla.org/en-US/firefox/addon/youtube-thumbnail-rating-bar/

Edge Add-on:<br />
https://microsoftedge.microsoft.com/addons/detail/thumbnail-rating-bar-for-/mglepphnjnfcljjafdgafoipiakakbin

## API and Rate Limiting

This extension uses the [Return YouTube
Dislike](https://returnyoutubedislike.com) API for likes/dislikes data. Their
API is rate limited by IP address, so if you notice that some thumbnails aren't
receiving rating bars, you may be getting temporarily rate limited.

You can also install [their extension](https://returnyoutubedislike.com/install)
to see the likes/dislikes and rating bar on the video page.

## Exponential Scaling Option Explained

In the extension's settings you can enable an option to exponentially scale the
rating bar. This makes it easier to distinguish between highly rated videos
(since most videos have a rating over 90%). You can see the difference between
the default linear scaling and the exponential scaling here:

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/linear-vs-exponential-scaling.png?raw=true" width=367>

With exponential scaling, each reduction in 10% of the rating from 100% will
half the width of the likes bar:

| Rating | Width |
|--------|-------|
|   100% |  100% |
|    90% |   50% |
|    80% |   25% |
|    70% | 12.5% |
|    ... |  etc. |

Note: This option only affects the scaling of the rating bar that is added to the
thumbnails. It does not affect the scaling of the rating bar shown on the video
page (if you have the [Return YouTube Dislike's extension](https://returnyoutubedislike.com/install)
installed).

Special thanks to [Qarthak](https://github.com/Qarthak) for
[requesting this feature](https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/49).



## Why Use This Extension
Using YouTube usually involves browsing through many video previews. These video previews usually contain the following:
* Thumbnail image
* Video title
* Creator’s name
* Creator’s subscriber count (sometimes)
* View count
* Short description (sometimes)
* Video length

We use this information to try to estimate the value of the content before exploring it further. A useful indicator of value of the content is how valuable other viewers found it. The view count has some correlation with the value of the content, but on its own is unreliable. By being able to also see the video’s rating, users are able to much more accurately estimate the value of the content, resulting in finding higher quality content, saving time, and avoiding being clickbaited.

## How This Extension Works

When a user browses a page on YouTube, the extension/add-on script searches the page content for thumbnails. Once it finds all the video thumbnails that it has not yet processed previously, it finds the YouTube video IDs associated with those thumbnails. It then calls the YouTube Data API to get the statistics data for those videos. It makes those API calls in batches of 50 video IDs at a time, which is the APIs limit. When the statistics data is returned, the likes and dislikes data is used to style the rating bars that are then added to the thumbnails. To avoid calling the API multiple times for the same video ID, a hash table is used to store previously processed video IDs and their associated ratings. This hash table is stored until the browser tab is closed, refreshed, or the user leaves YouTube.

## Design Details

The current settings offer a blue-and-grey bar or a green-and-red bar (default: blue-and-grey). The position of the bar can be toggled between top or bottom (default: bottom). The height of the bar can be adjusted between 0px (hidden) and 16px (default: 4px). The opacity of the bar can be adjusted between 0% and 100% (default: 100%). A white separation line can optionally be shown above the bar (default: not shown). A tooltip that displays the exact number of likes and dislikes can optionally be shown when a user hovers over the bar (default: enabled). A color-coded rating percentage can be added to the text section of each video listing.

## License

[MIT](LICENSE)