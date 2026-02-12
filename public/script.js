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
const notificationPermissionBanner = document.getElementById('notification-permission-banner');
const allowNotificationsBtn = document.getElementById('allow-notifications-btn');
const dismissNotificationsBtn = document.getElementById('dismiss-notifications-btn');
const callBtn = document.getElementById('call-btn');

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

// WebRTC переменные
let localStream = null;
let peerConnection = null;
let remoteAudio = null;
let callStartTime = null;
let callDurationInterval = null;
let isMuted = false;

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
        authModal.style.display = 'none';
        mainContainer.style.display = 'flex';
        if (socket.connected) {
            socket.emit('login', { username: savedUsername, password: savedPassword });
        } else {
            socket.once('connect', () => {
                socket.emit('login', { username: savedUsername, password: savedPassword });
            });
        }
    } else {
        authModal.style.display = 'flex';
        mainContainer.style.display = 'none';
        loginUsernameInput.focus();
    }
    if ('serviceWorker' in navigator && 'Notification' in window) {
        if (Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    console.log('✅ Push notifications разрешены');
                    subscribeToPushNotifications();
                }
            });
        } else if (Notification.permission === 'granted') {
            subscribeToPushNotifications();
        }
    }
});

function toggleAuthForm() {
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
    if (loginForm.style.display === 'block') {
        loginUsernameInput.focus();
    } else {
        registerUsernameInput.focus();
    }
}

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

loginBtn.addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    socket.emit('login', { username, password });
});

loginUsernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginPasswordInput.focus(); });
loginPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loginBtn.click(); });
registerUsernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerPasswordInput.focus(); });
registerPasswordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerPasswordConfirmInput.focus(); });
registerPasswordConfirmInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerBtn.click(); });

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
        if (loginUsernameInput.value.trim()) {
            currentUsername = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();
            saveCredentials(currentUsername, password);
        }
        currentUserSpan.textContent = `👤 ${currentUsername}`;
        authModal.style.display = 'none';
        mainContainer.style.display = 'flex';
        messageInput.focus();
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        socket.emit('load-general-chat', {});
        if ('Notification' in window && Notification.permission === 'default') {
            notificationPermissionBanner.style.display = 'flex';
        }
    } else {
        authModal.style.display = 'flex';
        mainContainer.style.display = 'none';
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        loginUsernameInput.focus();
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

// Подписка на push notifications
async function subscribeToPushNotifications() {
    try {
        console.log('🔄 Начинаем подписку на push...');
        if (!('serviceWorker' in navigator)) {
            console.error('❌ Service Worker не поддерживается');
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker готов');
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            console.log('✅ Подписка уже существует, используем её');
        } else {
            console.log('🔄 Создаём новую подписку...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BEl62iUZbU4z7gxWrb94Q6-q6XJ5Q7wXewQIdyT0Z1ySLn0d8l1sp7PV2xF0dWUzchTDslHCMwYVJyWP86VlIXM')
            });
            console.log('✅ Новая подписка создана');
        }
        if (currentUsername && socket.connected) {
            console.log('📤 Отправляем подписку на сервер для:', currentUsername);
            socket.emit('subscribe-to-push', {
                username: currentUsername,
                subscription: subscription.toJSON()
            });
            console.log('✅ Подписка отправлена на сервер');
        } else {
            console.error('❌ Не удалось отправить подписку:', {
                username: currentUsername,
                connected: socket.connected
            });
        }
    } catch (error) {
        console.error('❌ Ошибка подписки на push:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

lightThemeBtn.addEventListener('click', () => { setTheme('light'); });
darkThemeBtn.addEventListener('click', () => { setTheme('dark'); });

allowNotificationsBtn.addEventListener('click', () => {
    if ('Notification' in window) {
        Notification.requestPermission().then((permission) => {
            console.log('🔔 Разрешение на уведомления:', permission);
            notificationPermissionBanner.style.display = 'none';
            if (permission === 'granted') {
                console.log('✅ Push notifications разрешены');
                setTimeout(() => {
                    subscribeToPushNotifications();
                }, 500);
            }
        });
    }
});

dismissNotificationsBtn.addEventListener('click', () => {
    notificationPermissionBanner.style.display = 'none';
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

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function loadProfileData() {
    socket.emit('get-profile', { username: currentUsername });
}

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

backToGeneralBtn.addEventListener('click', () => {
    backToGeneralChat();
});

toggleSidebarBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
});

function updateUsersList() {
    usersList.innerHTML = '';
    allUsers.forEach(user => {
        const username = typeof user === 'string' ? user : user.username;
        if (username === currentUsername) return;
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (username === currentChatUser) userItem.classList.add('active');
        const avatarUrl = typeof user === 'string' ? null : user.avatar_url;
        let avatarElement;
        if (avatarUrl) {
            avatarElement = document.createElement('img');
            avatarElement.src = avatarUrl;
            avatarElement.alt = username;
            avatarElement.className = 'user-list-avatar';
        } else {
            avatarElement = document.createElement('div');
            avatarElement.className = 'user-list-avatar-placeholder';
            avatarElement.textContent = username.substring(0, 1).toUpperCase();
        }
        const statusDot = document.createElement('div');
        statusDot.className = 'user-status';
        const isOnline = typeof user === 'string' ? onlineUsers.includes(user) : user.isOnline;
        statusDot.style.background = isOnline ? '#4caf50' : '#ccc';
        statusDot.title = isOnline ? 'Онлайн' : 'Офлайн';
        const userName = document.createElement('span');
        userName.textContent = username;
        userItem.appendChild(avatarElement);
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

function openPrivateChat(username) {
    currentChatUser = username;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    backBtn.style.display = 'flex';
    callBtn.style.display = 'flex';
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

function backToGeneralChat() {
    currentChatUser = null;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    backBtn.style.display = 'none';
    callBtn.style.display = 'none';
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
    messageInput.blur();
    document.activeElement.blur();
}

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

attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenu.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!attachBtn.contains(e.target) && !attachMenu.contains(e.target)) {
        attachMenu.classList.remove('active');
    }
});

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

function showVideoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentPreviewFile = file;
        previewImage.src = e.target.result;
        previewImage.style.display = 'none';
        const previewContainer = document.querySelector('.preview-image-container');
        const existingVideo = previewContainer.querySelector('video');
        if (existingVideo) existingVideo.remove();
        const videoElement = document.createElement('video');
        videoElement.src = e.target.result;
        videoElement.style.maxWidth = '100%';
        videoElement.style.maxHeight = '100%';
        videoElement.style.borderRadius = '6px';
        videoElement.style.objectFit = 'contain';
        videoElement.controls = true;
        previewContainer.appendChild(videoElement);
        imageCaptionInput.value = '';
        imagePreviewModal.classList.add('active');
    };
    reader.readAsDataURL(file);
}

sendPreviewBtn.addEventListener('click', () => {
    if (currentPreviewFile) {
        uploadFile(currentPreviewFile, imageCaptionInput.value);
        imagePreviewModal.classList.remove('active');
        currentPreviewFile = null;
    }
});

cancelPreviewBtn.addEventListener('click', () => {
    imagePreviewModal.classList.remove('active');
    currentPreviewFile = null;
});

closePreviewBtn.addEventListener('click', () => {
    imagePreviewModal.classList.remove('active');
    currentPreviewFile = null;
});

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
        }
    } catch (error) {
        alert('Ошибка загрузки файла: ' + error.message);
    }
}

// Обработчики сообщений
socket.on('load-general-messages', (messages) => {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        displayMessage(msg, 'general');
    });
});

socket.on('new-message', (message) => {
    displayMessage(message, 'general');
    removeWelcomeMessage();
});

socket.on('private-messages-loaded', (messages) => {
    messagesContainer.innerHTML = '';
    messages.forEach(msg => {
        displayMessage(msg, 'private');
    });
});

socket.on('private-message', (message) => {
    if (currentChatUser === message.from || currentChatUser === message.to) {
        displayMessage(message, 'private');
        removeWelcomeMessage();
    } else {
        if (!unreadMessages[message.from]) {
            unreadMessages[message.from] = 0;
        }
        unreadMessages[message.from]++;
        updateUsersList();
        playNotificationSound();
    }
});

socket.on('message-deleted', (data) => {
    const messageEl = document.getElementById(`msg-${data.id}`);
    if (messageEl) {
        messageEl.remove();
    }
});

socket.on('message-read', (data) => {
    const messageEl = document.getElementById(`msg-${data.id}`);
    if (messageEl) {
        const readStatus = messageEl.querySelector('.read-status');
        if (readStatus) {
            readStatus.textContent = '✓✓';
        }
    }
});

