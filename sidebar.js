/******************************************************************
 * SIDEBAR.JS – chat UI with a compact, non-wrapping header:
 *  ▸ “AI Sidebar” title (14px)
 *  ▸ Model Selection dropdown (only multimodal models, 70px wide, 10px font)
 *  ▸ 🗑 New Chat button (11px font, tighter padding)
 *  ▸ ───────────────────────────────────────────────────────────────
 *  ▸ 📎 PDF upload (removable)
 *  ▸ 📷 Image capture (removable)
 *  ▸ Chat form below, sending to the selected model
 ******************************************************************/

/* ───────── DOM References ───────── */
const $ = (id) => document.getElementById(id);
const header       = $("chat-header");
const toolbar      = $("chat-toolbar");
const form         = $("chat-form");
const textarea     = $("chat-input");
const chatLog      = $("chat-log");
const uploadIcon   = $("upload-icon");   // 📎
const uploadStatus = $("upload-status");
const cameraIcon   = $("camera-icon");   // 📷

/* ───────── Build Compact Header Layout ───────── */
// Clear any existing header content:
header.innerHTML = "";

// Container for title + dropdown (left side):
const leftContainer = document.createElement("div");
Object.assign(leftContainer.style, {
  display:       "flex",
  alignItems:    "center",
  flex:          "1 1 auto",
  flexWrap:      "nowrap",   // prevent wrapping
  minWidth:      "0",        // allow children to shrink
});

// 1. Compact “AI Sidebar” title:
const titleSpan = document.createElement("span");
titleSpan.textContent = "AI Sidebar";
Object.assign(titleSpan.style, {
  fontSize:      "14px",
  fontWeight:    "600",
  marginRight:   "6px",       // reduced margin
  flex:          "0 1 auto",  // shrink if needed
  whiteSpace:    "nowrap",
});
leftContainer.appendChild(titleSpan);

// 2. Compact Model Selection dropdown (initially “Loading…”):
const modelSelect = document.createElement("select");
modelSelect.id = "model-select";
modelSelect.disabled = true;
Object.assign(modelSelect.style, {
  padding:       "1px 3px",
  borderRadius:  "4px",
  border:        "1px solid #ccc",
  fontSize:      "10px",
  width:         "70px",      // narrower
  flex:          "0 1 70px",
  minWidth:      "50px",      // never shrink below 50px
  whiteSpace:    "nowrap",
  marginRight:   "6px",       // small gap to New Chat
});
const loadingOption = document.createElement("option");
loadingOption.value = "";
loadingOption.textContent = "Loading...";
modelSelect.appendChild(loadingOption);
leftContainer.appendChild(modelSelect);

// Add leftContainer into header:
header.appendChild(leftContainer);

// 3. Compact New Chat button (far right):
const newBtn = document.createElement("span");
newBtn.id = "new-btn";
newBtn.textContent = "🗑 New";
Object.assign(newBtn.style, {
  fontSize:      "11px",
  background:    "#f44336",
  color:         "#fff",
  padding:       "1px 4px",   // tighter padding
  borderRadius:  "4px",
  cursor:        "pointer",
  flex:          "0 0 auto",
  whiteSpace:    "nowrap",
});
header.appendChild(newBtn);

/* ───────── Image Status Widget ───────── */
const imgStatus = document.createElement("span");
imgStatus.id = "img-status";
Object.assign(imgStatus.style, {
  fontSize:      "12px",
  color:         "#555",
  paddingLeft:   "6px",
  whiteSpace:    "nowrap",
  overflow:      "hidden",
  textOverflow:  "ellipsis",
});
toolbar.appendChild(imgStatus);

/* ───────── Global Chat State ───────── */
let currentModel = "";               // set after fetching model list
let pdfName = null, pdfText = null;  // persistent PDF context
let lastImg = null;                  // screenshot (stays until removed)
const convo = [];                    // array of chat messages

