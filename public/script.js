// Подключение к Socket.IO
const socket = io();

// Пинг сервера каждые 10 минут, чтобы он не засыпал на Render
setInterval(() => {
  fetch('/ping').catch(() => {});
}, 10 * 60 * 1000);

// Элементы DOM - Авторизация
const authModal = document.getElementById('auth-modal');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const registerPasswordConfirmInput = document.getElementById('register-password-confirm');
const registerBtn = document.getElementById('register-btn');

// Элементы DOM - Главное приложение
const mainContainer = document.getElementById('main-container');
const currentUserSpan = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const photoInput = document.getElementById('photo-input');
const videoInput = document.getElementById('video-input');
const fileUploadArea = document.getElementById('file-upload-area');
const photoBtn = document.getElementById('photo-btn');
const videoBtn = document.getElementById('video-btn');
const emojiBtn = document.getElementById('emoji-btn');
const voiceBtn = document.getElementById('voice-btn');
const emojiPicker = document.getElementById('emoji-picker');
const onlineCount = document.getElementById('online-count');
const imagePreviewModal = document.getElementById('image-preview-modal');
const previewImage = document.getElementById('preview-image');
const imageCaptionInput = document.getElementById('image-caption');
const sendPreviewBtn = document.getElementById('send-preview');
const cancelPreviewBtn = document.getElementById('cancel-preview');
const closePreviewBtn = document.getElementById('close-preview');
const usersList = document.getElementById('users-list');
const chatHeader = document.getElementById('chat-header');
const backToGeneralBtn = document.getElementById('back-to-general-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

// Переменные
let currentUsername = '';
let currentChatUser = null; // Для личных сообщений
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];
let currentPreviewFile = null;
let allUsers = [];
let unreadMessages = {}; // {username: count}
let replyToMessage = null; // Для reply функционала
let allMessages = {}; // Кеш всех сообщений для reply

// Функция для звукового уведомления
function playNotificationSound() {
    // Создаем простой звук через Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем есть ли сохраненная сессия
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
        // Устанавливаем currentUsername сразу
        currentUsername = savedUsername;
        // Автоматически входим
        socket.emit('login', { username: savedUsername, password: savedPassword });
    } else {
        loginUsernameInput.focus();
    }
});

// Переключение между формами
function toggleAuthForm() {
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
    
    if (loginForm.style.display === 'block') {
        loginUsernameInput.focus();
    } else {
        registerUsernameInput.focus();
    }
}

// Регистрация
registerBtn.addEventListener('click', () => {
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const passwordConfirm = registerPasswordConfirmInput.value.trim();
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    if (password !== passwordConfirm) {
        alert('Пароли не совпадают');
        return;
    }
    
    if (password.length < 3) {
        alert('Пароль должен быть минимум 3 символа');
        return;
    }
    
    socket.emit('register', { username, password });
});

// Вход
loginBtn.addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    socket.emit('login', { username, password });
});

// Обработчики Enter
loginUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginPasswordInput.focus();
});

loginPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

registerUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerPasswordInput.focus();
});

registerPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerPasswordConfirmInput.focus();
});

registerPasswordConfirmInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerBtn.click();
});

// Socket события - Авторизация
socket.on('register-response', (data) => {
    if (data.success) {
        alert('Регистрация успешна! Теперь войдите');
        toggleAuthForm();
        registerUsernameInput.value = '';
        registerPasswordInput.value = '';
        registerPasswordConfirmInput.value = '';
    } else {
        alert('Ошибка: ' + data.message);
    }
});

socket.on('login-response', (data) => {
    if (data.success) {
        // Сохраняем учетные данные при успешном входе
        currentUsername = loginUsernameInput.value.trim() || currentUsername;
        const password = loginPasswordInput.value.trim();
        
        localStorage.setItem('username', currentUsername);
        localStorage.setItem('password', password);
        
        currentUserSpan.textContent = `👤 ${currentUsername}`;
        authModal.style.display = 'none';
        mainContainer.style.display = 'flex';
        messageInput.focus();
        
        // Очищаем форму
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        
        // Запрашиваем разрешение на уведомления
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    } else {
        alert('Ошибка: ' + data.message);
    }
});

