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
let userListRefreshInterval = null;

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
    
    // Если есть сохранённые учётные данные, скрываем экран авторизации и сразу заходим
    if (savedUsername && savedPassword) {
        currentUsername = savedUsername;
        // Скрываем экран авторизации сразу
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
        // Показываем экран авторизации только если нет сохранённых данных
        authModal.style.display = 'flex';
        mainContainer.style.display = 'none';
        loginUsernameInput.focus();
    }
    
    // Запрашиваем разрешение на push notifications
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
    
    // Отключаем кнопку демонстрации экрана на мобильных устройствах
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile || !navigator.mediaDevices.getDisplayMedia) {
        toggleScreenBtn.style.display = 'none';
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
        
        // Показываем баннер для запроса разрешения на уведомления если нужно
        if ('Notification' in window && Notification.permission === 'default') {
            notificationPermissionBanner.style.display = 'flex';
        }
        
        // Запускаем периодическое обновление списка пользователей каждые 3 секунды
        if (userListRefreshInterval) {
            clearInterval(userListRefreshInterval);
        }
        userListRefreshInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('get-users-list');
            }
        }, 3000);
    } else {
        // Если ошибка при автозаходе, показываем экран авторизации
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
    
    // Обновляем список пользователей только если мы в общем чате
    if (!currentChatUser) {
        updateUsersList();
    } else {
        // Если мы в приватном чате, только обновляем информацию о пользователе
        const userInfo = users.find(u => u.username === currentChatUser);
        if (userInfo) {
            const chatUserAvatar = document.getElementById('chat-user-avatar');
            const chatUserStatus = document.getElementById('chat-user-status');
            
            if (userInfo.avatar_url) {
                chatUserAvatar.src = userInfo.avatar_url;
                chatUserAvatar.style.display = 'block';
            } else {
                chatUserAvatar.style.display = 'none';
            }
            
            // Обновляем статус
            let statusText = 'Был в сети';
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
            
            chatUserStatus.textContent = statusText;
            chatUserStatus.className = 'chat-user-status' + (userInfo.isOnline ? ' online' : '');
            
            // Показываем кнопку звонка всегда
            const chatCallBtn = document.getElementById('chat-call-btn');
            chatCallBtn.style.display = 'flex';
        }
    }
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
        
        // Обработка сообщений от Service Worker
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'CALL_ACTION') {
                    console.log(`📞 Действие со звонком: ${event.data.action}`);
                    
                    if (event.data.action === 'accept') {
                        stopRingtone();
                        currentCallId = event.data.callId;
                        currentCallUser = event.data.caller;
                        socket.emit('accept-call', { callId: event.data.callId });
                    } else if (event.data.action === 'reject') {
                        stopRingtone();
                        socket.emit('reject-call', { callId: event.data.callId });
                    }
                }
            });
        }
        
        // Проверяем есть ли уже подписка
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
        
        // Отправляем подписку на сервер
        if (currentUsername && socket.connected) {
            console.log('📤 Отправляем подписку на сервер для:', currentUsername);
            console.log('📊 Данные подписки:', {
                endpoint: subscription.endpoint.substring(0, 50) + '...',
                keys: subscription.getKey ? 'есть' : 'нет'
            });
            
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

// Конвертируем VAPID ключ в правильный формат
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Переключение темы
lightThemeBtn.addEventListener('click', () => {
    setTheme('light');
});

darkThemeBtn.addEventListener('click', () => {
    setTheme('dark');
});

// Обработчики баннера для разрешения уведомлений
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
    
    // Останавливаем периодическое обновление списка пользователей
    if (userListRefreshInterval) {
        clearInterval(userListRefreshInterval);
        userListRefreshInterval = null;
    }
    
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

// Открытие приватного чата
function openPrivateChat(username) {
    currentChatUser = username;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    const chatUserAvatar = document.getElementById('chat-user-avatar');
    const chatUserStatus = document.getElementById('chat-user-status');
    const chatCallBtn = document.getElementById('chat-call-btn');
    
    backBtn.style.display = 'flex';
    
    // Получаем информацию о пользователе
    const userInfo = allUsers.find(u => u.username === username);
    let statusText = 'Был в сети';
    let isOnline = false;
    
    if (userInfo) {
        isOnline = userInfo.isOnline;
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
        
        // Показываем аватарку
        if (userInfo.avatar_url) {
            chatUserAvatar.src = userInfo.avatar_url;
            chatUserAvatar.style.display = 'block';
        } else {
            chatUserAvatar.style.display = 'none';
        }
    } else {
        chatUserAvatar.style.display = 'none';
    }
    
    // Обновляем заголовок
    chatTitle.textContent = username;
    chatUserStatus.textContent = statusText;
    chatUserStatus.className = 'chat-user-status' + (isOnline ? ' online' : '');
    
    // Показываем кнопку звонка всегда
    chatCallBtn.style.display = 'flex';
    chatCallBtn.onclick = () => initiateCall(username);
    
    messagesContainer.innerHTML = '';
    
    unreadMessages[username] = 0;
    
    socket.emit('load-private-messages', { username: username });
    
    messageInput.focus();
}

// Возврат в общий чат
function backToGeneralChat() {
    currentChatUser = null;
    const backBtn = document.getElementById('back-to-general-btn');
    const chatTitle = document.getElementById('chat-title');
    const chatUserAvatar = document.getElementById('chat-user-avatar');
    const chatUserStatus = document.getElementById('chat-user-status');
    const chatCallBtn = document.getElementById('chat-call-btn');
    const typingIndicator = document.getElementById('typing-indicator');
    
    backBtn.style.display = 'none';
    chatTitle.textContent = 'Общий чат';
    chatUserAvatar.style.display = 'none';
    chatUserStatus.textContent = '';
    chatCallBtn.style.display = 'none';
    typingIndicator.style.display = 'none';
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

// Отправляем событие печатания
let typingTimeout;
messageInput.addEventListener('input', () => {
    if (currentChatUser && socket.connected) {
        socket.emit('user-typing', { 
            recipientUsername: currentChatUser,
            isTyping: true 
        });
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('user-typing', { 
                recipientUsername: currentChatUser,
                isTyping: false 
            });
        }, 3000);
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

// Видео модал
const videoViewerModal = document.getElementById('video-viewer-modal');
const viewerVideo = document.getElementById('viewer-video');
const closeVideoViewerBtn = document.getElementById('close-video-viewer');
const videoPlayBtn = document.getElementById('video-play-btn');

closeVideoViewerBtn.addEventListener('click', () => {
    videoViewerModal.classList.remove('active');
    viewerVideo.pause();
});

videoViewerModal.addEventListener('click', (e) => {
    if (e.target === videoViewerModal) {
        videoViewerModal.classList.remove('active');
        viewerVideo.pause();
    }
});

viewerVideo.addEventListener('play', () => {
    videoPlayBtn.innerHTML = '<i class="fas fa-pause"></i>';
});

viewerVideo.addEventListener('pause', () => {
    videoPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
});

videoPlayBtn.addEventListener('click', () => {
    if (viewerVideo.paused) {
        viewerVideo.play();
    } else {
        viewerVideo.pause();
    }
});

// Полноэкранный просмотр картинок
const fullscreenImageModal = document.getElementById('fullscreen-image-modal');
const fullscreenImage = document.getElementById('fullscreen-image');
const fullscreenImageContainer = document.getElementById('fullscreen-image-container');
const closeFullscreenBtn = document.getElementById('close-fullscreen');
const fullscreenViewerBtn = document.getElementById('fullscreen-viewer-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomLevel = document.getElementById('zoom-level');

let currentZoom = 1;
const minZoom = 0.5;
const maxZoom = 4;
const zoomStep = 0.2;

fullscreenViewerBtn.addEventListener('click', () => {
    const currentImageSrc = viewerImage.src;
    fullscreenImage.src = currentImageSrc;
    currentZoom = 1;
    updateZoomLevel();
    imageViewerModal.classList.remove('active');
    fullscreenImageModal.classList.add('active');
});

closeFullscreenBtn.addEventListener('click', () => {
    fullscreenImageModal.classList.remove('active');
    imageViewerModal.classList.add('active');
});

fullscreenImageModal.addEventListener('click', (e) => {
    if (e.target === fullscreenImageModal) {
        fullscreenImageModal.classList.remove('active');
        imageViewerModal.classList.add('active');
    }
});

// Зум функции
function updateZoomLevel() {
    currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom));
    fullscreenImage.style.transform = `scale(${currentZoom})`;
    zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
}

zoomInBtn.addEventListener('click', () => {
    currentZoom += zoomStep;
    updateZoomLevel();
});

zoomOutBtn.addEventListener('click', () => {
    currentZoom -= zoomStep;
    updateZoomLevel();
});

// Зум колесом мыши
fullscreenImageContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        currentZoom += zoomStep;
    } else {
        currentZoom -= zoomStep;
    }
    updateZoomLevel();
}, { passive: false });

