// blocked.js

// Parse query parameters
const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('target');
const tabId = parseInt(params.get('tabId'));

// Go Back
document.getElementById('backBtn').addEventListener('click', () => {
  if (tabId) {
    chrome.runtime.sendMessage({ action: 'goBack', tabId });
  } else {
    window.history.back();
  }
});

// Visit Anyway
document.getElementById('visitBtn').addEventListener('click', () => {
  if (targetUrl && tabId) {
    chrome.runtime.sendMessage({ action: 'visitAnyway', target: targetUrl, tabId });
  } else if (targetUrl) {
    window.location.href = targetUrl;
  } else {
    alert('No target URL available.');
  }
});