socket.on('profile-updated', (data) => {
    if (data.success) {
        currentUsername = data.newUsername;
        currentUserSpan.textContent = `👤 ${currentUsername}`;
        saveCredentials(currentUsername, getCookie('password'));
        alert('Профиль обновлен');
    } else {
        alert('Ошибка: ' + data.message);
    }
});

socket.on('profile-data', (data) => {
    profileAvatar.src = data.avatar_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23ccc"/></svg>';
    profileStatus.value = data.status_text || '';
});

function displayMessage(msg, type) {
    const messageEl = document.createElement('div');
    messageEl.id = `msg-${msg.id}`;
    messageEl.className = 'message';
    if (msg.username === currentUsername || msg.from === currentUsername) {
        messageEl.classList.add('own-message');
    }
    let content = '';
    if (msg.type === 'file') {
        const ext = msg.originalname.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
        const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(ext);
        const isAudio = ['mp3', 'wav', 'ogg'].includes(ext);
        if (isImage) {
            content = `<img src="${msg.url}" alt="Image" style="max-height: 200px; cursor: pointer;" onclick="openImageViewer('${msg.url}')">`;
            if (msg.caption) content += `<p>${msg.caption}</p>`;
        } else if (isVideo) {
            content = `<video style="max-height: 200px; cursor: pointer;" onclick="openVideoViewer('${msg.url}')"><source src="${msg.url}"></video>`;
            if (msg.caption) content += `<p>${msg.caption}</p>`;
        } else if (isAudio) {
            content = `<audio controls style="width: 100%;"><source src="${msg.url}"></audio>`;
            if (msg.caption) content += `<p>${msg.caption}</p>`;
        } else {
            content = `<a href="${msg.url}" download="${msg.originalname}">📎 ${msg.originalname}</a>`;
            if (msg.caption) content += `<p>${msg.caption}</p>`;
        }
    } else {
        content = `<p>${msg.message}</p>`;
    }
    messageEl.innerHTML = `
        <div class="message-content">
            ${content}
            <span class="message-time">${formatTime(msg.timestamp)}</span>
            ${msg.username === currentUsername || msg.from === currentUsername ? `<span class="read-status">${msg.readStatus === 2 ? '✓✓' : '✓'}</span>` : ''}
        </div>
    `;
    messageEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (msg.username === currentUsername || msg.from === currentUsername) {
            showContextMenu(msg.id, e.clientX, e.clientY);
        }
    });
    messageEl.addEventListener('touchstart', (e) => {
        if (msg.username === currentUsername || msg.from === currentUsername) {
            longPressTimer = setTimeout(() => {
                const touch = e.touches[0];
                showContextMenu(msg.id, touch.clientX, touch.clientY);
            }, 500);
        }
    });
    messageEl.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    if (msg.from && msg.from !== currentUsername && type === 'private') {
        socket.emit('mark-as-read', { id: msg.id });
    }
}

function removeWelcomeMessage() {
    const welcome = messagesContainer.querySelector('.welcome-message');
    if (welcome) {
        welcome.remove();
    }
}

function deleteMessage(id) {
    socket.emit('delete-message', { id: id });
}

function openImageViewer(url) {
    viewerImage.src = url;
    imageViewerModal.classList.add('active');
}

function openVideoViewer(url) {
    const video = document.getElementById('viewer-video');
    video.src = url;
    videoViewerModal.classList.add('active');
}

closeViewerBtn.addEventListener('click', () => {
    imageViewerModal.classList.remove('active');
});

document.getElementById('close-video-viewer').addEventListener('click', () => {
    document.getElementById('video-viewer-modal').classList.remove('active');
});

// ===== РЕАЛЬНЫЕ АУДИОЗВОНКИ (WEBRTC) =====

const activeCallModal = document.getElementById('active-call-modal');
const activeCallName = document.getElementById('active-call-name');
const activeCallDuration = document.getElementById('active-call-duration');
const muteBtn = document.getElementById('mute-btn');
const endActiveCallBtn = document.getElementById('end-active-call-btn');
const speakerBtn = document.getElementById('speaker-btn');

