/**
 * Xmans Gemini AI Chatbot - Friendly Client Application
 */

// API Key dikelola di server (.env) — tidak perlu hardcode di sisi klien
const DEFAULT_API_KEY = '';

// Application State
const STATE = {
  currentChatId: null,
  chats: [],
  settings: {
    apiKey: DEFAULT_API_KEY,
    model: 'gemini-3.7-flash',
    systemInstruction: 'Kamu adalah Xmans, asisten AI yang sangat ramah, hangat, cerdas, dan selalu siap membantu. Berikan jawaban yang memuaskan, mendalam, terstruktur rapi menggunakan format Markdown (seperti poin-poin, tabel, atau contoh kode jika relevan), dan gunakan Bahasa Indonesia yang sopan serta mudah dipahami.',
    temperature: 0.7,
    theme: 'dark'
  },
  stagedImage: null, // { base64, mimeType, name }
  isGenerating: false,
  recognition: null,
  isRecording: false,
  speechSynth: window.speechSynthesis || null,
  currentUtterance: null
};

// DOM Elements
const DOM = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  testApiBtn: document.getElementById('testApiBtn'),

  apiKeyInput: document.getElementById('apiKeyInput'),
  modelSelect: document.getElementById('modelSelect'),
  systemInstructionInput: document.getElementById('systemInstructionInput'),
  temperatureInput: document.getElementById('temperatureInput'),
  tempValueDisplay: document.getElementById('tempValueDisplay'),

  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  chatList: document.getElementById('chatList'),
  clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),

  chatMessages: document.getElementById('chatMessages'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  chatTextarea: document.getElementById('chatTextarea'),
  sendBtn: document.getElementById('sendBtn'),
  micBtn: document.getElementById('micBtn'),
  attachBtn: document.getElementById('attachBtn'),
  fileInput: document.getElementById('fileInput'),
  stagedAttachment: document.getElementById('stagedAttachment'),
  stagedThumb: document.getElementById('stagedThumb'),
  stagedName: document.getElementById('stagedName'),
  removeAttachmentBtn: document.getElementById('removeAttachmentBtn'),

  currentModelBadge: document.getElementById('currentModelBadge'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  toastContainer: document.getElementById('toastContainer')
};

// Initialize Application
function initApp() {
  loadStoredSettings();
  loadStoredChats();
  setupEventListeners();
  setupSpeechRecognition();
  setupDragAndDrop();
  applyTheme(STATE.settings.theme);
  updateModelBadge();

  // If no chat exists or loaded, prepare a fresh one
  if (!STATE.currentChatId || !getChatById(STATE.currentChatId)) {
    startNewChat(false);
  } else {
    renderCurrentChat();
  }
}

// ==========================================================================
// Storage & Settings Management
// ==========================================================================
function loadStoredSettings() {
  try {
    const saved = localStorage.getItem('gemini_chat_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      STATE.settings = { ...STATE.settings, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }

  // Ensure default API key is set if empty
  if (!STATE.settings.apiKey) {
    STATE.settings.apiKey = DEFAULT_API_KEY;
  }

  // Validate model
  const validModels = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'];
  if (!validModels.includes(STATE.settings.model)) {
    STATE.settings.model = 'gemini-3.7-flash';
  }

  // Populate settings modal inputs
  if (DOM.apiKeyInput) DOM.apiKeyInput.value = STATE.settings.apiKey;
  if (DOM.modelSelect) DOM.modelSelect.value = STATE.settings.model;
  if (DOM.systemInstructionInput) DOM.systemInstructionInput.value = STATE.settings.systemInstruction || '';
  if (DOM.temperatureInput) DOM.temperatureInput.value = STATE.settings.temperature || 0.7;
  if (DOM.tempValueDisplay) DOM.tempValueDisplay.textContent = STATE.settings.temperature || 0.7;
}

function saveSettings() {
  STATE.settings.apiKey = DOM.apiKeyInput.value.trim() || DEFAULT_API_KEY;
  STATE.settings.model = DOM.modelSelect.value;
  STATE.settings.systemInstruction = DOM.systemInstructionInput.value.trim();
  STATE.settings.temperature = parseFloat(DOM.temperatureInput.value);

  localStorage.setItem('gemini_chat_settings', JSON.stringify(STATE.settings));
  updateModelBadge();
  closeModal(DOM.settingsModal);
  showToast('Pengaturan berhasil disimpan!', 'success');
}

function loadStoredChats() {
  try {
    const saved = localStorage.getItem('gemini_chat_history');
    if (saved) {
      STATE.chats = JSON.parse(saved);
    }
    const lastActiveId = localStorage.getItem('gemini_active_chat_id');
    if (lastActiveId) {
      STATE.currentChatId = lastActiveId;
    }
  } catch (e) {
    console.error('Failed to load chats:', e);
    STATE.chats = [];
  }
  renderChatHistorySidebar();
}

function persistChats() {
  try {
    localStorage.setItem('gemini_chat_history', JSON.stringify(STATE.chats));
    if (STATE.currentChatId) {
      localStorage.setItem('gemini_active_chat_id', STATE.currentChatId);
    }
  } catch (e) {
    console.error('Failed to persist chats:', e);
  }
}

function applyTheme(theme) {
  STATE.settings.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (DOM.themeToggleBtn) {
    DOM.themeToggleBtn.innerHTML = theme === 'dark'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }
  localStorage.setItem('gemini_chat_settings', JSON.stringify(STATE.settings));
}

function updateModelBadge() {
  if (!DOM.currentModelBadge) return;
  const modelNames = {
    'gemini-3.7-flash': 'Gemini 3.7 Flash',
    'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
    'gemini-3.1-pro-preview': 'Gemini 3.1 Pro'
  };
  const displayName = modelNames[STATE.settings.model] || STATE.settings.model;
  DOM.currentModelBadge.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>${displayName}</span>`;
}

// ==========================================================================
// Chat Sessions & History Management
// ==========================================================================
function startNewChat(render = true) {
  const newChat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    title: 'Percakapan Baru',
    createdAt: new Date().toISOString(),
    messages: []
  };

  STATE.chats.unshift(newChat);
  STATE.currentChatId = newChat.id;
  persistChats();
  renderChatHistorySidebar();

  if (render) {
    renderCurrentChat();
  }

  // Clear staged attachments & inputs
  clearStagedAttachment();
  if (DOM.chatTextarea) {
    DOM.chatTextarea.value = '';
    adjustTextareaHeight();
  }
  closeSidebarMobile();
}

function switchChat(chatId) {
  if (STATE.isGenerating) {
    showToast('Harap tunggu respons AI selesai.', 'info');
    return;
  }
  STATE.currentChatId = chatId;
  localStorage.setItem('gemini_active_chat_id', chatId);
  renderChatHistorySidebar();
  renderCurrentChat();
  closeSidebarMobile();
}

function deleteChat(chatId, event) {
  if (event) event.stopPropagation();

  if (!confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) return;

  STATE.chats = STATE.chats.filter(c => c.id !== chatId);
  if (STATE.currentChatId === chatId) {
    STATE.currentChatId = STATE.chats.length > 0 ? STATE.chats[0].id : null;
  }

  persistChats();
  renderChatHistorySidebar();

  if (!STATE.currentChatId) {
    startNewChat(true);
  } else {
    renderCurrentChat();
  }
  showToast('Percakapan dihapus', 'info');
}

function clearAllChats() {
  if (!confirm('Hapus seluruh riwayat percakapan? Tindakan ini tidak dapat dibatalkan.')) return;
  STATE.chats = [];
  STATE.currentChatId = null;
  persistChats();
  startNewChat(true);
  showToast('Semua percakapan berhasil dibersihkan', 'info');
}

function getChatById(id) {
  return STATE.chats.find(c => c.id === id);
}

function renderChatHistorySidebar() {
  if (!DOM.chatList) return;
  DOM.chatList.innerHTML = '';

  if (STATE.chats.length === 0) {
    DOM.chatList.innerHTML = '<li style="padding: 10px 12px; color: var(--text-muted); font-size: 13px;">Belum ada riwayat percakapan.</li>';
    return;
  }

  STATE.chats.forEach(chat => {
    const li = document.createElement('li');
    li.className = `chat-item ${chat.id === STATE.currentChatId ? 'active' : ''}`;
    li.onclick = () => switchChat(chat.id);

    li.innerHTML = `
      <div class="chat-item-title" title="${escapeHtml(chat.title)}">
        <i class="fa-regular fa-message"></i>
        <span>${escapeHtml(chat.title)}</span>
      </div>
      <div class="chat-item-actions">
        <button class="chat-action-btn" title="Hapus" onclick="deleteChat('${chat.id}', event)">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </div>
    `;
    DOM.chatList.appendChild(li);
  });
}

function renderCurrentChat() {
  if (!DOM.chatMessages) return;
  DOM.chatMessages.innerHTML = '';
  const currentChat = getChatById(STATE.currentChatId);

  if (!currentChat || currentChat.messages.length === 0) {
    if (DOM.welcomeScreen) {
      DOM.welcomeScreen.style.display = 'flex';
      DOM.chatMessages.appendChild(DOM.welcomeScreen);
    }
    return;
  }

  if (DOM.welcomeScreen) {
    DOM.welcomeScreen.style.display = 'none';
  }

  currentChat.messages.forEach(msg => {
    appendMessageToDOM(msg, false);
  });

  scrollToBottom();
}

// ==========================================================================
// Messaging & Gemini API Calls
// ==========================================================================
async function sendMessage(textFromSuggestion = null) {
  const text = textFromSuggestion || (DOM.chatTextarea ? DOM.chatTextarea.value.trim() : '');
  const currentChat = getChatById(STATE.currentChatId);

  if (!text && !STATE.stagedImage) return;
  if (STATE.isGenerating) return;

  // Ensure active chat session
  if (!currentChat) {
    startNewChat(false);
  }

  // Create User message object
  const userMessage = {
    role: 'user',
    text: text,
    image: STATE.stagedImage ? { ...STATE.stagedImage } : null,
    timestamp: new Date().toISOString()
  };

  // Update chat title if it's the first message
  const activeChat = getChatById(STATE.currentChatId);
  if (activeChat && activeChat.messages.length === 0 && text) {
    activeChat.title = text.length > 32 ? text.substring(0, 32) + '...' : text;
    renderChatHistorySidebar();
  }

  if (activeChat) {
    activeChat.messages.push(userMessage);
    persistChats();
  }

  // Render user message to DOM
  if (DOM.welcomeScreen && DOM.welcomeScreen.parentNode === DOM.chatMessages) {
    DOM.welcomeScreen.style.display = 'none';
  }
  appendMessageToDOM(userMessage, true);

  // Clear inputs & staged image
  if (DOM.chatTextarea) {
    DOM.chatTextarea.value = '';
    adjustTextareaHeight();
  }
  clearStagedAttachment();
  scrollToBottom();

  // Show typing indicator
  STATE.isGenerating = true;
  if (DOM.sendBtn) DOM.sendBtn.disabled = true;
  const typingIndicator = showTypingIndicator();

  try {
    // Prepare conversation contents for Gemini REST format
    const contents = prepareGeminiContents(activeChat ? activeChat.messages : [userMessage]);

    // Make API call (tries PHP proxy first, then direct client fallback if needed)
    const result = await requestGeminiCompletion(contents);

    // Remove typing indicator
    if (typingIndicator) typingIndicator.remove();

    // Create Bot message object
    const botMessage = {
      role: 'model',
      text: result.reply,
      model: result.model || STATE.settings.model,
      timestamp: new Date().toISOString()
    };

    if (activeChat) {
      activeChat.messages.push(botMessage);
      persistChats();
    }

    // Render Bot message
    appendMessageToDOM(botMessage, true);
    scrollToBottom();

  } catch (error) {
    console.error('Error generating AI response:', error);
    if (typingIndicator) typingIndicator.remove();

    const errorMessage = {
      role: 'model',
      text: `⚠️ **Terjadi Kesalahan:**\n${error.message || 'Gagal berkomunikasi dengan Gemini API. Silakan periksa kembali API Key dan koneksi internet Anda.'}`,
      isError: true,
      timestamp: new Date().toISOString()
    };

    if (activeChat) {
      activeChat.messages.push(errorMessage);
      persistChats();
    }
    appendMessageToDOM(errorMessage, true);
    scrollToBottom();
  } finally {
    STATE.isGenerating = false;
    if (DOM.sendBtn) DOM.sendBtn.disabled = false;
    if (DOM.chatTextarea) DOM.chatTextarea.focus();
  }
}

function prepareGeminiContents(messages) {
  // Convert chat messages to Gemini v1beta contents format
  return messages.map(msg => {
    const parts = [];

    // Multimodal image part
    if (msg.image && msg.image.base64) {
      parts.push({
        inlineData: {
          mimeType: msg.image.mimeType,
          data: msg.image.base64.split(',')[1] || msg.image.base64
        }
      });
    }

    // Text part
    if (msg.text) {
      parts.push({ text: msg.text });
    }

    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts: parts
    };
  });
}

async function requestGeminiCompletion(contents) {
  const apiKey = STATE.settings.apiKey || DEFAULT_API_KEY;
  const { model, systemInstruction, temperature } = STATE.settings;

  // 1. Try PHP Backend Proxy first (has server-side auto fallback)
  try {
    const res = await fetch('api/chat.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model,
        contents,
        systemInstruction,
        temperature
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { reply: data.reply, model: data.model || model };
    } else if (data.error && !data.error.includes('demand') && !data.error.includes('busy')) {
      throw new Error(data.error + (data.details ? ` (${data.details})` : ''));
    }
  } catch (err) {
    console.warn('Backend proxy unavailable or failed, attempting direct Gemini API call with fallback...', err);
  }

  // 2. Direct Client-side Gemini REST API Call with Auto Fallback
  const modelChain = [model];
  const fallbacks = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview'];
  fallbacks.forEach(f => {
    if (!modelChain.includes(f)) modelChain.push(f);
  });

  let lastErrMsg = '';

  for (const currentModel of modelChain) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      };

      const payload = {
        contents: contents,
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: 4096
        }
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      if (response.ok && json.candidates && json.candidates[0]?.content?.parts) {
        const text = json.candidates[0].content.parts.map(p => p.text || '').join('');
        if (text.trim()) {
          return { reply: text, model: currentModel };
        }
      }

      const err = json.error?.message || `HTTP Error ${response.status}`;
      lastErrMsg = err;

      // If high demand or overloaded, continue to next fallback model
      if (response.status === 503 || response.status === 429 || err.toLowerCase().includes('demand') || err.toLowerCase().includes('overloaded')) {
        continue;
      }
    } catch (e) {
      lastErrMsg = e.message;
    }
  }

  throw new Error(lastErrMsg || 'Semua model AI sedang sibuk. Silakan coba beberapa saat lagi.');
}

// ==========================================================================
// DOM Rendering & Formatting
// ==========================================================================
function appendMessageToDOM(msg, animate = true) {
  if (!DOM.chatMessages) return;

  const isUser = msg.role === 'user';
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${isUser ? 'user' : 'bot'}`;

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = isUser ? '<i class="fa-solid fa-user"></i>' : '<img src="assets/images/logo.png" alt="Xmans" class="bot-avatar-img">';

  // Bubble Container
  const bubbleContainer = document.createElement('div');
  bubbleContainer.className = 'message-bubble-container';

  // Attachment Preview if present
  let attachmentHtml = '';
  if (msg.image && msg.image.base64) {
    attachmentHtml = `
      <div class="message-attachment-preview">
        <img src="${msg.image.base64}" alt="Lampiran Foto" />
      </div>
    `;
  }

  // Message Bubble
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (isUser) {
    bubble.innerHTML = attachmentHtml + escapeHtml(msg.text).replace(/\n/g, '<br>');
  } else {
    const rawMarkdown = msg.text || '';
    bubble.innerHTML = renderMarkdown(rawMarkdown);
  }

  // Meta & Action Bar
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const timeStr = formatTimestamp(msg.timestamp);

  if (isUser) {
    meta.innerHTML = `<span>${timeStr}</span>`;
  } else {
    const modelTag = msg.model ? `<span>• ${msg.model}</span>` : '';
    meta.innerHTML = `
      <span>${timeStr}</span>
      ${modelTag}
      <div class="message-actions">
        <button class="msg-action-btn copy-msg-btn" title="Salin Jawaban">
          <i class="fa-regular fa-copy"></i> Salin
        </button>
        <button class="msg-action-btn speak-msg-btn" title="Dengarkan Suara">
          <i class="fa-solid fa-volume-high"></i> Baca
        </button>
      </div>
    `;

    // Attach click handlers
    const copyBtn = meta.querySelector('.copy-msg-btn');
    if (copyBtn) {
      copyBtn.onclick = () => copyToClipboard(msg.text, 'Jawaban disalin ke papan klip!');
    }

    const speakBtn = meta.querySelector('.speak-msg-btn');
    if (speakBtn) {
      speakBtn.onclick = () => toggleSpeakText(msg.text, speakBtn);
    }
  }

  bubbleContainer.appendChild(bubble);
  bubbleContainer.appendChild(meta);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubbleContainer);

  DOM.chatMessages.appendChild(wrapper);

  // Apply code block copy buttons and highlight
  enhanceCodeBlocks(bubble);
}

function showTypingIndicator() {
  if (!DOM.chatMessages) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper bot';
  wrapper.id = 'activeTypingIndicator';

  wrapper.innerHTML = `
    <div class="message-avatar">
      <img src="assets/images/logo.png" alt="Xmans" class="bot-avatar-img">
    </div>
    <div class="message-bubble-container">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  DOM.chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function renderMarkdown(rawText) {
  if (typeof marked !== 'undefined') {
    try {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      return marked.parse(rawText);
    } catch (e) {
      console.warn('Marked parse error:', e);
    }
  }
  return escapeHtml(rawText).replace(/\n/g, '<br>');
}

function enhanceCodeBlocks(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach(pre => {
    const codeEl = pre.querySelector('code');
    if (!codeEl) return;

    // Apply Highlight.js if loaded
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(codeEl);
    }

    // Check if header already exists
    if (pre.querySelector('.code-header')) return;

    // Determine language from class name
    let lang = 'Code';
    codeEl.classList.forEach(cls => {
      if (cls.startsWith('language-')) {
        lang = cls.replace('language-', '').toUpperCase();
      }
    });

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="code-copy-btn">
        <i class="fa-regular fa-copy"></i> Salin Kode
      </button>
    `;

    const copyBtn = header.querySelector('.code-copy-btn');
    copyBtn.onclick = () => {
      copyToClipboard(codeEl.innerText, 'Kode program berhasil disalin!');
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Salin Kode';
      }, 2000);
    };

    pre.insertBefore(header, codeEl);
  });
}