socket.on('users-list', (users) => {
    allUsers = users;
    updateUsersList();
});

socket.on('online-users', (onlineUsers) => {
    onlineCount.textContent = onlineUsers.length;
    updateUsersList();
});

// Выход
logoutBtn.addEventListener('click', () => {
    // Удаляем сохраненные данные
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    
    currentUsername = '';
    currentChatUser = null;
    authModal.style.display = 'flex';
    mainContainer.style.display = 'none';
    messagesContainer.innerHTML = '<div class="welcome-message"><i class="fas fa-heart"></i><h2>Добро пожаловать в Родню!</h2><p>Общайтесь с близкими, делитесь моментами жизни</p></div>';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginUsernameInput.value = '';
    loginPasswordInput.value = '';
    loginUsernameInput.focus();
});

// Кнопка "Назад в общий чат"
backToGeneralBtn.addEventListener('click', () => {
    backToGeneralChat();
});

// Кнопка открытия/закрытия боковой панели на мобильных
toggleSidebarBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
});

// Обновление списка пользователей
function updateUsersList() {
    usersList.innerHTML = '';
    
    allUsers.forEach(user => {
        if (user === currentUsername) return; // Не показываем себя
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (user === currentChatUser) userItem.classList.add('active');
        
        const statusDot = document.createElement('div');
        statusDot.className = 'user-status';
        
        const userName = document.createElement('span');
        userName.textContent = user;
        
        userItem.appendChild(statusDot);
        userItem.appendChild(userName);
        
        // Добавляем бейдж непрочитанных сообщений
        if (unreadMessages[user] && unreadMessages[user] > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = unreadMessages[user];
            userItem.appendChild(badge);
        }
        
        userItem.addEventListener('click', () => {
            openPrivateChat(user);
            // Закрываем боковую панель на мобильных
            const sidebar = document.querySelector('.sidebar');
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
        
        usersList.appendChild(userItem);
    });
}

// Открытие приватного чата
function openPrivateChat(username) {
    currentChatUser = username;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    
    backBtn.style.display = 'flex';
    chatTitle.textContent = `💬 ${username}`;
    messagesContainer.innerHTML = '';
    
    // Очищаем непрочитанные сообщения
    unreadMessages[username] = 0;
    updateUsersList();
    
    // Подсвечиваем текущего пользователя
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('private-chat');
    });
    const userItem = Array.from(document.querySelectorAll('.user-item')).find(item => 
        item.textContent.includes(username)
    );
    if (userItem) {
        userItem.classList.add('private-chat');
    }
    
    // Загружаем историю сообщений
    socket.emit('load-private-messages', { username: username });
    
    messageInput.focus();
}