// TURN серверы (бесплатные)
const iceServers = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
        { urls: ['stun:stun.stunprotocol.org:3478'] },
        { urls: ['stun:stun.services.mozilla.com:3478'] },
        { urls: 'turn:numb.viagenie.ca', credential: 'webrtcdemo', username: 'webrtc@example.com' }
    ]
};

// Инициирование реального звонка
function initiateAudioCall() {
    console.log('📞 initiateAudioCall вызвана, currentChatUser:', currentChatUser);
    if (!currentChatUser) {
        console.error('❌ Нет выбранного пользователя для звонка');
        alert('Выберите пользователя для звонка');
        return;
    }
    console.log('📞 Инициирование реального звонка с:', currentChatUser);
    navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    }).then(stream => {
        localStream = stream;
        console.log('✅ Микрофон получен');
        peerConnection = new RTCPeerConnection(iceServers);
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        peerConnection.ontrack = (event) => {
            console.log('📹 Получен удалённый аудио поток');
            if (!remoteAudio) {
                remoteAudio = new Audio();
                remoteAudio.autoplay = true;
            }
            remoteAudio.srcObject = event.streams[0];
        };
        peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Состояние соединения:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed') {
                alert('Ошибка соединения. Попробуйте ещё раз.');
                endCall();
            }
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: currentChatUser,
                    candidate: event.candidate
                });
            }
        };
        peerConnection.createOffer({
            offerToReceiveAudio: true
        }).then(offer => {
            return peerConnection.setLocalDescription(offer);
        }).then(() => {
            socket.emit('call-offer', {
                to: currentChatUser,
                offer: peerConnection.localDescription
            });
            console.log('📤 Offer отправлен');
        }).catch(error => {
            console.error('❌ Ошибка создания offer:', error);
            alert('Ошибка: ' + error.message);
        });
    }).catch(error => {
        console.error('❌ Ошибка при получении микрофона:', error);
        alert('Ошибка доступа к микрофону: ' + error.message);
    });
}

if (callBtn) {
    console.log('✅ callBtn найден, добавляем обработчик');
    callBtn.addEventListener('click', () => {
        console.log('🔘 Кнопка звонка нажата, currentChatUser:', currentChatUser);
        initiateAudioCall();
    });
} else {
    console.error('❌ callBtn не найден в DOM');
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
                isMuted = !track.enabled;
            });
            muteBtn.classList.toggle('muted');
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
        }
    });
}

if (endActiveCallBtn) {
    endActiveCallBtn.addEventListener('click', () => {
        endCall();
    });
}

function endCall() {
    console.log('📞 Завершение звонка');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio = null;
    }
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
    activeCallModal.classList.remove('active');
    if (currentChatUser) {
        socket.emit('call-ended', {
            from: currentUsername,
            to: currentChatUser
        });
    }
}

socket.on('call-offer', async (data) => {
    try {
        console.log('📤 Получен offer от:', data.from);
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        }
        peerConnection = new RTCPeerConnection(iceServers);
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        peerConnection.ontrack = (event) => {
            console.log('📹 Получен удалённый аудио поток');
            if (!remoteAudio) {
                remoteAudio = new Audio();
                remoteAudio.autoplay = true;
            }
            remoteAudio.srcObject = event.streams[0];
            activeCallName.textContent = `Звонок с ${data.from}`;
            activeCallModal.classList.add('active');
            startCallTimer();
        };
        peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Состояние соединения:', peerConnection.connectionState);
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: data.from,
                    candidate: event.candidate
                });
            }
        };
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('call-answer', {
            to: data.from,
            answer: answer
        });
        console.log('📥 Answer отправлен');
    } catch (error) {
        console.error('❌ Ошибка обработки offer:', error);
    }
});

socket.on('call-answer', async (data) => {
    try {
        console.log('📥 Получен answer от:', data.from);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            activeCallName.textContent = `Звонок с ${data.from}`;
            activeCallModal.classList.add('active');
            startCallTimer();
        }
    } catch (error) {
        console.error('❌ Ошибка обработки answer:', error);
    }
});

socket.on('ice-candidate', async (data) => {
    try {
        if (peerConnection && data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error('❌ Ошибка добавления ICE candidate:', error);
    }
});

socket.on('call-ended', (data) => {
    console.log('📞 Звонок завершён:', data.from);
    endCall();
    alert(`${data.from} завершил звонок`);
});

function startCallTimer() {
    callStartTime = Date.now();
    callDurationInterval = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        activeCallDuration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}