// options.js — saves / loads the OpenAI key with chrome.storage.sync
const keyInput = document.getElementById('key');
const status   = document.getElementById('status');

/* preload stored key (if any) */
chrome.storage.sync.get('openai_api_key', data => {
  if (data.openai_api_key) keyInput.value = data.openai_api_key;
});

/* save on button click */
document.getElementById('save').addEventListener('click', () => {
  const k = keyInput.value.trim();
  if (!k) {
    status.textContent = 'Key cannot be empty.';
    status.style.color = 'red';
    return;
  }

  chrome.storage.sync.set({ openai_api_key: k }, () => {
    if (chrome.runtime.lastError) {
      status.textContent = `Error: ${chrome.runtime.lastError.message}`;
      status.style.color = 'red';
    } else {
      status.textContent = '✔️ Key saved';
      status.style.color = 'green';
      setTimeout(() => (status.textContent = ''), 2000);
    }
  });
});
