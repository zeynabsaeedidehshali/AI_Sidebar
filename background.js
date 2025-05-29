// background.js

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'askLLM') {
    console.log('[🛰 askLLM] prompt:', msg.prompt);
    fetchGemini(msg.prompt)
      .then(answer => {
        console.log('[✅ Gemini answer]', answer);
        sendResponse(answer);
      })
      .catch(err => {
        console.error('[❌ fetchGemini error]', err);
        sendResponse(`🚨 ${err.message}`);
      });
    return true;  // keep channel open for async sendResponse
  }
});

async function fetchGemini(prompt) {
  // Retrieve Gemini API key & model
  const { ggApiKey, ggModel } = await chrome.storage.sync.get(['ggApiKey', 'ggModel']);
  if (!ggApiKey) throw new Error('No Gemini API key set');
  if (!ggModel) throw new Error('No Gemini model set');

  const base = 'https://generativelanguage.googleapis.com/v1beta/models';
  const url  = `${base}/${ggModel}:generateContent?key=${ggApiKey}`;

  // Call the Gemini generateContent endpoint
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [ { parts: [ { text: prompt } ] } ]
    })
  });

  // Handle HTTP errors
  if (!res.ok) {
    const errText = await res.text();
    console.error(`HTTP ${res.status}:`, errText);
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  // Parse the JSON response
  const json = await res.json();
  console.log('[raw Gemini response]', json);

  // Extract the generated text from the Content object
  let candidateText = '';
  if (Array.isArray(json.candidates) && json.candidates.length > 0) {
    const contentObj = json.candidates[0].content;
    if (contentObj && Array.isArray(contentObj.parts)) {
      candidateText = contentObj.parts.map(part => part.text || '').join('');
    } else if (typeof contentObj.text === 'string') {
      candidateText = contentObj.text;
    } else {
      // Fallback: stringify the entire content object
      candidateText = JSON.stringify(contentObj);
    }
  } else {
    throw new Error('No candidates returned');
  }

  return candidateText.trim();
}
