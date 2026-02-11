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
  cacheDuration: 600000,
};

function sanitizeHexColor(str) {
  return str.replace(/[^#0-9a-zA-Z]/g, "");
}

function getCssLink(url) {
  return $("<link/>", {
    rel: "stylesheet",
    type: "text/css",
    class: "ytrb-css",
    href: chrome.runtime.getURL(url),
  });
}

function updateCss() {
  $("head").children(".ytrb-css").remove();
  if ($("#bar-height").val() !== "0") {
    $("head").append(getCssLink("css/bar.css"));

    if ($("#bar-position-top").prop("checked")) {
      $("head").append(getCssLink("css/bar-top.css"));
    } else {
      $("head").append(getCssLink("css/bar-bottom.css"));
    }

    if ($("#bar-separator").prop("checked")) {
      if ($("#bar-position-top").prop("checked")) {
        $("head").append(getCssLink("css/bar-top-separator.css"));
      } else {
        $("head").append(getCssLink("css/bar-bottom-separator.css"));
      }
    }

    if ($("#bar-tooltip").prop("checked")) {
      $("head").append(getCssLink("css/bar-tooltip.css"));
      if ($("#bar-position-top").prop("checked")) {
        $("head").append(getCssLink("css/bar-top-tooltip.css"));
      } else {
        $("head").append(getCssLink("css/bar-bottom-tooltip.css"));
      }
    }
  }
}

// Watch for changes that require updating the CSS.
$(
  "#bar-position-top, #bar-position-bottom, #bar-color-blue-gray, #bar-color-green-red, " +
    "#bar-separator, #bar-tooltip",
).change(updateCss);

// Watch bar position.
function updateSeparatorPosition() {
  $("#bar-separator-position").text(
    $("#bar-position-top").prop("checked") ? "below" : "above",
  );
}
$("#bar-position-top").on("change", updateSeparatorPosition);
$("#bar-position-bottom").on("change", updateSeparatorPosition);

// Watch bar color selector.
$("#bar-color").on("input change", function (event) {
  $("#custom-colors-options").toggle(
    $('[name="bar-color"]').val() === "custom-colors",
  );
  if ($('[name="bar-color"]').val() === "blue-gray") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      "#3095e3",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#cfcfcf",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "none",
    );
  } else if ($('[name="bar-color"]').val() === "green-red") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      "#060",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      "#c00",
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      "inset 1px 0 #fff",
    );
  } else if ($('[name="bar-color"]').val() === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      sanitizeHexColor($("#bar-likes-color").val()),
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      sanitizeHexColor($("#bar-dislikes-color").val()),
    );
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      $("#bar-colors-separator").prop("checked") ? "inset 1px 0 #fff" : "none",
    );
  }
});
$("#bar-likes-color").on("input change", function (event) {
  if ($('[name="bar-color"]').val() === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-likes-color",
      sanitizeHexColor($("#bar-likes-color").val()),
    );
  }
});
$("#bar-dislikes-color").on("input change", function (event) {
  if ($('[name="bar-color"]').val() === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-color",
      sanitizeHexColor($("#bar-dislikes-color").val()),
    );
  }
});
$("#bar-colors-separator").on("input change", function (event) {
  if ($('[name="bar-color"]').val() === "custom-colors") {
    document.documentElement.style.setProperty(
      "--ytrb-bar-dislikes-shadow",
      $("#bar-colors-separator").prop("checked") ? "inset 1px 0 #fff" : "none",
    );
  }
});

// Watch height slider.
$("#bar-height").on("input change", function (event) {
  $("#bar-height-text").text(
    $("#bar-height").val() === "0" ? "Hidden" : $("#bar-height").val() + " px",
  );

  // Make the slider bubble move with the handle.
  $("#bar-height-text").css("left", ($("#bar-height").val() / 16) * 210 + "px");

  document.documentElement.style.setProperty(
    "--ytrb-bar-height",
    $("#bar-height").val() + "px",
  );
});

// Watch opacity slider.
$("#bar-opacity").on("input change", function (event) {
  $("#bar-opacity-text").text($("#bar-opacity").val() + "%");

  // Make the slider bubble move with the handle.
  $("#bar-opacity-text").css(
    "left",
    ($("#bar-opacity").val() / 100) * 210 + "px",
  );

  // Temporarily disable the transition when updating the opacity.
  $("#thumbnail-preview ytrb-bar").css("transition", "none");
  document.documentElement.style.setProperty(
    "--ytrb-bar-opacity",
    $("#bar-opacity").val() / 100,
  );
  setTimeout(function () {
    $("#thumbnail-preview ytrb-bar").css(
      "transition",
      "opacity 0.2s ease-out 0.2s",
    );
  });
});

