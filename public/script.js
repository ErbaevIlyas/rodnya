// Подключение к Socket.IO
const socket = io();

// Пинг сервера каждые 10 минут, чтобы он не засыпал на Render
setInterval(() => {
  fetch('/ping').catch(() => {});
}, 10 * 60 * 1000);

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С COOKIES И LOCALSTORAGE =====
function setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

function deleteCookie(name) {
    setCookie(name, "", -1);
}

// LocalStorage функции (более надёжно на мобильных)
function saveCredentials(username, password) {
    try {
        localStorage.setItem('rodnya_username', username);
        localStorage.setItem('rodnya_password', password);
        setCookie('username', username, 30);
        setCookie('password', password, 30);
    } catch (e) {
        console.log('Ошибка сохранения:', e);
    }
}

function getCredentials() {
    try {
        const username = localStorage.getItem('rodnya_username') || getCookie('username');
        const password = localStorage.getItem('rodnya_password') || getCookie('password');
        return { username, password };
    } catch (e) {
        return { username: null, password: null };
    }
}

function clearCredentials() {
    try {
        localStorage.removeItem('rodnya_username');
        localStorage.removeItem('rodnya_password');
        deleteCookie('username');
        deleteCookie('password');
    } catch (e) {
        console.log('Ошибка удаления:', e);
    }
}

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
const profileBtn = document.getElementById('profile-btn');
const profileModal = document.getElementById('profile-modal');
const closeProfileBtn = document.getElementById('close-profile');
const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarInput = document.getElementById('avatar-input');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const profileStatus = document.getElementById('profile-status');
const profileSaveBtn = document.getElementById('profile-save-btn');
const lightThemeBtn = document.getElementById('light-theme-btn');
const darkThemeBtn = document.getElementById('dark-theme-btn');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const photoInput = document.getElementById('photo-input');
const videoInput = document.getElementById('video-input');
const docInput = document.getElementById('doc-input');
const fileUploadArea = document.getElementById('file-upload-area');
const photoBtn = document.getElementById('photo-btn');
const videoBtn = document.getElementById('video-btn');
const fileBtn = document.getElementById('file-btn');
const attachBtn = document.getElementById('attach-btn');
const attachMenu = document.getElementById('attach-menu');
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
const imageViewerModal = document.getElementById('image-viewer-modal');
const viewerImage = document.getElementById('viewer-image');
const closeViewerBtn = document.getElementById('close-viewer');
const usersList = document.getElementById('users-list');
const chatHeader = document.getElementById('chat-header');
const backToGeneralBtn = document.getElementById('back-to-general-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

// Переменные
let currentUsername = '';
let currentChatUser = null;
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];
let currentPreviewFile = null;
let allUsers = [];
let onlineUsers = [];
let unreadMessages = {};

// Функция для звукового уведомления
function playNotificationSound() {
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
}