// Возврат в общий чат
function backToGeneralChat() {
    currentChatUser = null;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    
    backBtn.style.display = 'none';
    chatTitle.textContent = 'Общий чат';
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <i class="fas fa-heart"></i>
            <h2>Добро пожаловать в Родню!</h2>
            <p>Общайтесь с близкими, делитесь моментами жизни</p>
        </div>
    `;
    
    // Убираем подсветку со всех пользователей
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('private-chat');
    });
    
    updateUsersList();
    
    // Запрашиваем историю общего чата у сервера
    socket.emit('load-general-chat', {});
    
    messageInput.focus();
}

// Отправка сообщения
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message) {
        if (currentChatUser) {
            // Приватное сообщение
            socket.emit('send-private-message', {
                recipientUsername: currentChatUser,
                message: message
            });
        } else {
            // Общий чат
            socket.emit('send-message', {
                message: message
            });
        }
        
        messageInput.value = '';
        removeWelcomeMessage();
    }
}

// Обработчики событий
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Кнопки для фото и видео
photoBtn.addEventListener('click', () => {
    photoInput.click();
});

videoBtn.addEventListener('click', () => {
    videoInput.click();
});

// Обработчики input файлов
photoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
        photoInput.value = '';
    }
});

videoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
        videoInput.value = '';
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
        fileInput.value = '';
    }
});

// Drag & Drop
fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.style.background = '#e3f2fd';
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.style.background = '#f8f9fa';
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.style.background = '#f8f9fa';
    
    const files = e.dataTransfer.files;
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Обработка файлов
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            showImagePreview(file);
        } else if (file.type.startsWith('video/')) {
            showVideoPreview(file);
        } else {
            uploadFile(file);
        }
    });
    fileUploadArea.classList.remove('active');
}

// Предпросмотр изображения
function showImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        currentPreviewFile = file;
        previewImage.src = e.target.result;
        imageCaptionInput.value = '';
        imagePreviewModal.classList.add('active');
    };
    
    reader.readAsDataURL(file);
}

// Предпросмотр видео
function showVideoPreview(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        currentPreviewFile = file;
        previewImage.src = e.target.result;
        previewImage.style.display = 'none';
        
        // Создаем видео элемент
        const videoElement = document.createElement('video');
        videoElement.src = e.target.result;
        videoElement.style.maxWidth = '100%';
        videoElement.style.maxHeight = '60vh';
        videoElement.style.borderRadius = '10px';
        videoElement.style.marginBottom = '1rem';
        videoElement.controls = true;
        
        const previewContent = document.querySelector('.preview-content');
        const existingVideo = previewContent.querySelector('video');
        if (existingVideo) existingVideo.remove();
        
        previewContent.insertBefore(videoElement, previewContent.querySelector('.preview-controls'));
        
        imageCaptionInput.value = '';
        imagePreviewModal.classList.add('active');
    };
    
    reader.readAsDataURL(file);
}

// Закрытие предпросмотра
closePreviewBtn.addEventListener('click', () => {
    imagePreviewModal.classList.remove('active');
    currentPreviewFile = null;
});

cancelPreviewBtn.addEventListener('click', () => {
    imagePreviewModal.classList.remove('active');
    currentPreviewFile = null;
});

// Отправка изображения с подписью
sendPreviewBtn.addEventListener('click', () => {
    if (currentPreviewFile) {
        uploadFile(currentPreviewFile, imageCaptionInput.value.trim());
        imagePreviewModal.classList.remove('active');
        currentPreviewFile = null;
    }
});

// Загрузка файла
async function uploadFile(file, caption = '') {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (currentChatUser) {
                // Приватный файл
                socket.emit('send-private-file', {
                    recipientUsername: currentChatUser,
                    filename: result.filename,
                    originalname: result.originalname,
                    url: result.url,
                    mimetype: result.mimetype,
                    caption: caption
                });
            } else {
                // Файл в общий чат
                socket.emit('send-file', {
                    filename: result.filename,
                    originalname: result.originalname,
                    url: result.url,
                    mimetype: result.mimetype,
                    caption: caption
                });
            }
            
            removeWelcomeMessage();
        } else {
            alert('Ошибка загрузки файла: ' + result.error);
        }
    } catch (error) {
        alert('Ошибка загрузки файла: ' + error.message);
    }
}

// Эмодзи
emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('active');
});

// Закрытие эмодзи при клике вне
document.addEventListener('click', (e) => {
    if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
        emojiPicker.classList.remove('active');
    }
});

// Выбор эмодзи
document.querySelectorAll('.emoji').forEach(emoji => {
    emoji.addEventListener('click', () => {
        messageInput.value += emoji.textContent;
        messageInput.focus();
        emojiPicker.classList.remove('active');
    });
});

// Голосовые сообщения
let currentVoiceBlob = null;

voiceBtn.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                currentVoiceBlob = blob;
                showVoicePreview(blob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            voiceBtn.classList.add('active');
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            
        } catch (error) {
            alert('Ошибка доступа к микрофону: ' + error.message);
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        voiceBtn.classList.remove('active');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
}

// Превью голосового сообщения
function showVoicePreview(blob) {
    const url = URL.createObjectURL(blob);
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 2rem;
        border-radius: 15px;
        text-align: center;
        max-width: 300px;
    `;
    
    content.innerHTML = `
        <h3>Голосовое сообщение</h3>
        <audio controls style="width: 100%; margin: 1rem 0;">
            <source src="${url}" type="audio/webm">
        </audio>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button id="cancel-voice" style="flex: 1; padding: 0.75rem; background: #6c757d; color: white; border: none; border-radius: 10px; cursor: pointer;">Отмена</button>
            <button id="send-voice" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 10px; cursor: pointer;">Отправить</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    document.getElementById('cancel-voice').onclick = () => {
        modal.remove();
        currentVoiceBlob = null;
    };
    
    document.getElementById('send-voice').onclick = () => {
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        uploadFile(file);
        modal.remove();
        currentVoiceBlob = null;
    };
}

// Socket события - Сообщения
socket.on('new-message', (data) => {
    if (!currentChatUser) { // Показываем только если в общем чате
        displayMessage(data);
    }
});

socket.on('load-general-messages', (loadedMessages) => {
    messagesContainer.innerHTML = '';
    loadedMessages.forEach(msg => displayMessage(msg));
});

socket.on('private-messages-loaded', (loadedMessages) => {
    messagesContainer.innerHTML = '';
    loadedMessages.forEach(msg => displayMessage(msg));
});

socket.on('private-message', (data) => {
    console.log('Получено приватное сообщение:', data);
    console.log('currentChatUser:', currentChatUser);
    console.log('currentUsername:', currentUsername);
    
    // Если это сообщение от текущего чата или от нас
    if (data.from === currentChatUser || data.to === currentChatUser) {
        console.log('Показываем сообщение в чате');
        displayMessage(data);
    } else if (data.from !== currentUsername) {
        console.log('Входящее сообщение, добавляем в непрочитанные');
        // Если это входящее сообщение от другого пользователя
        // Увеличиваем счетчик непрочитанных
        if (!unreadMessages[data.from]) {
            unreadMessages[data.from] = 0;
        }
        unreadMessages[data.from]++;
        console.log('Непрочитанные:', unreadMessages);
        updateUsersList();
        
        // Воспроизводим звук
        try {
            playNotificationSound();
        } catch (e) {
            console.log('Ошибка звука:', e);
        }
        
        // Показываем уведомление браузера
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Сообщение от ${data.from}`, {
                body: data.message || 'Отправил файл',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">👥</text></svg>'
            });
        }
    }
});

