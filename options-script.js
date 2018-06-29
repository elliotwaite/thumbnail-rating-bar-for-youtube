const LIKES_BLUE = '3095e3'
const DISLIKES_GRAY = 'ccc'

// Save settings when the "Save" button is clicked.
$('#save-btn').click(function() {
  let barColorStyle = $("input[name='barColorStyle']:checked").val();
  chrome.storage.sync.set({
    barColorStyle: barColorStyle,
    likesColor: '',
    dislikesColor: ''
  }, function() {
    // Show "Settings saved" message.
    document.querySelector('#demo-toast-example').MaterialSnackbar
      .showSnackbar({message: 'Settings saved. Refresh the page.', timeout: 2000});
  });
})

// Restore saved settings.
function restoreOptions() {
  chrome.storage.sync.get({
    barColorStyle: 'blueGray',
    likesColor: LIKES_BLUE,
    dislikesColor: DISLIKES_GRAY
  }, function(settings) {
    $("input[name='barColorStyle'][value='" + settings.barColorStyle +"']")
      .click();
  });
}
document.addEventListener('DOMContentLoaded', restoreOptions);
