function renderLast(d) {
  const status = document.getElementById('status');
  if (!d) {
    status.textContent = 'No detections yet in this session.';
    status.style.background = '#e5e7eb';
    return;
  }

  const pct = (d.prob * 100).toFixed(1);
  const isPhish = d.prob >= d.threshold;
  const color = isPhish ? '#fee2e2' : '#dcfce7';
  const verdict = isPhish ? '⚠️ Suspicious Site Detected' : '✅ Safe Website';

  status.style.background = color;
  status.innerHTML = `
    <strong>${verdict}</strong><br>
    <small>${d.url}</small><br>
    Confidence: <b>${pct}%</b> (Threshold: ${(d.threshold * 100).toFixed(1)}%)
  `;
}

function renderEvents(events) {
  const ul = document.getElementById('events');
  ul.innerHTML = '';

  for (const e of (events || []).slice().reverse().slice(0, 50)) {
    const li = document.createElement('li');
    const d = new Date(e.time);
    const pct = (e.prob * 100).toFixed(1);
    const isPhish = e.prob >= e.threshold;
    const color = isPhish ? '#b91c1c' : '#047857';
    const verdict = isPhish ? 'Suspicious' : 'Safe';

    li.innerHTML = `
      <strong style="color:${color};">${verdict} (${pct}%)</strong><br>
      <div>${e.url}</div>
      <small>${d.toLocaleString()}</small>
    `;
    ul.appendChild(li);
  }

  if (!events.length) {
    ul.innerHTML = '<li><small>No previous detections found.</small></li>';
  }
}

document.getElementById('show-events').addEventListener('click', async () => {
  const res = await new Promise(r => chrome.storage.local.get({ events: [] }, r));
  renderEvents(res.events || []);
});

chrome.storage.local.get({ lastDetection: null, events: [] }, (res) => {
  renderLast(res.lastDetection);
  renderEvents(res.events);
});
