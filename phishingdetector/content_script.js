(async () => {
  // ===== Load Pre-trained Model =====
  async function loadModel() {
    try {
      const resp = await fetch(chrome.runtime.getURL('model.json'));
      return await resp.json();
    } catch (e) {
      console.error('Failed to load model.json', e);
      return null;
    }
  }

  // Inject CSS file (once per page)
  chrome.runtime.sendMessage({ type: 'injectCSS' });

  // ===== Feature Extraction =====
  function urlLength(url) { return url.length; }
  function countChar(url, char) {
    const regex = new RegExp(`\\${char}`, 'g');
    return (url.match(regex) || []).length;
  }
  function countRedirections(url) {
    const parts = url.split('//');
    return Math.max(0, parts.length - 2);
  }
  function extractFeatures() {
    const url = location.href;
    return [
      urlLength(url),
      countChar(url, '.'), 
      countChar(url, '-'), 
      countChar(url, '_'),
      countChar(url, '/'), 
      countChar(url, '?'), 
      countChar(url, '='),
      countChar(url, '@'), 
      countChar(url, '&'), 
      countChar(url, '!'),
      countChar(url, ' '), 
      countChar(url, '~'), 
      countChar(url, ','),
      countChar(url, '+'), 
      countChar(url, '*'), 
      countChar(url, '#'),
      countChar(url, '$'), 
      countChar(url, '%'), 
      countRedirections(url)
    ];
  }

  // ===== Logistic Regression Scoring =====
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
  function score(features, model) {
    let z = model.intercept || 0;
    for (let i = 0; i < features.length; i++) {
      const coef = model.coefs[i] || 0;
      z += coef * features[i];
    }
    return sigmoid(z);
  }

  // ===== Banner Display (CSS-based styling) =====
   function showBanner(message, type = 'phishing') {
    if (document.getElementById('phish-detector-banner')) return;

    const div = document.createElement('div');
    div.id = 'phish-detector-banner';
    div.className = type;

    const icon =
      type === 'shopping' ? '🛍️' :
      type === 'banking' ? '🏦' :
      '⚠️';

    div.innerHTML = `
      ${icon} ${message}
      <button id="pd-dismiss" class="pd-dismiss">Dismiss</button>
    `;

    document.documentElement.appendChild(div);
    document.getElementById('pd-dismiss').addEventListener('click', () => div.remove());
  }


  // ===== Safelist =====
  const safelistedDomains = [
    // 🌐 Search Engines
    'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com',
    'ask.com', 'aol.com',
    
    // 💬 Social Media / Communication
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'whatsapp.com',
    'messenger.com', 'reddit.com', 'snapchat.com', 'discord.com', 'telegram.org',
    't.me', 'weibo.com', 'line.me',
    
    // 🧠 Knowledge / Education
    'wikipedia.org', 'britannica.com', 'khanacademy.org', 'coursera.org',
    'edx.org', 'udemy.com', 'udacity.com', 'quizlet.com', 'duolingo.com',
    'medium.com', 'archive.org', 'arxiv.org',
    
    // 💻 Tech / Developer
    'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com',
    'superuser.com', 'serverfault.com', 'npmjs.com', 'python.org',
    'nodejs.org', 'react.dev', 'vuejs.org', 'angular.io', 'developer.mozilla.org',
    'openai.com', 'huggingface.co', 'tensorflow.org', 'pytorch.org',
    'jetbrains.com', 'oracle.com', 'docker.com', 'ubuntu.com', 'linux.org',
    
    // 🏢 Big Companies
    'microsoft.com', 'apple.com', 'amazon.com', 'adobe.com', 'intel.com',
    'nvidia.com', 'tesla.com', 'samsung.com', 'sony.com', 'ibm.com',
    'hp.com', 'dell.com', 'lenovo.com', 'asus.com', 'acer.com',
    
    // 💼 Professional / Productivity
    'linkedin.com', 'slack.com', 'zoom.us', 'dropbox.com', 'notion.so',
    'canva.com', 'figma.com', 'skype.com', 'trello.com', 'asana.com',
    'monday.com', 'airtable.com', 'miro.com',
    
    // 🛒 Shopping / E-commerce
    'flipkart.com', 'amazon.in', 'ebay.com', 'shopify.com', 'etsy.com',
    'walmart.com', 'bestbuy.com', 'target.com', 'aliexpress.com', 'shein.com',
    'nykaa.com', 'myntra.com', 'ajio.com', 'snapdeal.com', 'reliancedigital.in',
    
    // 💰 Banking / Finance (official trusted ones)
    'hdfcbank.com', 'icicibank.com', 'sbi.co.in', 'axisbank.com', 'yesbank.in',
    'kotak.com',,'kotak811.com','netbanking.kotak.com','kotak.bank.in','onlinesbi.sbi.bank.in','statebankofindia.com','sbi.bank.in','login.sbi.bank.in', 'bankofamerica.com', 'chase.com', 'citibank.com', 'paypal.com',
    'wise.com', 'stripe.com', 'revolut.com', 'zerodha.com', 'groww.in', 'corp.onlinesbi.sbi',
    
    // 📰 News / Media
    'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com', 'indiatimes.com',
    'ndtv.com', 'reuters.com', 'bloomberg.com', 'forbes.com', 'moneycontrol.com',
    'techcrunch.com', 'engadget.com', 'wired.com', 'timesofindia.com',
    
    // 🏛️ Government / Education India
    'gov.in', 'nic.in', 'nptel.ac.in', 'aicte-india.org', 'ugc.ac.in',
    'mit.gov.in', 'mhrd.gov.in', 'cbse.gov.in', 'jeemain.nta.ac.in',
    'nta.ac.in', 'upsc.gov.in', 'ssc.gov.in', 'rbi.org.in', 'sggs.ac.in',
    
    // 📧 Email Providers
    'gmail.com', 'outlook.com', 'proton.me', 'icloud.com', 'yandex.com',
    'zoho.com', 'mail.com', 'hotmail.com', 'live.com', 'gmx.com',
    
    // 🎥 Entertainment
    'youtube.com', 'netflix.com', 'hotstar.com', 'disneyplus.com',
    'spotify.com', 'soundcloud.com', 'twitch.tv', 'primevideo.com',
    'zee5.com', 'sonyLiv.com',
    
    // 🧭 Maps / Travel / Utility
    'maps.google.com', 'booking.com', 'makemytrip.com', 'irctc.co.in',
    'tripadvisor.com', 'airbnb.com', 'uber.com', 'ola.cabs', 'swiggy.com',
    'zomato.com', 'dominos.co.in', 'blinkit.com', 'bigbasket.com'
  ];

  function isSafeDomain(host) {
    return safelistedDomains.some(domain => host.endsWith(domain));
  }

  // ===== Shopping Site Detection =====
  const shoppingDomains = [
    'amazon.com','amazon.in','flipkart.com','ebay.com',
    'aliexpress.com','myntra.com','ajio.com','snapdeal.com',
    'shopify.com','meesho.com'
  ];
  function isShoppingSite(host) {
    return shoppingDomains.some(domain => host.endsWith(domain));
  }

    // ===== Banking Site Detection =====
  const bankingDomains = [
    // 🇮🇳 Indian Banks
    'hdfcbank.com', 'icicibank.com', 'sbi.co.in', 'axisbank.com',
    'yesbank.in', 'kotak.com', 'kotak811.com', 'rblbank.com',
    'idbibank.in', 'indusind.com', 'unionbankofindia.co.in',
    'bankofbaroda.in', 'canarabank.com', 'federalbank.co.in',
    'idfcfirstbank.com', 'bandhanbank.com', 'karurvysyabank.co.in',
    'pnbindia.in', 'onlinesbi.sbi.bank.in', 'statebankofindia.com',
    'sbi.bank.in', 'login.sbi.bank.in', 'corp.onlinesbi.sbi',

    // 🌍 International Banks
    'bankofamerica.com', 'chase.com', 'citibank.com',
    'hsbc.com', 'barclays.co.uk', 'natwest.com', 'rbs.co.uk',
    'dbs.com', 'ocbc.com', 'uobgroup.com', 'standardchartered.com',
    'revolut.com', 'wise.com', 'stripe.com', 'paypal.com'
  ];

  function isBankingSite(host) {
    return bankingDomains.some(domain => host.endsWith(domain));
  }


  // ===== Main Execution =====
  const model = await loadModel();
  if (!model) return;

  const host = location.hostname;

  // Shopping notification
  if (isShoppingSite(host)) {
    showBanner(`Trusted Shopping site detected: ${host}.`, 'shopping');
    chrome.runtime.sendMessage({ type: 'shoppingSite', payload: { host } });
  }

    // Banking notification
  if (isBankingSite(host)) {
    showBanner(`Trusted banking site detected: ${host}`, 'banking');
    chrome.runtime.sendMessage({ type: 'bankingSite', payload: { host } });
  }

  // Skip safelisted
  if (isSafeDomain(host)) return;

  const features = extractFeatures();
  const prob = score(features, model);
  const threshold = model.threshold || 0.5;

  const detection = { url: location.href, prob, threshold, features, time: Date.now() };

  chrome.storage.local.get({ events: [] }, (res) => {
    const events = res.events || [];
    events.push(detection);
    if (events.length > 200) events.splice(0, events.length - 200);
    chrome.storage.local.set({ events, lastDetection: detection });
  });

  if (prob >= threshold) {
    showBanner(`Phish Detector: this page appears suspicious (score: ${(prob * 100).toFixed(1)}%)`, 'phishing');
    chrome.runtime.sendMessage({ type: 'detection', payload: { prob } });
  } else {
    chrome.runtime.sendMessage({ type: 'clearBadge' });
  }
})();