// ==========================================================================
// Multimodal Image Attachment & Drag-Drop/Paste Handlers
// ==========================================================================
function processImageFile(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Harap pilih file gambar (JPG, PNG, WEBP).', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 5MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    STATE.stagedImage = {
      base64: event.target.result,
      mimeType: file.type,
      name: file.name || 'clipboard_image.png'
    };

    if (DOM.stagedThumb) DOM.stagedThumb.src = event.target.result;
    if (DOM.stagedName) DOM.stagedName.textContent = file.name || 'Gambar Terlampir';
    if (DOM.stagedAttachment) DOM.stagedAttachment.classList.add('active');
    if (DOM.chatTextarea) DOM.chatTextarea.focus();
    showToast('Gambar berhasil dilampirkan!', 'info');
  };
  reader.readAsDataURL(file);
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  processImageFile(file);
}

function setupDragAndDrop() {
  const dropZone = document.querySelector('.main-chat');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.outline = '2px dashed var(--accent-primary)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.outline = 'none';
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      processImageFile(dt.files[0]);
    }
  });

  // Paste image from clipboard directly
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        processImageFile(blob);
        break;
      }
    }
  });
}

function clearStagedAttachment() {
  STATE.stagedImage = null;
  if (DOM.fileInput) DOM.fileInput.value = '';
  if (DOM.stagedAttachment) DOM.stagedAttachment.classList.remove('active');
  if (DOM.stagedThumb) DOM.stagedThumb.src = '';
  if (DOM.stagedName) DOM.stagedName.textContent = '';
}