/* ───────── “New Chat” Handler ───────── */
newBtn.onclick = () => {
  convo.length = 0;
  chatLog.innerHTML = "";
  pdfName = pdfText = null;
  lastImg = null;
  uploadStatus.textContent = "";
  imgStatus.textContent = "";
  textarea.focus();
};

/* ───────── Receive “imageCaptured” from content.js ───────── */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "imageCaptured") {
    lastImg = msg.dataUrl;
    imgStatus.innerHTML = 
      `Image captured <span id="rm-img" style="cursor:pointer;color:red;padding-left:4px">✖</span>`;
    document.getElementById("rm-img").onclick = () => {
      lastImg = null;
      imgStatus.textContent = "";
      convo.push({
        role:    "system",
        name:    "image_revoke",
        content:
          "The user has removed the screenshot. Ignore that image and any information inferred from it."
      });
    };
    chrome.storage.local.set({ lastCapturedImage: lastImg });
  }
});

/* ───────── PDF Upload Handler (📎) ───────── */
uploadIcon.onclick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";
  input.style.display = "none";

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    uploadStatus.textContent = "⏳ reading…";
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        pdfName = file.name;
        pdfText = await extractPdfText(reader.result);
        uploadStatus.innerHTML =
          `${pdfName}<span id="rm-pdf" style="cursor:pointer;color:red;padding-left:6px">✖</span>`;
        document.getElementById("rm-pdf").onclick = () => {
          pdfName = pdfText = null;
          uploadStatus.textContent = "";
          const idx = convo.findIndex(
            (m) => m.role === "system" && m.name === "pdf"
          );
          if (idx !== -1) convo.splice(idx, 1);
        };
      } catch (err) {
        uploadStatus.textContent = "❌ failed";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  document.body.appendChild(input);
  input.click();
  input.remove();
};

/* ───────── Extract PDF Text (pdfjs-dist) ───────── */
async function extractPdfText(buffer) {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs || !pdfjs.getDocument) throw new Error("pdfjsLib not loaded");
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(" ") + "\n";
  }
  return fullText.trim();
}

/* ───────── Trigger Region-Capture (📷) ───────── */
cameraIcon.onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "startRegionCapture" });
    }
  });
};

/* ───────── Utility: Add a chat message to the log ───────── */
function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = role === "user" ? "msg user" : "msg assistant";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

/* ───────── Utility: Get or Prompt for API Key ───────── */
function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get("openai_api_key", (data) => {
      if (data.openai_api_key) {
        return resolve(data.openai_api_key);
      }
      const key = prompt("Enter your OpenAI API key:");
      if (!key) return reject(new Error("API key required"));
      chrome.storage.sync.set({ openai_api_key: key }, (err) => {
        if (err) return reject(err);
        resolve(key);
      });
    });
  });
}