// Save settings.
$("#save-btn").click(function () {
  let cacheDuration = parseInt($('[name="cache-duration"]').val());
  chrome.storage.sync.set(
    {
      barPosition: $("#bar-position-top").prop("checked") ? "top" : "bottom",
      barColor: $('[name="bar-color"]').val(),
      barLikesColor: sanitizeHexColor($("#bar-likes-color").val()),
      barDislikesColor: sanitizeHexColor($("#bar-dislikes-color").val()),
      barColorsSeparator: $("#bar-colors-separator").prop("checked"),
      barHeight: Number($("#bar-height").val()),
      barOpacity: Number($("#bar-opacity").val()),
      barSeparator: $("#bar-separator").prop("checked"),
      useExponentialScaling: $("#use-exponential-scaling").prop("checked"),
      barTooltip: $("#bar-tooltip").prop("checked"),
      useOnVideoPage: $("#use-on-video-page").prop("checked"),
      showPercentage: $("#show-percentage").prop("checked"),
      cacheDuration: cacheDuration,
    },
    function () {
      // Show "Settings saved" message.
      document.querySelector("#toast").MaterialSnackbar.showSnackbar({
        message: "Settings saved. Refresh the page.",
        timeout: 2000,
      });
    },
  );
  chrome.runtime.sendMessage({
    query: "updateSettings",
    cacheDuration: cacheDuration,
  });
});

function applySettings(settings, applyColors = true) {
  $("#bar-position-" + settings.barPosition).click();

  // Note: We don't restore the custom colors and colors separator settings so
  // that users can easily restore to their custom colors if they want to.
  if (applyColors) {
    $("#bar-likes-color").val(settings.barLikesColor);
    if (settings.barLikesColor.length) {
      $("#bar-likes-color-container")
        .removeClass("is-invalid")
        .addClass("is-dirty");
    }
    $("#bar-dislikes-color").val(settings.barDislikesColor);
    if (settings.barDislikesColor.length) {
      $("#bar-dislikes-color-container")
        .removeClass("is-invalid")
        .addClass("is-dirty");
    }
    let barColorsSeparator = $("#bar-colors-separator");
    if (barColorsSeparator.prop("checked") !== settings.barColorsSeparator) {
      barColorsSeparator.click();
    }
  }

  // We set the bar color after setting the custom colors and colors
  // separator option above so that the update triggers get fired properly.
  $("#bar-color-" + settings.barColor).click();

  let barHeightSlider = $("#bar-height")[0].MaterialSlider;
  if (barHeightSlider) {
    barHeightSlider.change(settings.barHeight);
  }
  $("#bar-height").change();

  let barOpacitySlider = $("#bar-opacity")[0].MaterialSlider;
  if (barOpacitySlider) {
    barOpacitySlider.change(settings.barOpacity);
  }
  $("#bar-opacity").change();

  if ($("#bar-separator").prop("checked") !== settings.barSeparator) {
    $("#bar-separator").click();
  }
  if (
    $("#use-exponential-scaling").prop("checked") !==
    settings.useExponentialScaling
  ) {
    $("#use-exponential-scaling").click();
  }
  if ($("#bar-tooltip").prop("checked") !== settings.barTooltip) {
    $("#bar-tooltip").click();
  }
  if ($("#use-on-video-page").prop("checked") !== settings.useOnVideoPage) {
    $("#use-on-video-page").click();
  }
  if ($("#show-percentage").prop("checked") !== settings.showPercentage) {
    $("#show-percentage").click();
  }
  if (parseInt($('[name="cache-duration"]').val()) !== settings.cacheDuration) {
    $("#cache-duration-" + settings.cacheDuration.toString()).click();
  }
}

// Restore defaults.
$("#restore-defaults-btn").click(function () {
  // Note: We don't restore the custom colors and colors separator settings so
  // that users can easily restore to their custom colors if they want to.
  applySettings(DEFAULT_USER_SETTINGS, false);
});

// Load saved settings.
function restoreOptions() {
  chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function (settings) {
    // In Firefox, `settings` will be undeclared if not previously set.
    if (!settings) {
      settings = DEFAULT_USER_SETTINGS;
    }

    // Set any missing settings to their default values. Some settings may be
    // missing if loading in settings that were saved using an older version of
    // this extension.
    for (const [key, value] of Object.entries(DEFAULT_USER_SETTINGS)) {
      if (!(key in settings)) {
        settings[key] = value;
      }
    }

    applySettings(settings);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // We restore option twice in case the first time is before the Material
  // Design components are loaded. (This is a temporary workaround until a
  // better method is figured out.)
  restoreOptions();
  setTimeout(function () {
    updateCss();
  });

  // We use the delay timeout to give the MDL components time to load.
  setTimeout(function () {
    restoreOptions();
    setTimeout(function () {
      updateCss();
    });
  }, 250);
});