// ==========================================================================
// Voice Input (Speech-to-Text) & Output (Text-to-Speech)
// ==========================================================================
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (DOM.micBtn) DOM.micBtn.title = 'Browser tidak mendukung Speech Recognition';
    return;
  }

  STATE.recognition = new SpeechRecognition();
  STATE.recognition.lang = 'id-ID'; // Bahasa Indonesia
  STATE.recognition.interimResults = false;
  STATE.recognition.continuous = false;

  STATE.recognition.onstart = () => {
    STATE.isRecording = true;
    if (DOM.micBtn) DOM.micBtn.classList.add('recording');
    showToast('Mendengarkan suara Anda...', 'info');
  };

  STATE.recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (DOM.chatTextarea) {
      DOM.chatTextarea.value = (DOM.chatTextarea.value + ' ' + transcript).trim();
      adjustTextareaHeight();
    }
  };

  STATE.recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopRecording();
    showToast('Gagal mengenali suara: ' + event.error, 'error');
  };

  STATE.recognition.onend = () => {
    stopRecording();
  };
}

function toggleVoiceInput() {
  if (!STATE.recognition) {
    showToast('Browser Anda tidak mendukung input suara (Speech to Text).', 'error');
    return;
  }

  if (STATE.isRecording) {
    STATE.recognition.stop();
  } else {
    try {
      STATE.recognition.start();
    } catch (e) {
      console.error(e);
    }
  }
}