// Двойной клик для сброса зума
fullscreenImage.addEventListener('dblclick', () => {
    currentZoom = 1;
    updateZoomLevel();
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
    
    // Показываем статус загрузки
    const uploadStatusDiv = document.createElement('div');
    uploadStatusDiv.className = 'upload-status';
    uploadStatusDiv.id = `upload-${Date.now()}`;
    uploadStatusDiv.innerHTML = `
        <div class="upload-progress-container">
            <div class="upload-info">
                <span class="upload-filename">${file.name}</span>
                <span class="upload-percent">0%</span>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(uploadStatusDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        const xhr = new XMLHttpRequest();
        
        // Отслеживаем прогресс загрузки
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                const progressFill = uploadStatusDiv.querySelector('.upload-progress-fill');
                const percentSpan = uploadStatusDiv.querySelector('.upload-percent');
                if (progressFill && percentSpan) {
                    progressFill.style.width = percentComplete + '%';
                    percentSpan.textContent = Math.round(percentComplete) + '%';
                }
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    
                    // Удаляем статус загрузки с небольшой задержкой
                    setTimeout(() => {
                        if (uploadStatusDiv.parentNode) {
                            uploadStatusDiv.remove();
                        }
                    }, 300);
                    
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
                } catch (e) {
                    console.error('Ошибка парсинга ответа:', e);
                    if (uploadStatusDiv.parentNode) {
                        uploadStatusDiv.remove();
                    }
                    alert('Ошибка загрузки файла');
                }
            } else {
                if (uploadStatusDiv.parentNode) {
                    uploadStatusDiv.remove();
                }
                alert('Ошибка загрузки файла: ' + xhr.status);
            }
        });
        
        xhr.addEventListener('error', () => {
            if (uploadStatusDiv.parentNode) {
                uploadStatusDiv.remove();
            }
            alert('Ошибка загрузки файла');
        });
        
        xhr.addEventListener('abort', () => {
            if (uploadStatusDiv.parentNode) {
                uploadStatusDiv.remove();
            }
        });
        
        xhr.open('POST', '/upload');
        xhr.send(formData);
    } catch (error) {
        if (uploadStatusDiv.parentNode) {
            uploadStatusDiv.remove();
        }
        console.error('Ошибка:', error);
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

// Событие печатания
socket.on('user-typing', (data) => {
    const typingIndicator = document.getElementById('typing-indicator');
    const typingUserName = document.getElementById('typing-user-name');
    
    if (data.from === currentChatUser && data.isTyping) {
        typingUserName.textContent = data.from;
        typingIndicator.style.display = 'block';
    } else if (data.from === currentChatUser && !data.isTyping) {
        typingIndicator.style.display = 'none';
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
    
    // Получаем аватарку - сначала из сообщения, потом из allUsers
    let avatarUrl = data.avatar_url;
    if (!avatarUrl) {
        const userInfo = allUsers.find(u => u.username === senderName);
        avatarUrl = userInfo && userInfo.avatar_url ? userInfo.avatar_url : null;
    }
    
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
        // Для GIF используем оригинал, для остальных - сжатую версию
        let displayUrl = url;
        if (mimetype !== 'image/gif' && !url.includes('compressed-')) {
            displayUrl = url.replace('/uploads/', '/uploads/compressed-');
        }
        
        return `
            <div class="message-image-container" onclick="openImageViewer('${url}')">
                <img src="${displayUrl}" alt="${filename}" class="message-image">
                <a href="${url}?download=true" download="${filename}" class="image-download-btn" title="Скачать" onclick="event.stopPropagation()">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        `;
    }
    
    if (mimetype.startsWith('video/')) {
        return `
            <div class="message-video-container" onclick="openVideoViewer('${url}')">
                <video src="${url}" class="message-video"></video>
                <div class="video-play-overlay">
                    <i class="fas fa-play"></i>
                </div>
                <a href="${url}?download=true" download="${filename}" class="video-download-btn" title="Скачать видео" onclick="event.stopPropagation()">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        `;
    }
    
    if (mimetype.startsWith('audio/')) {
        return `
            <div class="message-audio-container">
                <audio src="${url}" controls class="message-audio"></audio>
                <a href="${url}?download=true" download="${filename}" class="audio-download-btn" title="Скачать аудио">
                    <i class="fas fa-download"></i>
                </a>
            </div>
        `;
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
    return `<a href="${url}?download=true" download="${filename}" class="file-link" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f0f0f0; border-radius: 6px; text-decoration: none; color: #333; width: fit-content;">
        <span style="font-size: 20px;">${icon}</span>
        <span style="font-size: 13px; word-break: break-all;">${filename}</span>
    </a>`;
}

// Открытие картинки в модале
function openImageViewer(url) {
    // Если это сжатая версия, используем оригинал для просмотра
    const originalUrl = url.includes('compressed-') ? url.replace('compressed-', '') : url;
    viewerImage.src = originalUrl;
    imageViewerModal.classList.add('active');
}

// Открытие видео в модале
function openVideoViewer(url) {
    const videoViewerModal = document.getElementById('video-viewer-modal');
    const viewerVideo = document.getElementById('viewer-video');
    viewerVideo.src = url;
    videoViewerModal.classList.add('active');
    viewerVideo.play();
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


// ===== ЗВОНКИ =====
const incomingCallModal = document.getElementById('incoming-call-modal');
const activeCallModal = document.getElementById('active-call-modal');
const incomingCallerName = document.getElementById('incoming-caller-name');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');
const toggleScreenBtn = document.getElementById('toggle-screen-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteVideoPlaceholder = document.getElementById('remote-video-placeholder');
const activeCallUser = document.getElementById('active-call-user');
const callDuration = document.getElementById('call-duration');

let currentCallId = null;
let currentCallUser = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callStartTime = null;
let callDurationInterval = null;
let audioEnabled = true;
let videoEnabled = true;
let screenEnabled = false;
let screenStream = null;
let isCallInProgress = false; // Флаг для предотвращения множественных звонков
let remoteVideoEnabled = true; // Отслеживаем состояние видео удаленного пользователя

// STUN серверы для NAT traversal
const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
];

// Функция для отображения аватарки когда видео отключено
function updateRemoteVideoDisplay() {
    if (!remoteVideoEnabled && currentCallUser) {
        // Видео отключено - показываем аватарку
        remoteVideo.style.display = 'none';
        remoteVideoPlaceholder.style.display = 'flex';
        
        // Получаем информацию о пользователе
        const userInfo = allUsers.find(u => u.username === currentCallUser);
        const avatarDisplay = document.getElementById('remote-avatar-display');
        const userNameDisplay = document.getElementById('remote-user-name-display');
        
        if (userInfo && userInfo.avatar_url) {
            avatarDisplay.innerHTML = `<img src="${userInfo.avatar_url}" class="remote-avatar-large" alt="${currentCallUser}">`;
        } else {
            const initials = currentCallUser.substring(0, 1).toUpperCase();
            avatarDisplay.innerHTML = `<div class="remote-avatar-placeholder-large">${initials}</div>`;
        }
        
        userNameDisplay.textContent = currentCallUser;
    } else {
        // Видео включено - показываем видео
        remoteVideo.style.display = 'block';
        remoteVideoPlaceholder.style.display = 'none';
    }
}

// Инициирование звонка
function initiateCall(recipientUsername) {
    if (!currentUsername) return;
    
    // Если звонок уже в процессе, игнорируем повторный клик
    if (isCallInProgress) {
        console.log('⚠️ Звонок уже в процессе, игнорируем повторный клик');
        return;
    }
    
    isCallInProgress = true;
    console.log(`📞 Инициируем звонок к ${recipientUsername}`);
    socket.emit('initiate-call', { recipientUsername: recipientUsername });
}

// Обработка сообщений от Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CALL_ACTION') {
            console.log(`📞 Действие со звонком: ${event.data.action}`);
            
            if (event.data.action === 'accept') {
                currentCallId = event.data.callId;
                currentCallUser = event.data.caller;
                socket.emit('accept-call', { callId: event.data.callId });
            } else if (event.data.action === 'reject') {
                socket.emit('reject-call', { callId: event.data.callId });
            }
        }
    });
}

// Добавляем кнопку звонка в список пользователей
function updateUsersList() {
    usersList.innerHTML = '';
    
    allUsers.forEach(user => {
        const username = typeof user === 'string' ? user : user.username;
        if (username === currentUsername) return;
        
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (username === currentChatUser) userItem.classList.add('active');
        
        // Аватарка
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

// Socket события - Звонки
socket.on('call-initiated', (data) => {
    console.log(`✅ Звонок инициирован. ID: ${data.callId}`);
    currentCallId = data.callId;
    currentCallUser = data.recipient;
});

socket.on('incoming-call', async (data) => {
    console.log(`📞 Входящий звонок от ${data.caller}`);
    currentCallId = data.callId;
    currentCallUser = data.caller;
    
    incomingCallerName.textContent = data.caller;
    incomingCallModal.classList.add('active');
    
    // Воспроизводим рингтон
    try {
        startRingtone();
    } catch (e) {
        console.log('Ошибка рингтона:', e);
        // Если рингтон не сработал, используем обычный звук
        try {
            playNotificationSound();
        } catch (e2) {
            console.log('Ошибка звука:', e2);
        }
    }
});

socket.on('call-accepted', async (data) => {
    console.log(`✅ Звонок принят ${data.recipient}`);
    incomingCallModal.classList.remove('active');
    
    // Инициируем WebRTC соединение
    await startCall(data.recipient, true);
});

socket.on('call-accepted-confirmed', async (data) => {
    console.log(`✅ Подтверждение принятия звонка`);
    incomingCallModal.classList.remove('active');
    
    // Инициируем WebRTC соединение
    await startCall(currentCallUser, false);
});

socket.on('call-rejected', (data) => {
    console.log(`❌ Звонок отклонен`);
    stopRingtone();
    currentCallId = null;
    currentCallUser = null;
    isCallInProgress = false; // Сбрасываем флаг при отклонении
    alert('Звонок отклонен');
});

socket.on('call-ended', (data) => {
    console.log(`📞 Звонок завершен. Длительность: ${data.duration}с`);
    endCall();
});

socket.on('webrtc-offer', async (data) => {
    console.log(`📡 Получен WebRTC offer`);
    if (!peerConnection) {
        await createPeerConnection();
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', {
            callId: data.callId,
            answer: answer,
            callerUsername: data.callerUsername
        });
    } catch (error) {
        console.error('❌ Ошибка обработки offer:', error);
    }
});

socket.on('webrtc-answer', async (data) => {
    console.log(`📡 Получен WebRTC answer`);
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
        console.error('❌ Ошибка обработки answer:', error);
    }
});

socket.on('webrtc-ice-candidate', async (data) => {
    try {
        if (data.candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error('❌ Ошибка добавления ICE candidate:', error);
    }
});

// Создание WebRTC соединения
async function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection({
            iceServers: iceServers,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });
        
        // Обработка локального потока
        peerConnection.ontrack = (event) => {
            console.log('📹 Получен удаленный поток', event);
            console.log('📹 Треки:', event.track.kind, event.streams);
            
            if (event.streams && event.streams.length > 0) {
                remoteStream = event.streams[0];
                console.log('📹 Установлен remoteStream:', remoteStream);
                remoteVideo.srcObject = remoteStream;
                console.log('📹 remoteVideo.srcObject установлен');
                
                // Отслеживаем видео треки
                if (event.track.kind === 'video') {
                    remoteVideoEnabled = true;
                    updateRemoteVideoDisplay();
                    
                    // Отслеживаем когда видео отключается
                    event.track.onended = () => {
                        console.log('📹 Видео трек завершен');
                        remoteVideoEnabled = false;
                        updateRemoteVideoDisplay();
                    };
                    
                    // Отслеживаем изменение enabled
                    const checkVideoStatus = setInterval(() => {
                        if (event.track.enabled !== remoteVideoEnabled) {
                            remoteVideoEnabled = event.track.enabled;
                            updateRemoteVideoDisplay();
                        }
                    }, 500);
                }
                
                // Пытаемся воспроизвести видео
                remoteVideo.play().catch(err => {
                    console.warn('⚠️ Ошибка воспроизведения видео:', err);
                });
                
                // Адаптируем размер видео в зависимости от соотношения сторон
                remoteVideo.onloadedmetadata = () => {
                    console.log('📹 Видео загружено');
                    adjustVideoLayout();
                };
            } else {
                console.warn('⚠️ Нет потоков в event.streams');
            }
        };
        
        // Обработка ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-ice-candidate', {
                    callId: currentCallId,
                    candidate: event.candidate,
                    targetUsername: currentCallUser
                });
            }
        };
        
        // Обработка изменения состояния соединения
        peerConnection.onconnectionstatechange = () => {
            console.log(`🔗 Состояние соединения: ${peerConnection.connectionState}`);
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                endCall();
            }
        };
        
        // Обработка изменения состояния ICE
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`❄️ ICE состояние: ${peerConnection.iceConnectionState}`);
        };
        
        // Добавляем локальный поток с оптимальными параметрами
        if (localStream) {
            console.log('🎤 Добавляем локальный поток с треками:', localStream.getTracks().map(t => t.kind));
            localStream.getTracks().forEach(track => {
                console.log(`🎤 Добавляем трек: ${track.kind}, enabled: ${track.enabled}`);
                const sender = peerConnection.addTrack(track, localStream);
                
                // Оптимизируем параметры видео трека
                if (track.kind === 'video') {
                    const parameters = sender.getParameters();
                    if (!parameters.encodings) {
                        parameters.encodings = [{}];
                    }
                    
                    // Устанавливаем максимальный битрейт для видео
                    parameters.encodings[0].maxBitrate = 2500000; // 2.5 Mbps
                    parameters.encodings[0].maxFramerate = 30;
                    
                    sender.setParameters(parameters).catch(e => console.log('Ошибка установки параметров:', e));
                }
                
                // Оптимизируем параметры аудио трека
                if (track.kind === 'audio') {
                    const parameters = sender.getParameters();
                    if (!parameters.encodings) {
                        parameters.encodings = [{}];
                    }
                    
                    parameters.encodings[0].maxBitrate = 128000; // 128 kbps
                    
                    sender.setParameters(parameters).catch(e => console.log('Ошибка установки параметров:', e));
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания PeerConnection:', error);
    }
}

// Начало звонка
async function startCall(recipientUsername, isInitiator) {
    try {
        console.log(`🎤 Начинаем звонок с ${recipientUsername}`);
        
        // Получаем доступ к микрофону и камере, но видео будет отключено
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            },
            video: {
                width: { min: 320, ideal: 1280, max: 1920 },
                height: { min: 240, ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 },
                facingMode: 'user'
            }
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('🎤 Получен локальный поток:', localStream.getTracks().map(t => t.kind));
        localVideo.srcObject = localStream;
        
        // Пытаемся воспроизвести локальное видео
        localVideo.play().catch(err => {
            console.warn('⚠️ Ошибка воспроизведения локального видео:', err);
        });
        
        // Отключаем видео трек по умолчанию
        localStream.getVideoTracks().forEach(track => {
            console.log('🎥 Отключаем видео трек');
            track.enabled = false;
        });
        
        // Создаем WebRTC соединение
        await createPeerConnection();
        
        // Если мы инициатор, создаем offer с оптимальными параметрами
        if (isInitiator) {
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            };
            const offer = await peerConnection.createOffer(offerOptions);
            await peerConnection.setLocalDescription(offer);
            
            socket.emit('webrtc-offer', {
                callId: currentCallId,
                offer: offer,
                recipientUsername: recipientUsername
            });
        }
        
        // Показываем модал активного звонка
        activeCallUser.textContent = recipientUsername;
        activeCallModal.classList.add('active');
        
        // Запускаем таймер длительности
        callStartTime = Date.now();
        callDurationInterval = setInterval(updateCallDuration, 1000);
        
    } catch (error) {
        console.error('❌ Ошибка начала звонка:', error);
        alert('Ошибка доступа к микрофону: ' + error.message);
        endCall();
    }
}

// Обновление длительности звонка
function updateCallDuration() {
    if (callStartTime) {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        callDuration.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// Адаптация видео layout в зависимости от соотношения сторон
function adjustVideoLayout() {
    if (!remoteVideo || !remoteVideo.videoWidth || !remoteVideo.videoHeight) return;
    
    const videoAspectRatio = remoteVideo.videoWidth / remoteVideo.videoHeight;
    const containerAspectRatio = remoteVideo.parentElement.clientWidth / remoteVideo.parentElement.clientHeight;
    
    // Если видео с телефона (портретное - узкое), используем contain
    // Если видео с ПК (ландшафтное - широкое), используем cover
    if (videoAspectRatio < 1) {
        // Портретное видео (телефон)
        remoteVideo.style.objectFit = 'contain';
    } else {
        // Ландшафтное видео (ПК)
        remoteVideo.style.objectFit = 'contain';
    }
}

// Завершение звонка
function endCall() {
    console.log('📞 Завершаем звонок');
    
    // Останавливаем рингтон
    stopRingtone();
    
    // Отправляем событие завершения
    if (currentCallId) {
        const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
        socket.emit('end-call', {
            callId: currentCallId,
            duration: duration
        });
    }
    
    // Закрываем модалы
    activeCallModal.classList.remove('active');
    incomingCallModal.classList.remove('active');
    
    // Останавливаем таймер
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
    
    // Закрываем потоки
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    
    // Закрываем демонстрацию экрана
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    // Закрываем WebRTC соединение
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    currentCallId = null;
    currentCallUser = null;
    audioEnabled = true;
    videoEnabled = false;  // Видео отключено по умолчанию
    screenEnabled = false;
    isCallInProgress = false; // Сбрасываем флаг звонка
    
    // Обновляем кнопки
    toggleAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    toggleAudioBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    
    toggleVideoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
    toggleVideoBtn.style.background = '#f44336';  // Красная кнопка - видео отключено
    
    toggleScreenBtn.style.background = 'rgba(255, 255, 255, 0.2)';
}

// Обработчики кнопок звонка
acceptCallBtn.addEventListener('click', () => {
    console.log(`✅ Принимаем звонок`);
    stopRingtone();
    socket.emit('accept-call', { callId: currentCallId });
});

rejectCallBtn.addEventListener('click', () => {
    console.log(`❌ Отклоняем звонок`);
    stopRingtone();
    socket.emit('reject-call', { callId: currentCallId });
    incomingCallModal.classList.remove('active');
    currentCallId = null;
    currentCallUser = null;
    isCallInProgress = false; // Сбрасываем флаг при отклонении
});

endCallBtn.addEventListener('click', () => {
    endCall();
});

toggleAudioBtn.addEventListener('click', () => {
    if (localStream) {
        audioEnabled = !audioEnabled;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = audioEnabled;
        });
        
        if (audioEnabled) {
            toggleAudioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            toggleAudioBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        } else {
            toggleAudioBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            toggleAudioBtn.style.background = '#f44336';
        }
    }
});

toggleVideoBtn.addEventListener('click', async () => {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    
    if (videoTracks.length > 0) {
        // Видео уже есть, просто переключаем его
        videoEnabled = !videoEnabled;
        videoTracks.forEach(track => {
            track.enabled = videoEnabled;
        });
        
        if (videoEnabled) {
            toggleVideoBtn.innerHTML = '<i class="fas fa-video"></i>';
            toggleVideoBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        } else {
            toggleVideoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            toggleVideoBtn.style.background = '#f44336';
        }
    } else {
        // Видео нет, добавляем его
        try {
            const videoConstraints = {
                width: { min: 320, ideal: 1280, max: 1920 },
                height: { min: 240, ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 60 },
                facingMode: 'user'
            };
            
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            const videoTrack = videoStream.getVideoTracks()[0];
            
            // Добавляем видео трек к существующему потоку
            localStream.addTrack(videoTrack);
            
            // Добавляем трек к WebRTC соединению
            if (peerConnection) {
                const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                } else {
                    await peerConnection.addTrack(videoTrack, localStream);
                }
            }
            
            videoEnabled = true;
            toggleVideoBtn.innerHTML = '<i class="fas fa-video"></i>';
            toggleVideoBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            
            console.log('✅ Видео включено');
        } catch (error) {
            console.error('❌ Ошибка включения видео:', error);
            alert('Ошибка доступа к камере: ' + error.message);
        }
    }
});

// Демонстрация экрана
toggleScreenBtn.addEventListener('click', async () => {
    if (!peerConnection) return;
    
    // Проверяем поддержку демонстрации экрана
    if (!navigator.mediaDevices.getDisplayMedia) {
        alert('Демонстрация экрана не поддерживается на этом устройстве');
        return;
    }
    
    try {
        if (screenEnabled) {
            // Отключаем демонстрацию экрана
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }
            
            // Возвращаем видео с камеры если оно было
            if (videoEnabled && localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(videoTrack);
                    }
                }
            }
            
            screenEnabled = false;
            toggleScreenBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            console.log('✅ Демонстрация экрана отключена');
        } else {
            // Включаем демонстрацию экрана
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always'
                    },
                    audio: false
                });
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    console.log('⚠️ Пользователь отменил выбор экрана');
                    return;
                }
                throw error;
            }
            
            const screenTrack = screenStream.getVideoTracks()[0];
            
            // Заменяем видео трек на экран
            const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
                await sender.replaceTrack(screenTrack);
            } else {
                await peerConnection.addTrack(screenTrack, screenStream);
            }
            
            // Обработка остановки демонстрации экрана пользователем
            screenTrack.onended = async () => {
                if (videoEnabled && localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            await sender.replaceTrack(videoTrack);
                        }
                    }
                }
                screenEnabled = false;
                toggleScreenBtn.style.background = 'rgba(255, 255, 255, 0.2)';
                console.log('✅ Демонстрация экрана остановлена пользователем');
            };
            
            screenEnabled = true;
            toggleScreenBtn.style.background = '#2196F3';
            console.log('✅ Демонстрация экрана включена');
        }
    } catch (error) {
        console.error('❌ Ошибка демонстрации экрана:', error);
        if (error.name !== 'NotAllowedError') {
            alert('Ошибка демонстрации экрана: ' + error.message);
        }
    }
});

// Адаптация видео при изменении размера окна
window.addEventListener('resize', () => {
    if (remoteVideo && remoteVideo.srcObject) {
        adjustVideoLayout();
    }
});
