// background.js — handles screenshot requests from content.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  /* Called by sidebar.js → content.js → here */
  if (msg.type === "captureRegionRequest") {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({
        success: true,
        screenshotDataUrl: dataUrl,
        rect: msg.rect          // echo rectangle so content.js can crop
      });
    });
    return true;  // keep the message channel open for async reply
  }

});
