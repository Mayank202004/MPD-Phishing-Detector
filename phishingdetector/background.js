// background.js
// Minimal service worker for MV3. Keeps badge/notifications working and accepts messages from content scripts.

const tempAllowlist = new Map(); // hostname → tabId map

chrome.runtime.onInstalled.addListener(() => {
  console.log('Phish Detector service worker installed');
  chrome.action.setBadgeText({ text: '' });
});

// ===== Listen for phishing detections =====
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'detection') {
    const prob = msg.payload?.prob || 0;
    const pct = Math.round(prob * 100).toString();
    const tabId = sender.tab?.id;
    const url = sender.tab?.url || sender.url || '';
    let host = '';

    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }

    //  Skip blocking if this host is temporarily allowlisted for this tab
    if (tempAllowlist.has(host) && tempAllowlist.get(host) === tabId) {
      console.log(`[Phish Detector] Allowlisted temporarily: ${host}`);
      return;
    }

    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
    chrome.action.setBadgeText({ text: pct });

    //  Block page if probability exceeds threshold
    if (prob >= 0.85 && tabId) {
      const blockedUrl =
        chrome.runtime.getURL('blocked.html') +
        '?target=' + encodeURIComponent(url) +
        '&tabId=' + tabId;
      chrome.tabs.update(tabId, { url: blockedUrl });
      return;
    }

    // Notification (below threshold)
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/48.png',
      title: 'Phish Detector',
      message: `This page looks suspicious (${pct}%)`,
      priority: 2
    });
  }

  // Shopping Site Alert
  else if (msg?.type === 'shoppingSite') {
    const site = msg.payload?.host || 'Shopping Site';
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/48.png',
      title: '🛍️ Shopping Site Detected',
      message: `You're visiting ${site}. Stay alert for fake offers or scams.`,
      priority: 1
    });
  }

  // Clear Badge
  else if (msg?.type === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
  }

  // Inject banner.css when requested
  else if (msg?.type === 'injectCSS' && sender.tab?.id) {
    chrome.scripting.insertCSS({
      target: { tabId: sender.tab.id },
      files: ['banner.css']
    }).catch(err => console.warn('Failed to inject banner.css:', err));
  }

  // Handle Block Page Actions
  else if (msg.action === 'goBack' && sender.tab?.id) {
    chrome.tabs.goBack(sender.tab.id).catch(() => {
      chrome.tabs.remove(sender.tab.id);
    });
  }

  else if (msg.action === 'visitAnyway' && msg.target && sender.tab?.id) {
    try {
      const targetHost = new URL(msg.target).hostname;
      tempAllowlist.set(targetHost, sender.tab.id); // Add to whitelist
      console.log(`[Phish Detector] Added to temporary allowlist: ${targetHost}`);
      chrome.tabs.update(sender.tab.id, { url: msg.target });
    } catch (err) {
      console.warn('Invalid visitAnyway target:', msg.target);
    }
  }
});

// Clean up allowlist when tab closes or navigates
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [host, id] of tempAllowlist.entries()) {
    if (id === tabId) {
      console.log(`[Phish Detector] Removed allowlisted site (tab closed): ${host}`);
      tempAllowlist.delete(host);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const currentHost = new URL(tab.url).hostname;
    for (const [host, id] of tempAllowlist.entries()) {
      if (id === tabId && host !== currentHost) {
        console.log(`[Phish Detector] Navigated away from ${host}, removing from allowlist`);
        tempAllowlist.delete(host);
      }
    }
  }
});