socket.on('message-deleted', (data) => {
    const messageDiv = document.getElementById(`msg-${data.id}`);
    if (messageDiv) {
        messageDiv.remove();
    }
});

// Отображение сообщения
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.id = `msg-${data.id}`;
    
    // Определяем свое ли это сообщение
    const isOwn = data.username === currentUsername || data.from === currentUsername;
    messageDiv.classList.add(isOwn ? 'own' : 'other');
    
    // Сохраняем сообщение в кеш для reply
    allMessages[data.id] = data;
    
    let deleteBtn = '';
    if (isOwn) {
        deleteBtn = `<button class="delete-btn" onclick="deleteMessage('${data.id}')">Удалить</button>`;
    }
    
    const senderName = data.username || data.from;
    
    // Галочки для приватных сообщений
    let readStatus = '';
    if (isOwn && !currentChatUser) {
        // Только в общем чате показываем галочки
        readStatus = data.isRead ? '✓✓' : '✓';
    }
    
    // Reply блок
    let replyBlock = '';
    if (data.replyToId && allMessages[data.replyToId]) {
        const repliedMsg = allMessages[data.replyToId];
        const repliedSender = repliedMsg.username || repliedMsg.from;
        replyBlock = `<div class="reply-block">↳ <strong>${repliedSender}:</strong> ${repliedMsg.message?.substring(0, 50) || 'Файл'}</div>`;
    }
    
    if (data.type === 'file') {
        messageDiv.classList.add('file-message');
        let captionHtml = '';
        if (data.caption) {
            captionHtml = `<div class="message-caption">"${data.caption}"</div>`;
        }
        
        messageDiv.innerHTML = `
            ${deleteBtn}
            <div class="message-header">
                <span class="username clickable" onclick="openChatWithUser('${senderName}')">${senderName}</span>
                <span class="timestamp">${data.timestamp}</span>
                <span class="read-status">${readStatus}</span>
            </div>
            ${replyBlock}
            <div class="message-content">
                ${getMediaPreview(data.url, data.mimetype, data.originalname)}
                ${captionHtml}
            </div>
            <button class="reply-btn" onclick="setReplyTo('${data.id}', '${senderName}')">Ответить</button>
        `;
    } else {
        messageDiv.innerHTML = `
            ${deleteBtn}
            <div class="message-header">
                <span class="username clickable" onclick="openChatWithUser('${senderName}')">${senderName}</span>
                <span class="timestamp">${data.timestamp}</span>
                <span class="read-status">${readStatus}</span>
            </div>
            ${replyBlock}
            <div class="message-content">${data.message}</div>
            <button class="reply-btn" onclick="setReplyTo('${data.id}', '${senderName}')">Ответить</button>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Удаление сообщения
function deleteMessage(messageId) {
    if (confirm('Удалить сообщение?')) {
        socket.emit('delete-message', { id: messageId });
        const messageDiv = document.getElementById(`msg-${messageId}`);
        if (messageDiv) {
            messageDiv.remove();
        }
    }
}

// Удаление приветственного сообщения
function removeWelcomeMessage() {
    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

// Получение иконки файла
function getFileIcon(mimetype) {
    if (mimetype.startsWith('image/')) return 'fa-image';
    if (mimetype.startsWith('video/')) return 'fa-video';
    if (mimetype.startsWith('audio/')) return 'fa-music';
    return 'fa-file';
}

// Предварительный просмотр медиа
function getMediaPreview(url, mimetype, filename) {
    if (mimetype.startsWith('image/')) {
        return `<img src="${url}" alt="${filename}" class="media-preview" onclick="window.open('${url}', '_blank')">`;
    }
    
    if (mimetype.startsWith('video/')) {
        return `<video src="${url}" controls class="media-preview"></video>`;
    }
    
    if (mimetype.startsWith('audio/')) {
        return `<audio src="${url}" controls style="width: 100%; margin-top: 0.5rem;"></audio>`;
    }
    
    return `<a href="${url}" target="_blank" class="file-link">Скачать файл</a>`;
}


// Reply функционал
function setReplyTo(messageId, senderName) {
    replyToMessage = messageId;
    const msg = allMessages[messageId];
    const preview = msg.message?.substring(0, 50) || 'Файл';
    
    const replyIndicator = document.getElementById('reply-indicator') || createReplyIndicator();
    replyIndicator.innerHTML = `↳ Ответ на <strong>${senderName}:</strong> ${preview} <button onclick="cancelReply()" style="margin-left: 10px;">✕</button>`;
    replyIndicator.style.display = 'block';
    messageInput.focus();
}

function cancelReply() {
    replyToMessage = null;
    const replyIndicator = document.getElementById('reply-indicator');
    if (replyIndicator) {
        replyIndicator.style.display = 'none';
    }
}

function createReplyIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'reply-indicator';
    indicator.style.cssText = 'padding: 8px 12px; background: #f0f0f0; border-left: 3px solid #667eea; margin: 8px 12px 0; font-size: 14px; display: none;';
    const inputContainer = document.querySelector('.message-input-container');
    inputContainer.insertBefore(indicator, inputContainer.firstChild);
    return indicator;
}

// Открытие чата с пользователем по клику на имя
function openChatWithUser(username) {
    if (username === currentUsername) return;
    if (currentChatUser === username) return;
    
    openPrivateChat(username);
    
    // Закрываем боковую панель на мобильных
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
    }
}

// Обновление функции sendMessage для отправки reply
const originalSendMessage = sendMessage;
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    if (currentChatUser) {
        socket.emit('send-private-message', {
            recipientUsername: currentChatUser,
            message: message,
            replyToId: replyToMessage
        });
    } else {
        socket.emit('send-message', {
            message: message,
            replyToId: replyToMessage
        });
    }
    
    messageInput.value = '';
    cancelReply();
    removeWelcomeMessage();
}