// Форматирование времени
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}:${minutes} ${day}.${month}.${year}`;
}

// Контекстное меню
let contextMenu = null;
let longPressTimer = null;

function showContextMenu(messageId, x, y) {
    if (contextMenu) contextMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = `<button onclick="deleteMessage('${messageId}'); hideContextMenu()">🗑 Удалить</button>`;
    
    document.body.appendChild(menu);
    contextMenu = menu;
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
    }
}

document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    
    const { username: savedUsername, password: savedPassword } = getCredentials();
    
    if (savedUsername && savedPassword) {
        currentUsername = savedUsername;
        if (socket.connected) {
            socket.emit('login', { username: savedUsername, password: savedPassword });
        } else {
            socket.once('connect', () => {
                socket.emit('login', { username: savedUsername, password: savedPassword });
            });
        }
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
        // Если это ручной вход (есть значение в input)
        if (loginUsernameInput.value.trim()) {
            currentUsername = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();
            
            // Сохраняем в localStorage и cookies
            saveCredentials(currentUsername, password);
        }
        // Если это автозаход, credentials уже установлены
        
        currentUserSpan.textContent = `👤 ${currentUsername}`;
        authModal.style.display = 'none';
        mainContainer.style.display = 'flex';
        messageInput.focus();
        
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        
        socket.emit('load-general-chat', {});
        
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

socket.on('online-users', (users) => {
    onlineUsers = users;
    onlineCount.textContent = users.length;
    updateUsersList();
});

// Профиль
profileBtn.addEventListener('click', () => {
    profileModal.classList.add('active');
    profileUsername.value = currentUsername;
    loadProfileData();
});

closeProfileBtn.addEventListener('click', () => {
    profileModal.classList.remove('active');
});

profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
        profileModal.classList.remove('active');
    }
});

changeAvatarBtn.addEventListener('click', () => {
    avatarInput.click();
});

avatarInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        uploadAvatar(e.target.files[0]);
        avatarInput.value = '';
    }
});

profileSaveBtn.addEventListener('click', () => {
    saveProfileData();
});

// Переключение темы
lightThemeBtn.addEventListener('click', () => {
    setTheme('light');
});

darkThemeBtn.addEventListener('click', () => {
    setTheme('dark');
});

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('dark-theme');
        lightThemeBtn.classList.add('active');
        darkThemeBtn.classList.remove('active');
    } else {
        document.body.classList.add('dark-theme');
        darkThemeBtn.classList.add('active');
        lightThemeBtn.classList.remove('active');
    }
    localStorage.setItem('theme', theme);
}

// Загрузка сохранённой темы при загрузке страницы
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

// Загрузка данных профиля
function loadProfileData() {
    socket.emit('get-profile', { username: currentUsername });
}

// Сохранение данных профиля
function saveProfileData() {
    const newUsername = profileUsername.value.trim();
    const status = profileStatus.value.trim();
    
    if (!newUsername) {
        alert('Имя не может быть пустым');
        return;
    }
    
    socket.emit('update-profile', { 
        oldUsername: currentUsername,
        newUsername: newUsername,
        status_text: status
    });
}

// Загрузка аватарки
async function uploadAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            socket.emit('update-avatar', {
                username: currentUsername,
                avatar_url: result.url
            });
            profileAvatar.src = result.url;
        }
    } catch (error) {
        alert('Ошибка загрузки аватарки: ' + error.message);
    }
}

// Выход
logoutBtn.addEventListener('click', () => {
    clearCredentials();
    
    currentUsername = '';
    currentChatUser = null;
    authModal.style.display = 'flex';
    mainContainer.style.display = 'none';
    messagesContainer.innerHTML = '<div class="welcome-message"><i class="fas fa-heart"></i><h2>Добро пожаловать в Родню!</h2></div>';
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
        const username = typeof user === 'string' ? user : user.username;
        if (username === currentUsername) return;
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (username === currentChatUser) userItem.classList.add('active');
        
        const statusDot = document.createElement('div');
        statusDot.className = 'user-status';
        
        const isOnline = typeof user === 'string' ? onlineUsers.includes(user) : user.isOnline;
        statusDot.style.background = isOnline ? '#4caf50' : '#ccc';
        statusDot.title = isOnline ? 'Онлайн' : 'Офлайн';
        
        const userName = document.createElement('span');
        userName.textContent = username;
        
        userItem.appendChild(statusDot);
        userItem.appendChild(userName);
        
        if (unreadMessages[username] && unreadMessages[username] > 0) {
            const badge = document.createElement('div');
            badge.className = 'unread-badge';
            badge.textContent = unreadMessages[username];
            userItem.appendChild(badge);
        }
        
        userItem.addEventListener('click', () => {
            openPrivateChat(username);
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
    
    // Получаем информацию о пользователе
    const userInfo = allUsers.find(u => u.username === username);
    let statusText = 'Был в сети';
    
    if (userInfo) {
        if (userInfo.isOnline) {
            statusText = 'Онлайн';
        } else if (userInfo.lastOnline) {
            const lastOnlineDate = new Date(userInfo.lastOnline);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastOnlineDate) / 60000);
            
            if (diffMinutes < 1) {
                statusText = 'Только что';
            } else if (diffMinutes < 60) {
                statusText = `Был в сети ${diffMinutes} мин назад`;
            } else if (diffMinutes < 1440) {
                const hours = Math.floor(diffMinutes / 60);
                statusText = `Был в сети ${hours}ч назад`;
            } else {
                const days = Math.floor(diffMinutes / 1440);
                statusText = `Был в сети ${days}д назад`;
            }
        }
    }
    
    chatTitle.innerHTML = `💬 ${username}<br><span style="font-size: 12px; color: #999;">${statusText}</span>`;
    messagesContainer.innerHTML = '';
    
    unreadMessages[username] = 0;
    updateUsersList();
    
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
        </div>
    `;
    
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('private-chat');
    });
    
    updateUsersList();
    
    socket.emit('load-general-chat', {});
    
    // Убираем фокус с input и закрываем клавиатуру
    messageInput.blur();
    document.activeElement.blur();
}

