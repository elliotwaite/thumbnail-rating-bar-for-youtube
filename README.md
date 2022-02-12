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

## The API

This extension uses the [Return YouTube
Dislike](https://returnyoutubedislike.com) API for likes/dislikes data.

If you would also like to see the likes/dislikes rating bar that used to be
available on each video page, you can also install [their
extension](https://returnyoutubedislike.com/install).

## Mobile Support

This extension also works on mobile browsers that support Chrome extensions,
such as [Kiwi Browser](https://kiwibrowser.com) for Android.  

## Rate Limiting and the Cache Duration Setting 

The Return YouTube Dislike API is rate limited by IP address, so if you notice
that some thumbnails aren't receiving rating bars, you may be getting
temporarily rate limited. If this happens, you will usually only be rate
limited for about ~15 seconds before you can start retrieving new rating data,
but you may need to refresh the page if you want to retry loading the rating
bars for the thumbnails that got rate limited.

To help prevent rate limiting, this extension uses a cache, meaning that
whenever it fetches data from the API, it will save that data and reuse it
if needed for however long the cache duration is (the default setting is 10
minutes, but this is adjustable). This helps reduce the number or API requests
that are made.

Also, the same global cache is shared across all of your browser's tabs and
windows.

## Exponential Scaling Option Explained

In the extension's settings, you can enable an option to exponentially scale the
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

Note: If you also have the [Return YouTube Dislike
extension](https://returnyoutubedislike.com/install) installed, which adds a
rating bar to the video page, this option will affect the scaling of that
rating bar as well.

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

We use this information to try to estimate the value of the content before
exploring it further. A useful indicator of the value of the content is how
valuable other viewers found it. The view count has some correlation with the
value of the content, but on its own is unreliable. By being able to also see
the video’s rating, users can much more accurately estimate the value
of the content, resulting in finding higher quality content, saving time, and
avoiding being clickbaited.

## License

[MIT](LICENSE)
