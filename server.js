const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Firebase инициализация
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.database();
console.log('✅ Подключено к Firebase');

// Создаем папку для загрузок если её нет
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});

// Статические файлы
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Отключаем кеш
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Загрузка файлов
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`
    });
});

// Socket.IO
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    socket.join('general');
    
    // Регистрация
    socket.on('register', async (data) => {
        try {
            const { username, password } = data;
            
            if (!username || !password) {
                socket.emit('register-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            if (username.length < 3 || password.length < 3) {
                socket.emit('register-response', { success: false, message: 'Минимум 3 символа' });
                return;
            }
            
            // Проверяем существует ли пользователь
            const snapshot = await db.ref('users').orderByChild('username').equalTo(username).once('value');
            
            if (snapshot.exists()) {
                socket.emit('register-response', { success: false, message: 'Пользователь уже существует' });
                return;
            }
            
            // Создаем пользователя
            const userId = db.ref('users').push().key;
            await db.ref(`users/${userId}`).set({
                username: username,
                password: password,
                createdAt: new Date().toISOString()
            });
            
            console.log('✅ Пользователь зарегистрирован:', username);
            socket.emit('register-response', { success: true, message: 'Регистрация успешна' });
            
            // Отправляем обновленный список пользователей
            const usersSnapshot = await db.ref('users').once('value');
            const users = [];
            usersSnapshot.forEach(child => {
                users.push(child.val().username);
            });
            io.emit('users-list', users);
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error.message);
            socket.emit('register-response', { success: false, message: 'Ошибка сервера' });
        }
    });
    
    // Вход
    socket.on('login', async (data) => {
        try {
            const { username, password } = data;
            
            if (!username || !password) {
                socket.emit('login-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            // Ищем пользователя
            const snapshot = await db.ref('users').once('value');
            let user = null;
            let userId = null;
            
            snapshot.forEach(child => {
                if (child.val().username === username) {
                    user = child.val();
                    userId = child.key;
                }
            });
            
            if (!user) {
                socket.emit('login-response', { success: false, message: 'Пользователь не найден' });
                return;
            }
            
            if (user.password !== password) {
                socket.emit('login-response', { success: false, message: 'Неверный пароль' });
                return;
            }
            
            // Сохраняем сессию
            socket.username = username;
            connectedUsers.set(socket.id, { username, socketId: socket.id });
            
            console.log('✅ Пользователь вошел:', username);
            socket.emit('login-response', { success: true, message: 'Вход успешен' });
            
            // Отправляем список пользователей
            const usersSnapshot = await db.ref('users').once('value');
            const users = [];
            usersSnapshot.forEach(child => {
                users.push(child.val().username);
            });
            socket.emit('users-list', users);
            
            // Отправляем онлайн пользователей
            const onlineUsers = Array.from(connectedUsers.values()).map(u => u.username);
            io.emit('online-users', onlineUsers);
            
            // Отправляем историю общего чата
            const messagesSnapshot = await db.ref('messages').orderByChild('isGeneral').equalTo(1).limitToLast(100).once('value');
            const messages = [];
            messagesSnapshot.forEach(child => {
                messages.unshift({
                    id: child.key,
                    ...child.val()
                });
            });
            socket.emit('load-general-messages', messages);
            
            // Уведомляем всех
            io.to('general').emit('user-status', { username: username, status: 'online' });
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error.message);
            socket.emit('login-response', { success: false, message: 'Ошибка сервера' });
        }
    });
    
    // Загрузка приватных сообщений
    socket.on('load-private-messages', async (data) => {
        try {
            const currentUser = socket.username;
            const otherUser = data.username;
            
            if (!currentUser) return;
            
            const snapshot = await db.ref('messages').once('value');
            const messages = [];
            
            snapshot.forEach(child => {
                const msg = child.val();
                if (msg.isGeneral === 0 && 
                    ((msg.fromUser === currentUser && msg.toUser === otherUser) ||
                     (msg.fromUser === otherUser && msg.toUser === currentUser))) {
                    messages.push({ id: child.key, ...msg });
                }
            });
            
            messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            socket.emit('private-messages-loaded', messages.slice(-100));
            
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    });
    
    // Загрузка общего чата
    socket.on('load-general-chat', async (data) => {
        try {
            const snapshot = await db.ref('messages').orderByChild('isGeneral').equalTo(1).limitToLast(100).once('value');
            const messages = [];
            snapshot.forEach(child => {
                messages.unshift({ id: child.key, ...child.val() });
            });
            socket.emit('load-general-messages', messages);
        } catch (error) {
            console.error('Ошибка загрузки общего чата:', error);
        }
    });
    
    // Отправка сообщения в общий чат
    socket.on('send-message', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const message = {
                fromUser: username,
                toUser: 'general',
                message: data.message,
                type: 'text',
                isGeneral: 1,
                createdAt: new Date().toISOString()
            };
            
            const ref = await db.ref('messages').push(message);
            
            const formattedMessage = {
                id: ref.key,
                username: username,
                message: data.message,
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'text'
            };
            
            io.to('general').emit('new-message', formattedMessage);
            
        } catch (error) {
            console.error('Ошибка отправки сообщения:', error);
        }
    });
    
    // Отправка файла в общий чат
    socket.on('send-file', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const message = {
                fromUser: username,
                toUser: 'general',
                filename: data.filename,
                originalname: data.originalname,
                url: data.url,
                mimetype: data.mimetype,
                caption: data.caption || '',
                type: 'file',
                isGeneral: 1,
                createdAt: new Date().toISOString()
            };
            
            const ref = await db.ref('messages').push(message);
            
            const formattedMessage = {
                id: ref.key,
                username: username,
                filename: data.filename,
                originalname: data.originalname,
                url: data.url,
                mimetype: data.mimetype,
                caption: data.caption || '',
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'file'
            };
            
            io.to('general').emit('new-message', formattedMessage);
            
        } catch (error) {
            console.error('Ошибка отправки файла:', error);
        }
    });
    
    // Удаление сообщения
    socket.on('delete-message', async (data) => {
        try {
            await db.ref(`messages/${data.id}`).remove();
            io.emit('message-deleted', { id: data.id });
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
        }
    });
    
    // Приватное сообщение
    socket.on('send-private-message', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, message } = data;
            
            const msg = {
                fromUser: senderUsername,
                toUser: recipientUsername,
                message: message,
                type: 'text',
                isGeneral: 0,
                createdAt: new Date().toISOString()
            };
            
            const ref = await db.ref('messages').push(msg);
            
            // Находим socket ID получателя
            let recipientSocketId = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    break;
                }
            }
            
            const formattedMessage = {
                id: ref.key,
                from: senderUsername,
                to: recipientUsername,
                message: message,
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'text'
            };
            
            socket.emit('private-message', formattedMessage);
            
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('private-message', formattedMessage);
            }
            
        } catch (error) {
            console.error('Ошибка отправки приватного сообщения:', error);
        }
    });
    
    // Приватный файл
    socket.on('send-private-file', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, filename, originalname, url, mimetype, caption } = data;
            
            const msg = {
                fromUser: senderUsername,
                toUser: recipientUsername,
                filename: filename,
                originalname: originalname,
                url: url,
                mimetype: mimetype,
                caption: caption || '',
                type: 'file',
                isGeneral: 0,
                createdAt: new Date().toISOString()
            };
            
            const ref = await db.ref('messages').push(msg);
            
            let recipientSocketId = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    break;
                }
            }
            
            const formattedMessage = {
                id: ref.key,
                from: senderUsername,
                to: recipientUsername,
                filename: filename,
                originalname: originalname,
                url: url,
                mimetype: mimetype,
                caption: caption || '',
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'file'
            };
            
            socket.emit('private-message', formattedMessage);
            
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('private-message', formattedMessage);
            }
            
        } catch (error) {
            console.error('Ошибка отправки приватного файла:', error);
        }
    });
    
    // Отключение
    socket.on('disconnect', () => {
        console.log('👤 Пользователь отключился:', socket.id);
        const username = socket.username;
        
        connectedUsers.delete(socket.id);
        
        if (username) {
            const onlineUsers = Array.from(connectedUsers.values()).map(u => u.username);
            io.emit('online-users', onlineUsers);
            
            io.to('general').emit('user-status', { 
                username: username, 
                status: 'offline' 
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер Родня запущен на порту ${PORT}`);
});

process.on('SIGINT', () => {
    console.log('Закрытие Firebase...');
    process.exit(0);
});