// Отправка сообщения
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    if (currentChatUser) {
        socket.emit('send-private-message', {
            recipientUsername: currentChatUser,
            message: message
        });
    } else {
        socket.emit('send-message', {
            message: message
        });
    }
    
    messageInput.value = '';
    removeWelcomeMessage();
}

// Обработчики событий
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Кнопки для фото и видео
photoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    photoInput.click();
    attachMenu.classList.remove('active');
});

videoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    videoInput.click();
    attachMenu.classList.remove('active');
});

fileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    docInput.click();
    attachMenu.classList.remove('active');
});

// Меню прикрепления
attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!attachBtn.contains(e.target) && !attachMenu.contains(e.target)) {
        attachMenu.classList.remove('active');
    }
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

docInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
        docInput.value = '';
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

// Обработка файлов
function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            showImagePreview(file);
        } else if (file.type.startsWith('video/')) {
            showVideoPreview(file);
        } else {
            // Документы загружаются сразу без предпросмотра
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

// Закрытие просмотра картинки из сообщений
closeViewerBtn.addEventListener('click', () => {
    imageViewerModal.classList.remove('active');
});

// Закрытие при клике на фон
imageViewerModal.addEventListener('click', (e) => {
    if (e.target === imageViewerModal) {
        imageViewerModal.classList.remove('active');
    }
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
                socket.emit('send-private-file', {
                    recipientUsername: currentChatUser,
                    filename: result.filename,
                    originalname: result.originalname,
                    url: result.url,
                    mimetype: result.mimetype,
                    caption: caption
                });
            } else {
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

document.addEventListener('click', (e) => {
    if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
        emojiPicker.classList.remove('active');
    }
});

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
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
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
            console.error('Ошибка микрофона:', error);
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
        padding: 20px;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        max-width: 280px;
        width: 100%;
    `;
    
    content.innerHTML = `
        <h3 style="margin-bottom: 15px; font-size: 16px; color: #333;">🎤 Голосовое сообщение</h3>
        <audio controls style="width: 100%; margin-bottom: 15px; height: 32px;">
            <source src="${url}" type="audio/webm">
        </audio>
        <div style="display: flex; gap: 10px;">
            <button id="cancel-voice" style="flex: 1; padding: 10px; background: #f0f0f0; color: #333; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">Отмена</button>
            <button id="send-voice" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">Отправить</button>
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
    if (!currentChatUser) {
        displayMessage(data);
    }
});

socket.on('load-general-messages', (loadedMessages) => {
    messagesContainer.innerHTML = '';
    loadedMessages.forEach(msg => displayMessage(msg));
    
    // Отправляем событие что сообщения прочитаны
    loadedMessages.forEach(msg => {
        if (msg.username !== currentUsername && msg.readStatus < 2) {
            socket.emit('mark-as-read', { id: msg.id });
        }
    });
});

