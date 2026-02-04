// Подключение к Socket.IO
const socket = io();

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
const fileUploadArea = document.getElementById('file-upload-area');
const attachBtn = document.getElementById('attach-btn');
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

// Переменные
let currentUsername = '';
let currentChatUser = null; // Для личных сообщений
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];
let currentPreviewFile = null;
let allUsers = [];

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loginUsernameInput.focus();
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
        currentUsername = loginUsernameInput.value.trim();
        currentUserSpan.textContent = `👤 ${currentUsername}`;
        authModal.style.display = 'none';
        mainContainer.style.display = 'flex';
        messageInput.focus();
        
        // Очищаем форму
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
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
    currentUsername = '';
    currentChatUser = null;
    authModal.style.display = 'flex';
    mainContainer.style.display = 'none';
    messagesContainer.innerHTML = '<div class="welcome-message"><i class="fas fa-heart"></i><h2>Добро пожаловать в Родню!</h2><p>Общайтесь с близкими, делитесь моментами жизни</p></div>';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginUsernameInput.focus();
});

// Кнопка "Назад в общий чат"
backToGeneralBtn.addEventListener('click', () => {
    backToGeneralChat();
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
        
        userItem.addEventListener('click', () => {
            openPrivateChat(user);
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
    updateUsersList();
    
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
    updateUsersList();
    
    // Загружаем историю общего чата
    socket.emit('load-general-messages', {});
    
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

// Прикрепление файлов
attachBtn.addEventListener('click', () => {
    fileUploadArea.classList.toggle('active');
});

fileUploadArea.addEventListener('click', () => {
    fileInput.click();
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
                const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                uploadFile(file);
                
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
    // Если это сообщение от текущего чата или от нас
    if (data.from === currentChatUser || data.to === currentChatUser) {
        displayMessage(data);
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
    
    let deleteBtn = '';
    if (isOwn) {
        deleteBtn = `<button class="delete-btn" onclick="deleteMessage('${data.id}')">Удалить</button>`;
    }
    
    const senderName = data.username || data.from;
    
    if (data.type === 'file') {
        messageDiv.classList.add('file-message');
        let captionHtml = '';
        if (data.caption) {
            captionHtml = `<div class="image-caption">"${data.caption}"</div>`;
        }
        
        messageDiv.innerHTML = `
            ${deleteBtn}
            <div class="message-header">
                <span class="username">${senderName}</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            <div class="message-content">
                <div class="file-info">
                    <i class="fas ${getFileIcon(data.mimetype)} file-icon"></i>
                    <span class="file-name">${data.originalname}</span>
                </div>
                ${getMediaPreview(data.url, data.mimetype, data.originalname)}
                ${captionHtml}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            ${deleteBtn}
            <div class="message-header">
                <span class="username">${senderName}</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            <div class="message-content">${data.message}</div>
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