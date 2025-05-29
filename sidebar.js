// sidebar.js — chat UI plus OpenAI call with key stored in chrome.storage.sync

/* ------------------------------------------------------------------ */
/*  DOM references (IDs must exist in sidebar.html)                   */
/* ------------------------------------------------------------------ */
const form      = document.getElementById('chat-form');
const textarea  = document.getElementById('chat-input');
const chatLog   = document.getElementById('chat-log');

/* ------------------------------------------------------------------ */
/*  Chat parameters                                                   */
/* ------------------------------------------------------------------ */
const MODEL       = 'gpt-4o-mini';   // any chat-capable model
const TEMPERATURE = 0.7;
const MAX_TOKENS  = 1024;

/* ------------------------------------------------------------------ */
/*  Retrieve API key (prompt once if absent, then store)              */
/* ------------------------------------------------------------------ */
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get('openai_api_key', data => {
      if (chrome.runtime.lastError)
        return reject(chrome.runtime.lastError);

      if (data.openai_api_key) return resolve(data.openai_api_key);

      const key = prompt(
        'Enter your OpenAI API key (you can edit it later in the extension options):'
      );
      if (!key) return reject(new Error('API key is required.'));

      chrome.storage.sync.set({ openai_api_key: key }, () => {
        if (chrome.runtime.lastError)
          return reject(chrome.runtime.lastError);
        resolve(key);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Helper functions                                                  */
/* ------------------------------------------------------------------ */
function appendMessage(role, text) {
  const msg = document.createElement('div');
  msg.className = role === 'user' ? 'msg user' : 'msg assistant';
  msg.textContent = text;
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function callOpenAI(apiKey, messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/* ------------------------------------------------------------------ */
/*  Main submit handler                                               */
/* ------------------------------------------------------------------ */
const conversation = [];

form.addEventListener('submit', async e => {
  e.preventDefault();
  const prompt = textarea.value.trim();
  if (!prompt) return;

  appendMessage('user', prompt);
  conversation.push({ role: 'user', content: prompt });
  textarea.value = '';
  textarea.disabled = true;

  try {
    const apiKey = await getApiKey();
    const reply  = await callOpenAI(apiKey, conversation);
    appendMessage('assistant', reply);
    conversation.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error(err);
    appendMessage('assistant', `⚠️ ${err.message}`);
  } finally {
    textarea.disabled = false;
    textarea.focus();
  }
});

/* ------------------------------------------------------------------ */
/*  Inline fallback styles (mirror of sidebar.css)                    */
/* ------------------------------------------------------------------ */
const style = document.createElement('style');
style.textContent = `
  html,body             {margin:0;height:100%;display:flex;flex-direction:column;background:#fff;font-family:system-ui,sans-serif}
  #chat-header          {flex:0 0 auto;padding:8px 10px;font-weight:600;background:#f5f5f5;border-bottom:1px solid #ddd}
  #chat-log             {flex:1 1 auto;overflow-y:auto;padding:8px 10px}
  .msg                  {margin:4px 0;white-space:pre-wrap;line-height:1.35}
  .msg.user             {font-weight:600}
  .msg.assistant        {color:#003366}
  #chat-form            {flex:0 0 auto;display:flex;flex-direction:column;border-top:1px solid #ddd;padding:6px 8px;gap:6px}
  #chat-input           {width:100%;height:48px;resize:none;border:1px solid #ccc;padding:6px 8px;box-sizing:border-box}
  #chat-send            {align-self:flex-start;width:88px;min-height:32px;border:none;background:#006ee8;color:#fff;font-size:14px;font-weight:600;cursor:pointer;border-radius:4px}
  #chat-send:hover      {background:#0057bf}
`;
document.head.appendChild(style);

/* ------------------------------------------------------------------ */
/*  Auto-focus textarea on load                                       */
/* ------------------------------------------------------------------ */
textarea.focus();
