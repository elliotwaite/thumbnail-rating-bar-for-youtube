<div align="center">
<img src="https://raw.githubusercontent.com/elliotwaite/youtube-thumbnail-rating-bar/master/extension/icons/icon128.png" />

# Thumbnail Rating Bar for YouTube&trade;

</div>

This extension adds the likes/dislikes rating bar to the bottom of every YouTube the video thumbnail, so you can find higher quality content and avoid getting clickbaited.

## Install

For Chrome:  
https://chrome.google.com/webstore/detail/youtube-thumbnail-rating/cmlddjbnoehmihdmfhaacemlpgfbpoeb

For Firefox:  
https://addons.mozilla.org/en-US/firefox/addon/youtube-thumbnail-rating-bar/

## Screenshots

**A rating bar is added to every thumbnail.**

![](https://raw.githubusercontent.com/elliotwaite/youtube-thumbnail-rating-bar/master/images/screenshot-1.jpg)

**Access the settings by clicking the extension's icon in the toolbar.**

![](https://raw.githubusercontent.com/elliotwaite/youtube-thumbnail-rating-bar/master/images/screenshot-2.jpg)

## Why
Using YouTube usually involves browsing through many video previews. These video previews usually contain the following:
* Thumbnail image
* Video title
* Creator’s name
* Creator’s subscriber count (sometimes)
* View count
* Short description (sometimes)
* Video length

We use this information to try to estimate the value of the content before exploring it further. A useful indicator of value of the content is how valuable other viewers found it. The view count has some correlation with the value of the content, but on its own is unreliable. By being able to also see the video’s rating, users are able to much more accurately estimate the value of the content, resulting in finding higher quality content, saving time, and avoiding being clickbaited.

## How

When a user browses a page on YouTube, the extension/add-on script searches the page content for thumbnails. Once it finds all the video thumbnails that it has not yet processed previously, it finds the YouTube video IDs associated with those thumbnails. It then calls the YouTube Data API to get the statistics data for those videos. It makes those API calls in batches of 50 video IDs at a time, which is the APIs limit. When the statistics data is returned, the likes and dislikes data is used to style the rating bars that are then added to the thumbnails. To avoid calling the API multiple times for the same video ID, a hash table is used to store previously processed video IDs and their associated ratings. This hash table is stored until the browser tab is closed, refreshed, or the user leaves YouTube.

## Design

The current settings offer a blue-and-grey bar or a green-and-red bar (default: blue-and-grey). The thickness of the bar can be adjusted between 0px and 16px (default: 4px). The opacity of the bar can be adjusted between 0% and 100% (default: 100%). A white separation line can optionally be shown above the bar (default: not shown). A tooltip that displays the exact number of likes and dislikes can optionally be shown when a user hovers over the bar (default: enabled).
