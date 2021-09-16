<div align="center">
<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/extension/icons/icon128.png" />

# Thumbnail Rating Bar for YouTube&trade;

</div>

This extension adds a likes/dislikes rating bar to the bottom of every YouTube video thumbnail, so you can find higher quality content and avoid getting clickbaited.

## Install

For Chrome:
https://chrome.google.com/webstore/detail/thumbnail-rating-bar-for/cmlddjbnoehmihdmfhaacemlpgfbpoeb

For Firefox:
https://addons.mozilla.org/en-US/firefox/addon/youtube-thumbnail-rating-bar/

This extension also requires you to set up a personal YouTube Data API key, as described below in the "Set Up a YouTube Data API Key" section.

## Set Up a YouTube Data API Key

This extension now requires users to provide their own personal YouTube Data
API key through the extension's settings page. This is because the quota for
the extension's shared API key is currently restricted (more details available
[here](https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/17)).

Note: Alternatively, if you don't want to set up a personal API key, there is
now an alternative option, however this option is much less performant and you
will notice a significant lag between when a page loads and when the rating
bars are displayed. To try out this alternative, you can set the API key to
"invidious" on the extension's settings page. This will cause the extension
to use the public
[invidious API](https://github.com/omarroth/invidious/wiki/API), however this
API is much slower than the YouTube Data API, so it is highly recommended that
you set up a YouTube Data API key by following the instructions below.

#### Set up a free YouTube Data API key:

1. Create a new project.

   * Go to: https://console.developers.google.com/projectcreate

   * For "Project name" enter any name you want, for example
     "YouTube Data API Key".

   * For "Location" leave it as "No organization".

   * Then click the "CREATE" button.

   * This will start creating a project and you'll see a progress wheel around
     the notification icon. Once the project has finished being created,
     continue to the next step.

2. Enable the YouTube Data API v3.

   * Go to: https://console.cloud.google.com/apis/library/youtube.googleapis.com

   * Then click the "ENABLE" button.

   * Note: This may end up navigating you to another page that displays a
     "CREATE CREDENTIALS" button. But if that happens, just ignore that button
     and follow the instructions in the next step.

3. Create an API Key.

   * Go to: https://console.cloud.google.com/apis/credentials

   * Click the "+ CREATE CREDENTIALS" dropdown button, then choose "API key".

   * This will create your API key and display a dialog box. At the bottom
     right of that dialog box, click the "RESTRICT KEY" button.

   * Then under the "API restrictions" section, click the "Restrict key" radio
     button, and then below it, open the "Select APIs" dropdown menu and check
     the "YouTube Data API v3" checkbox (if you don't see this option, make
     sure you successfully enabled the API in step 2 above).

   * Then click the "SAVE" button at the bottom of that page.

   * Then copy your listed API key to your clipboard (it should look something
     like this: AIzaSyAylQ59uKlkZt2EgRPoygscGb_AHBQ5MEY).

     Note: If you need to access your API key in the future, it will be
     available here:
     https://console.cloud.google.com/apis/credentials

4. Set your API key on the extension's settings page.

   <img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/screenshot-2.jpg?raw=true&v=2" width=400>

   * Go to the extension's settings page, which is accessible by clicking the
     extension's icon in your browser's toolbar.

   * Paste your API key into the available text field.

   * Then click the "SAVE" button.

You should now be all set. Refresh any previously opened YouTube tabs to
see the changes.

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/screenshot-1.jpg?raw=true" width=400>

YouTube will allow you to use your API key to make a certain number of API
requests per day, this is called your quota. To view your daily quota usage,
go here and select your project from the dropdown menu at the top of the
page:
https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas

To keep your API key private, this extension only stores your API key
locally on your computer using local storage. This can be confirmed by
viewing the source code.

Enjoy.

## Exponential Scaling Option Explained
Most videos on YouTube have very high ratings making it hard distinguish which
videos are higher rated than others just by looking at the rating bar. To help
with this, an option has been added to allow users to exponentially scale the
rating bar.

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/exponential-scaling-option.png?raw=true" width=276>

Here you can see the difference between the default linear scaling and the exponential scaling:

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/linear-vs-exponential-scaling.png?raw=true" width=367>

With exponential scaling, each reduction in 10% of the rating from 100% will
half the width of the likes bar. E.g.:

| Rating | Width |
|--------|-------|
|   100% |  100% |
|    90% |   50% |
|    80% |   25% |
|    70% | 12.5% |
|    ... |  etc. |


The equation for linear scaling:

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/linear-scaling-equation.png?raw=true" width=145>

The equation for exponential scaling:

<img src="https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/exponential-scaling-equation.png?raw=true" width=215>

Note: This option only affects the scaling of the rating bar that is added to the
thumbnails. It does not affect the scaling of the rating bar shown on the video
page.

Special thanks to [Qarthak](https://github.com/Qarthak) for
[requensting this feature](https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/49).



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