/* ───────── Populate Models Dropdown ───────── */
async function populateModelsDropdown() {
  // Show “Loading…” placeholder:
  modelSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Loading...";
  modelSelect.appendChild(placeholder);
  modelSelect.disabled = true;

  try {
    const key = await getApiKey();
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${await response.text()}`);
    }
    const data = await response.json();
    const allIds = data.data.map((m) => m.id);

    /* Keep only multimodal text+image models:
     *  • Exclude any containing “preview”
     *  • Exclude any ending with “-YYYY-MM-DD”
     *  • Include only IDs starting with “o1”, “gpt-4o”, or containing “vision”
     */
    const filtered = allIds.filter((id) => {
      if (/preview/i.test(id)) return false;
      if (/-\d{4}-\d{2}-\d{2}$/.test(id)) return false;
      return /^(o1|gpt-4o)|vision/.test(id);
    });

    // Group by “base” and select the latest version:
    const modelMap = {};
    filtered.forEach((id) => {
      const parts = id.split("-");
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        const base = parts.slice(0, -1).join("-");
        if (!modelMap[base] || last > modelMap[base].version) {
          modelMap[base] = { id, version: last };
        }
      } else {
        const base = id;
        if (!modelMap[base]) {
          modelMap[base] = { id, version: "" };
        }
      }
    });

    let finalModels = Object.values(modelMap).map((entry) => entry.id);
    finalModels.sort();

    // Populate dropdown:
    modelSelect.innerHTML = "";
    finalModels.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      modelSelect.appendChild(opt);
    });

    // Default to first model:
    currentModel = finalModels[0] || "gpt-4o-mini";
    modelSelect.value = currentModel;
    modelSelect.disabled = false;
  } catch (err) {
    console.error("Error fetching models:", err);
    // Fallback to a small static list:
    const fallback = ["gpt-4o-mini", "gpt-4o", "o1"];
    modelSelect.innerHTML = "";
    fallback.forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id;
      modelSelect.appendChild(opt);
    });
    currentModel = fallback[0];
    modelSelect.value = currentModel;
    modelSelect.disabled = false;
  }

  modelSelect.onchange = () => {
    if (modelSelect.value) {
      currentModel = modelSelect.value;
    }
  };
}

// Populate when the script loads:
populateModelsDropdown();

/* ───────── Handle Chat Form Submissions ───────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const prompt = textarea.value.trim();
  if (!prompt) return;

  // Build user message; include image if still present:
  const userMsg = lastImg
    ? {
        role: "user",
        content: [
          { type: "text",      text: prompt },
          { type: "image_url", image_url: { url: lastImg } }
        ]
      }
    : { role: "user", content: prompt };

  addMsg("user", prompt);
  convo.push(userMsg);

  textarea.value = "";
  textarea.disabled = true;

  try {
    const key = await getApiKey();

    // Attach PDF context once if present:
    if (pdfText && !convo.some((m) => m.role === "system" && m.name === "pdf")) {
      convo.unshift({
        role:    "system",
        name:    "pdf",
        content: `Document "${pdfName}":\n\n${pdfText}`
      });
    }

    // Call OpenAI with the selected model:
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model:    currentModel,
        messages: convo,
        temperature: 0.7,
        max_tokens:  4096
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
    }
    const data   = await response.json();
    const answer = data.choices[0].message.content.trim();

    addMsg("assistant", answer);
    convo.push({ role: "assistant", content: answer });
  } catch (err) {
    addMsg("assistant", `⚠️ ${err.message}`);
  } finally {
    textarea.disabled = false;
    textarea.focus();
  }
});

/* ───────── Inline CSS Styling ───────── */
const style = document.createElement("style");
style.textContent = `
html, body {
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: system-ui, sans-serif;
}
#chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;       /* never wrap items */
  padding: 6px 8px;        /* reduced padding */
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}
#model-select {
  font-size: 10px;
  padding: 1px 3px;
  border-radius: 4px;
  border: 1px solid #ccc;
  width: 70px;
}
#chat-log {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 10px;
}
.msg {
  margin: 4px 0;
  white-space: pre-wrap;
  line-height: 1.35;
}
.msg.user { font-weight: 600; }
.msg.assistant { color: #003366; }
#chat-toolbar {
  height: 28px;
  background: #ffeb3b;
  border-top: 1px solid #ddd;
  display: flex;
  align-items: center;
  padding-left: 8px;
}
.toolbar-icon {
  padding: 0 8px;
  font-size: 18px;
  cursor: pointer;
  user-select: none;
}
#upload-status {
  font-size: 12px;
  color: #555;
  padding-left: 4px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#img-status {
  font-size: 12px;
  color: #555;
  padding-left: 6px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
#chat-form {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #ddd;
  padding: 6px 8px;
  gap: 6px;
}
#chat-input {
  width: 100%;
  height: 48px;
  resize: none;
  border: 1px solid #ccc;
  padding: 6px 8px;
  box-sizing: border-box;
}
#chat-send {
  align-self: flex-start;
  width: 88px;
  min-height: 32px;
  border: none;
  background: #006ee8;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
}
#chat-send:hover {
  background: #0057bf;
}
`;
document.head.appendChild(style);

/* ───────── Auto-focus the textarea on load ───────── */
textarea.focus();
