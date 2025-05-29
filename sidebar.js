// sidebar.js – chat UI, file-upload handler, and OpenAI call

/* ----------- DOM refs ----------- */
const form          = document.getElementById('chat-form');
const textarea      = document.getElementById('chat-input');
const chatLog       = document.getElementById('chat-log');
const uploadIcon    = document.getElementById('upload-icon');
const uploadStatus  = document.getElementById('upload-status');

/* ----------- Chat parameters ----------- */
const MODEL       = 'gpt-4o-mini';
const TEMPERATURE = 0.7;
const MAX_TOKENS  = 1024;

/* ----------- API-key helper ----------- */
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get('openai_api_key', data => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (data.openai_api_key)      return resolve(data.openai_api_key);

      const key = prompt('Enter your OpenAI API key:');
      if (!key) return reject(new Error('API key required'));

      chrome.storage.sync.set({ openai_api_key: key }, () => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        resolve(key);
      });
    });
  });
}

/* ----------- Message helpers ----------- */
function appendMessage(role, text) {
  const div = document.createElement('div');
  div.className = role === 'user' ? 'msg user' : 'msg assistant';
  div.textContent = text;
  chatLog.appendChild(div);
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
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/* ----------- PDF upload logic ----------- */
uploadIcon.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.style.display = 'none';

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    uploadStatus.textContent = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      // Store bytes as an array of numbers (simple, but ~5 MB quota per ext.)
      const byteArray = Array.from(new Uint8Array(reader.result));
      chrome.storage.local.set(
        { uploadedPdfName: file.name, uploadedPdfBytes: byteArray },
        () => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            uploadStatus.textContent = '❌ save failed';
          } else {
            console.log('PDF saved to chrome.storage.local');
          }
        }
      );
    };
    reader.readAsArrayBuffer(file);
  };

  document.body.appendChild(input); // required for Firefox; harmless in Chrome
  input.click();
  input.remove();
});

/* ----------- Form submit handler ----------- */
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
    const key   = await getApiKey();
    const reply = await callOpenAI(key, conversation);
    appendMessage('assistant', reply);
    conversation.push({ role: 'assistant', content: reply });
  } catch (err) {
    appendMessage('assistant', `⚠️ ${err.message}`);
  } finally {
    textarea.disabled = false;
    textarea.focus();
  }
});

/* ----------- Inline fallback styles (unchanged) ----------- */
const style = document.createElement('style');
style.textContent = `
  html,body       {margin:0;height:100%;display:flex;flex-direction:column;background:#fff;font-family:system-ui,sans-serif}
  #chat-header    {flex:0 0 auto;padding:8px 10px;font-weight:600;background:#f5f5f5;border-bottom:1px solid #ddd}
  #chat-log       {flex:1 1 auto;overflow-y:auto;padding:8px 10px}
  .msg            {margin:4px 0;white-space:pre-wrap;line-height:1.35}
  .msg.user       {font-weight:600}
  .msg.assistant  {color:#003366}
  #chat-toolbar   {flex:0 0 auto;height:28px;background:#ffeb3b;border-top:1px solid #ddd;display:flex;align-items:center}
  .toolbar-icon   {padding:0 8px;font-size:18px;cursor:pointer;user-select:none}
  .upload-status  {font-size:12px;color:#555;padding-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #chat-form      {flex:0 0 auto;display:flex;flex-direction:column;border-top:1px solid #ddd;padding:6px 8px;gap:6px}
  #chat-input     {width:100%;height:48px;resize:none;border:1px solid #ccc;padding:6px 8px;box-sizing:border-box}
  #chat-send      {align-self:flex-start;width:88px;min-height:32px;border:none;background:#006ee8;color:#fff;font-size:14px;font-weight:600;cursor:pointer;border-radius:4px}
  #chat-send:hover{background:#0057bf}
`;
document.head.appendChild(style);

textarea.focus();
