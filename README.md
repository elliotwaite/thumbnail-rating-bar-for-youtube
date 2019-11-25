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

This extension also requires you to setup a YouTube Data API key. More details below.

## Setup a YouTube Data API Key

This extension now requires users to provide their own personal YouTube Data 
API Key through the extension's settings page. This is because the quota for
the extension's shared API key is currently restricted (more details available 
[here](https://github.com/elliotwaite/thumbnail-rating-bar-for-youtube/issues/17)).

To setup a free YouTube Data API key, follow these steps:

1. Create a new project.

   * Go to: https://console.developers.google.com/projectcreate
     
   * For "Project name" enter any name you want, for example "YouTube Data API Key".
   
   * For "Location" leave it as "No organization".
   
   * Then click the "CREATE" button.
   
   * This will start creating a project and you'll see a progress wheel around
     the notification icon. Once the project has finished being created,
     continue to the next step.

2. Enable the YouTube Data API v3.
   
   * Go to: https://console.cloud.google.com/apis/library/youtube.googleapis.com

   * Then Click the "ENABLE" button.
   
   * This will display a progress wheel, and then take you to a page with a 
     button that says "CREATE CREDENTIALS", but DON'T CLICK IT, instead follow
     the link in the next step.

3. Create an API Key.
   
   * Go to: https://console.cloud.google.com/apis/credentials

   * Click the "Create credentials" dropdown button, then choose "API key".

   * This will create your API key and display a dialog box. At the bottom 
     right of that dialog box, click the "RESTRICT API" button.

   * Then under the "API restrictions" section, click the "Restrict key" radio 
     button, and then below it, open the "Select APIs" dropdown menu and check
     the "YouTube Data API v3" checkbox.

   * Then click the "SAVE" button at the bottom of that page.
   
   * Then copy your listed API key (it should look something like this: 
     AIzaSyAylQ59uKlkZt2EgRPoygscGb_AHBQ5MEY).
    
     Note: If you need to access your API key in the future, it will be
     available here:
     https://console.cloud.google.com/apis/credentials

4. Paste your API key into the text field on extension's settings page.
 
   * Go to the extension's settings page, which is accessible by clicking the
     extension's icon in your browser's toolbar.
     
   * Paste your API key into the available text field.
   
   * Click the "SAVE" button.
   
   You're all set. Refresh any previously opened YouTube tabs to see the
   changes.
   
   Note: To keep your API key private, the extension only stores your API key
   locally on your computer using local storage. This can be confirmed by 
   viewing the source code.
   
![](https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/screenshot-2.jpg?raw=true&v=2)

The extension adds a rating bar to the bottom of every video's thumbnail.

![](https://raw.githubusercontent.com/elliotwaite/thumbnail-rating-bar-for-youtube/master/images/screenshot-1.jpg?raw=true)

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
