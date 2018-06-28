<div align="center">
<img src="https://raw.githubusercontent.com/elliotwaite/youtube-thumbnail-rating-bar/master/icon128.png" />

# YouTube Thumbnail Rating Bar

</div>

This Chrome extension adds the likes/dislikes rating bar to the bottom of every YouTube the video thumbnail, so you can find higher quality content and avoid getting clickbaited.

**Download it here: [YouTube Thumbnail Rating Bar - Chrome Extension](https://chrome.google.com/webstore/detail/youtube-thumbnail-rating/cmlddjbnoehmihdmfhaacemlpgfbpoeb)**

![](https://raw.githubusercontent.com/elliotwaite/youtube-thumbnail-rating-bar/master/img/screenshot-1.jpg)

## Why
Using YouTube usually involves browsing through many video previews. These video previews usually contain the following:
* Thumbnail image
* Video title
* Creator’s name
* Creator’s subscriber count (sometimes)
* View count
* Short description (sometimes)
Video length

We use this information to try to estimate the value of the content before exploring it further. A useful indicator of value is how valuable other viewers found this content. The view count has some correlation to this value, but on its own is unreliable. By being able to also see the video’s rating, users are able to much more accurately estimate the value of the content, resulting in finding higher quality content, saving time, and avoiding being clickbaited.

## How

When a user browses a page on YouTube, the Chrome extension script searches the page content for thumbnails. Once it finds all the video thumbnails that it has not yet processed previously, it finds the YouTube video IDs associated with those thumbnails. It then calls the YouTube Data API to get the statistics data for those videos. It makes those API calls in batches of 50 video IDs at a time, which is the APIs limit. When the statistics data is return, the likes and dislikes data is used to style the rating bars that are then added to the thumbnails. To avoid calling the API multiple times for the same video ID, a hash table is used to store previously processed video IDs and their associated ratings. This hash table is stored until the browser tab is closed, refreshed, or the user leaves YouTube.

## Design

The current design uses the same colors and height of the rating bar that is shown on the video’s page. The blue and grey colors and the 4px height seem to be a good balance between being easily visible but not too distracting. However, different colors and bar heights may be preferable to different users, and perhaps these settings could be made customizable in the future.