function stopRecording() {
  STATE.isRecording = false;
  if (DOM.micBtn) DOM.micBtn.classList.remove('recording');
}

function toggleSpeakText(text, btnElement) {
  if (!STATE.speechSynth) {
    showToast('Browser Anda tidak mendukung pembacaan suara (Text to Speech).', 'error');
    return;
  }

  if (STATE.speechSynth.speaking) {
    STATE.speechSynth.cancel();
    btnElement.innerHTML = '<i class="fa-solid fa-volume-high"></i> Baca';
    return;
  }

  // Strip markdown formatting for cleaner audio
  const cleanText = text.replace(/[*#`_\[\]()>-]/g, '').trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'id-ID';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => {
    btnElement.innerHTML = '<i class="fa-solid fa-stop"></i> Berhenti';
  };

  utterance.onend = () => {
    btnElement.innerHTML = '<i class="fa-solid fa-volume-high"></i> Baca';
  };

  utterance.onerror = () => {
    btnElement.innerHTML = '<i class="fa-solid fa-volume-high"></i> Baca';
  };

  STATE.speechSynth.speak(utterance);
}

// ==========================================================================
// Event Listeners & Interactions
// ==========================================================================
function setupEventListeners() {
  // Theme Toggle
  if (DOM.themeToggleBtn) {
    DOM.themeToggleBtn.addEventListener('click', () => {
      const nextTheme = STATE.settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  // Settings Modal
  if (DOM.settingsBtn) {
    DOM.settingsBtn.addEventListener('click', () => openModal(DOM.settingsModal));
  }
  if (DOM.currentModelBadge) {
    DOM.currentModelBadge.addEventListener('click', () => openModal(DOM.settingsModal));
  }
  if (DOM.closeSettingsBtn) {
    DOM.closeSettingsBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
  }
  if (DOM.saveSettingsBtn) {
    DOM.saveSettingsBtn.addEventListener('click', saveSettings);
  }
  if (DOM.settingsModal) {
    DOM.settingsModal.addEventListener('click', (e) => {
      if (e.target === DOM.settingsModal) closeModal(DOM.settingsModal);
    });
  }

  // Temperature Slider Sync
  if (DOM.temperatureInput && DOM.tempValueDisplay) {
    DOM.temperatureInput.addEventListener('input', (e) => {
      DOM.tempValueDisplay.textContent = e.target.value;
    });
  }

  // Test API Key
  if (DOM.testApiBtn) {
    DOM.testApiBtn.addEventListener('click', testApiConnection);
  }

  // New Chat & Sidebar
  if (DOM.newChatBtn) {
    DOM.newChatBtn.addEventListener('click', () => startNewChat(true));
  }
  if (DOM.clearAllChatsBtn) {
    DOM.clearAllChatsBtn.addEventListener('click', clearAllChats);
  }
  if (DOM.sidebarToggleBtn) {
    DOM.sidebarToggleBtn.addEventListener('click', toggleSidebarMobile);
  }
  if (DOM.sidebarOverlay) {
    DOM.sidebarOverlay.addEventListener('click', closeSidebarMobile);
  }

  // Export Chat
  if (DOM.exportChatBtn) {
    DOM.exportChatBtn.addEventListener('click', exportCurrentChat);
  }

  // Attachment Picker
  if (DOM.attachBtn && DOM.fileInput) {
    DOM.attachBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.fileInput.addEventListener('change', handleFileUpload);
  }
  if (DOM.removeAttachmentBtn) {
    DOM.removeAttachmentBtn.addEventListener('click', clearStagedAttachment);
  }

  // Mic Button
  if (DOM.micBtn) {
    DOM.micBtn.addEventListener('click', toggleVoiceInput);
  }

  // Textarea Auto-expand & Enter to Send
  if (DOM.chatTextarea) {
    DOM.chatTextarea.addEventListener('input', adjustTextareaHeight);
    DOM.chatTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Send Button
  if (DOM.sendBtn) {
    DOM.sendBtn.addEventListener('click', () => sendMessage());
  }

  // Suggestion Cards on Welcome Screen
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        sendMessage(prompt);
      }
    });
  });
}