socket.on('private-messages-loaded', (loadedMessages) => {
    messagesContainer.innerHTML = '';
    loadedMessages.forEach(msg => displayMessage(msg));
    
    // Отправляем событие что сообщения прочитаны
    loadedMessages.forEach(msg => {
        if (msg.from !== currentUsername && msg.readStatus < 2) {
            socket.emit('mark-as-read', { id: msg.id });
        }
    });
});

socket.on('private-message', (data) => {
    if (data.from === currentChatUser || data.to === currentChatUser) {
        displayMessage(data);
    } else if (data.from !== currentUsername) {
        if (!unreadMessages[data.from]) {
            unreadMessages[data.from] = 0;
        }
        unreadMessages[data.from]++;
        updateUsersList();
        
        try {
            playNotificationSound();
        } catch (e) {
            console.log('Ошибка звука:', e);
        }
        
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

socket.on('message-read', (data) => {
    const messageDiv = document.getElementById(`msg-${data.id}`);
    if (messageDiv) {
        const statusSpan = messageDiv.querySelector('.read-status');
        if (statusSpan) {
            statusSpan.textContent = '✓✓';
        }
    }
});

socket.on('profile-data', (data) => {
    if (data.avatar_url) {
        profileAvatar.src = data.avatar_url;
    } else {
        profileAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23667eea"/><circle cx="50" cy="35" r="15" fill="white"/><path d="M 20 70 Q 20 55 50 55 Q 80 55 80 70" fill="white"/></svg>';
    }
    profileStatus.value = data.status_text || '';
});

socket.on('profile-updated', (data) => {
    if (data.success) {
        if (data.newUsername && data.newUsername !== currentUsername) {
            currentUsername = data.newUsername;
            currentUserSpan.textContent = `👤 ${currentUsername}`;
            saveCredentials(currentUsername, getCookie('password'));
        }
        alert('Профиль обновлен!');
        profileModal.classList.remove('active');
    } else {
        alert('Ошибка: ' + (data.message || 'Не удалось обновить профиль'));
    }
});

// Отображение сообщения
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.id = `msg-${data.id}`;
    
    const isOwn = data.username === currentUsername || data.from === currentUsername;
    messageDiv.classList.add(isOwn ? 'own' : 'other');
    
    const senderName = data.username || data.from;
    const formattedTime = formatTime(data.timestamp);
    
    // Получаем аватарку пользователя
    const userInfo = allUsers.find(u => u.username === senderName);
    const avatarUrl = userInfo && userInfo.avatar_url ? userInfo.avatar_url : null;
    
    // Галочки для статуса прочитанности
    let checkmarks = '';
    if (isOwn) {
        if (data.readStatus === 2) {
            checkmarks = '<span class="read-status">✓✓</span>';
        } else if (data.readStatus === 1) {
            checkmarks = '<span class="read-status">✓</span>';
        } else {
            checkmarks = '<span class="read-status">✓</span>';
        }
    }
    
    // HTML для аватарки
    let avatarHtml = '';
    if (avatarUrl) {
        avatarHtml = `<img src="${avatarUrl}" alt="${senderName}" class="message-avatar">`;
    } else {
        const initials = senderName.substring(0, 1).toUpperCase();
        avatarHtml = `<div class="message-avatar-placeholder">${initials}</div>`;
    }
    
    if (data.type === 'file') {
        let captionHtml = '';
        if (data.caption) {
            captionHtml = `<div class="message-caption">"${data.caption}"</div>`;
        }
        
        messageDiv.innerHTML = `
            ${!isOwn ? avatarHtml : ''}
            <div class="message-content">
                <div class="message-header">
                    <span class="username">${senderName}</span>
                    <span class="timestamp">${formattedTime}</span>
                    ${checkmarks}
                </div>
                ${getMediaPreview(data.url, data.mimetype, data.originalname)}
                ${captionHtml}
            </div>
            ${isOwn ? avatarHtml : ''}
        `;
    } else {
        messageDiv.innerHTML = `
            ${!isOwn ? avatarHtml : ''}
            <div class="message-content">
                <div class="message-header">
                    <span class="username">${senderName}</span>
                    <span class="timestamp">${formattedTime}</span>
                    ${checkmarks}
                </div>
                <div class="message-bubble">${data.message}</div>
            </div>
            ${isOwn ? avatarHtml : ''}
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    
    // Добавляем контекстное меню
    if (isOwn) {
        // Правая кнопка мыши (ПК)
        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(data.id, e.clientX, e.clientY);
        });
        
        // Клик на мобильных (для удаления)
        if (window.innerWidth <= 899) {
            messageDiv.addEventListener('click', (e) => {
                // Не показываем меню если кликнули на ссылку или медиа
                if (e.target.tagName === 'A' || e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') {
                    return;
                }
                showContextMenu(data.id, e.clientX, e.clientY);
            });
        }
        
        // Долгое нажатие (телефон) - для копирования текста
        messageDiv.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                const touch = e.touches[0];
                showContextMenu(data.id, touch.clientX, touch.clientY);
            }, 500);
        });
        
        messageDiv.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });
        
        messageDiv.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });
    }
    
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

// Предварительный просмотр медиа
function getMediaPreview(url, mimetype, filename) {
    if (mimetype.startsWith('image/')) {
        return `<img src="${url}" alt="${filename}" class="message-image" onclick="openImageViewer('${url}')">`;
    }
    
    if (mimetype.startsWith('video/')) {
        return `<video src="${url}" controls class="message-video"></video>`;
    }
    
    if (mimetype.startsWith('audio/')) {
        return `<audio src="${url}" controls class="message-audio"></audio>`;
    }
    
    // Для документов показываем иконку и ссылку
    const getFileIcon = (name) => {
        if (name.endsWith('.pdf')) return '📄';
        if (name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
        if (name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
        if (name.endsWith('.ppt') || name.endsWith('.pptx')) return '🎯';
        if (name.endsWith('.zip') || name.endsWith('.rar')) return '📦';
        return '📎';
    };
    
    const icon = getFileIcon(filename);
    return `<a href="${url}" target="_blank" class="file-link" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f0f0; border-radius: 6px; text-decoration: none; color: #333; width: fit-content;">
        <span style="font-size: 20px;">${icon}</span>
        <span style="font-size: 13px; word-break: break-all;">${filename}</span>
    </a>`;
}

// Открытие картинки в модале
function openImageViewer(url) {
    viewerImage.src = url;
    imageViewerModal.classList.add('active');
}

// ===== AVATAR EDITOR =====
let avatarEditorState = {
    image: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

const avatarEditorModal = document.getElementById('avatar-editor-modal');
const closeEditorBtn = document.getElementById('close-editor');
const cancelEditorBtn = document.getElementById('cancel-editor');
const saveEditorBtn = document.getElementById('save-editor');
const zoomSlider = document.getElementById('zoom-slider');
const zoomValue = document.getElementById('zoom-value');
const avatarCanvas = document.getElementById('avatar-canvas');
const canvasCtx = avatarCanvas.getContext('2d');

// Открытие редактора аватарки
changeAvatarBtn.addEventListener('click', () => {
    avatarInput.click();
});

avatarInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                avatarEditorState.image = img;
                avatarEditorState.zoom = 1;
                avatarEditorState.offsetX = 0;
                avatarEditorState.offsetY = 0;
                
                zoomSlider.value = 1;
                zoomValue.textContent = '100%';
                
                avatarEditorModal.classList.add('active');
                drawAvatarPreview();
            };
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
        avatarInput.value = '';
    }
});

// Закрытие редактора
closeEditorBtn.addEventListener('click', () => {
    avatarEditorModal.classList.remove('active');
    avatarEditorState.image = null;
});

cancelEditorBtn.addEventListener('click', () => {
    avatarEditorModal.classList.remove('active');
    avatarEditorState.image = null;
});

// Зум слайдер
zoomSlider.addEventListener('input', (e) => {
    avatarEditorState.zoom = parseFloat(e.target.value);
    zoomValue.textContent = Math.round(avatarEditorState.zoom * 100) + '%';
    drawAvatarPreview();
});

// Канвас события
avatarCanvas.addEventListener('mousedown', (e) => {
    avatarEditorState.isDragging = true;
    avatarEditorState.dragStartX = e.clientX;
    avatarEditorState.dragStartY = e.clientY;
});

avatarCanvas.addEventListener('mousemove', (e) => {
    if (avatarEditorState.isDragging) {
        const deltaX = e.clientX - avatarEditorState.dragStartX;
        const deltaY = e.clientY - avatarEditorState.dragStartY;
        
        avatarEditorState.offsetX += deltaX;
        avatarEditorState.offsetY += deltaY;
        
        avatarEditorState.dragStartX = e.clientX;
        avatarEditorState.dragStartY = e.clientY;
        
        drawAvatarPreview();
    }
});

avatarCanvas.addEventListener('mouseup', () => {
    avatarEditorState.isDragging = false;
});

avatarCanvas.addEventListener('mouseleave', () => {
    avatarEditorState.isDragging = false;
});

// Сенсорные события для мобильных
avatarCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        avatarEditorState.isDragging = true;
        avatarEditorState.dragStartX = e.touches[0].clientX;
        avatarEditorState.dragStartY = e.touches[0].clientY;
    }
});

avatarCanvas.addEventListener('touchmove', (e) => {
    if (avatarEditorState.isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - avatarEditorState.dragStartX;
        const deltaY = e.touches[0].clientY - avatarEditorState.dragStartY;
        
        avatarEditorState.offsetX += deltaX;
        avatarEditorState.offsetY += deltaY;
        
        avatarEditorState.dragStartX = e.touches[0].clientX;
        avatarEditorState.dragStartY = e.touches[0].clientY;
        
        drawAvatarPreview();
    }
});

avatarCanvas.addEventListener('touchend', () => {
    avatarEditorState.isDragging = false;
});

// Рисование превью аватарки
function drawAvatarPreview() {
    if (!avatarEditorState.image) return;
    
    const canvas = avatarCanvas;
    const ctx = canvasCtx;
    const size = 300;
    
    canvas.width = size;
    canvas.height = size;
    
    // Очищаем канвас
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, size, size);
    
    // Рисуем круг для маски
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    
    // Рисуем изображение
    const img = avatarEditorState.image;
    const zoom = avatarEditorState.zoom;
    const offsetX = avatarEditorState.offsetX;
    const offsetY = avatarEditorState.offsetY;
    
    const scaledWidth = img.width * zoom;
    const scaledHeight = img.height * zoom;
    const x = (size - scaledWidth) / 2 + offsetX;
    const y = (size - scaledHeight) / 2 + offsetY;
    
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    ctx.restore();
    
    // Рисуем границу круга
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
}

// Сохранение аватарки
saveEditorBtn.addEventListener('click', async () => {
    if (!avatarEditorState.image) return;
    
    const canvas = avatarCanvas;
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' });
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                socket.emit('update-avatar', {
                    username: currentUsername,
                    avatar_url: result.url
                });
                profileAvatar.src = result.url;
                avatarEditorModal.classList.remove('active');
                avatarEditorState.image = null;
                alert('Аватарка сохранена!');
            }
        } catch (error) {
            alert('Ошибка сохранения аватарки: ' + error.message);
        }
    }, 'image/png');
});