function adjustTextareaHeight() {
  if (!DOM.chatTextarea) return;
  DOM.chatTextarea.style.height = 'auto';
  const newHeight = Math.min(DOM.chatTextarea.scrollHeight, 160);
  DOM.chatTextarea.style.height = `${newHeight}px`;
}

function scrollToBottom() {
  if (!DOM.chatMessages) return;
  setTimeout(() => {
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  }, 50);
}

function toggleSidebarMobile() {
  if (DOM.sidebar) DOM.sidebar.classList.toggle('open');
  if (DOM.sidebarOverlay) DOM.sidebarOverlay.classList.toggle('active');
}

function closeSidebarMobile() {
  if (DOM.sidebar) DOM.sidebar.classList.remove('open');
  if (DOM.sidebarOverlay) DOM.sidebarOverlay.classList.remove('active');
}

function openModal(modal) {
  if (modal) modal.classList.add('active');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('active');
}

async function testApiConnection() {
  const testKey = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() || STATE.settings.apiKey : STATE.settings.apiKey;
  const testModel = DOM.modelSelect ? DOM.modelSelect.value : 'gemini-3.7-flash';

  if (DOM.testApiBtn) {
    DOM.testApiBtn.disabled = true;
    DOM.testApiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menguji...';
  }

  try {
    // Test through backend proxy first
    const proxyRes = await fetch('api/chat.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: testKey,
        model: testModel,
        contents: [{ role: 'user', parts: [{ text: 'Tes koneksi singkat. Balas "OK".' }] }]
      })
    });

    const proxyData = await proxyRes.json();
    if (proxyRes.ok && proxyData.success) {
      showToast(`✅ Terhubung! Model: ${proxyData.model || testModel}`, 'success');
      return;
    }

    // Direct fallback test
    if (testKey) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${encodeURIComponent(testKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': testKey
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Tes koneksi.' }] }]
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates) {
        showToast('✅ API Key valid dan terhubung!', 'success');
        return;
      }
      throw new Error(data.error?.message || 'Gagal memverifikasi API Key');
    }

    throw new Error(proxyData.error || 'Gagal menguji koneksi');
  } catch (e) {
    showToast('❌ Gagal: ' + e.message, 'error');
  } finally {
    if (DOM.testApiBtn) {
      DOM.testApiBtn.disabled = false;
      DOM.testApiBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Uji Koneksi';
    }
  }
}

function exportCurrentChat() {
  const currentChat = getChatById(STATE.currentChatId);
  if (!currentChat || currentChat.messages.length === 0) {
    showToast('Tidak ada percakapan untuk diekspor.', 'info');
    return;
  }

  let textContent = `# ${currentChat.title}\nTanggal: ${new Date(currentChat.createdAt).toLocaleString('id-ID')}\n\n`;

  currentChat.messages.forEach(msg => {
    const sender = msg.role === 'user' ? '👤 Pengguna' : '🤖 Xmans AI';
    textContent += `### ${sender} (${formatTimestamp(msg.timestamp)})\n${msg.text}\n\n---\n\n`;
  });

  const blob = new Blob([textContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'chat'}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Percakapan berhasil diunduh sebagai file Markdown!', 'success');
}

// ==========================================================================
// Utilities
// ==========================================================================
function copyToClipboard(text, successMsg = 'Tersalin!') {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(successMsg, 'success');
}

function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success'
    ? '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>'
    : type === 'error'
      ? '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i>'
      : '<i class="fa-solid fa-circle-info" style="color:#3b82f6;"></i>';

  toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
