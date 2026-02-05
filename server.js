const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Подключено к MongoDB');
}).catch((err) => {
    console.error('❌ Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
});

// Схемы MongoDB
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    fromUser: { type: String, required: true },
    toUser: { type: String, required: true },
    message: String,
    filename: String,
    originalname: String,
    url: String,
    mimetype: String,
    caption: String,
    type: { type: String, default: 'text' },
    isGeneral: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

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
        fileSize: 50 * 1024 * 1024 // 50MB лимит
    }
});

// Статические файлы
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Отключаем кеш для HTML
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

// Socket.IO для реального времени
const connectedUsers = new Map(); // socket.id -> {username, socketId}

io.on('connection', (socket) => {
    console.log('👤 Пользователь подключился:', socket.id);
    console.log('📊 Всего подключено:', connectedUsers.size + 1);
    
    // Присоединение к общему чату
    socket.join('general');
    
    // Регистрация пользователя
    socket.on('register', async (data) => {
        try {
            const { username, password } = data;
            
            console.log('Попытка регистрации:', username);
            
            if (!username || !password) {
                console.log('❌ Пустые поля');
                socket.emit('register-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            if (username.length < 3) {
                console.log('❌ Имя слишком короткое');
                socket.emit('register-response', { success: false, message: 'Имя должно быть минимум 3 символа' });
                return;
            }
            
            if (password.length < 3) {
                console.log('❌ Пароль слишком короткий');
                socket.emit('register-response', { success: false, message: 'Пароль должен быть минимум 3 символа' });
                return;
            }
            
            // Проверяем существует ли пользователь
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                console.log('❌ Пользователь уже существует:', username);
                socket.emit('register-response', { success: false, message: 'Пользователь уже существует' });
                return;
            }
            
            // Создаем нового пользователя
            const newUser = new User({ username, password });
            await newUser.save();
            
            console.log('✅ Пользователь зарегистрирован:', username);
            socket.emit('register-response', { success: true, message: 'Регистрация успешна' });
            
            // Отправляем обновленный список пользователей всем
            const users = await User.find({}, 'username');
            const usersList = users.map(u => u.username);
            io.emit('users-list', usersList);
            
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error.message);
            socket.emit('register-response', { success: false, message: 'Ошибка сервера: ' + error.message });
        }
    });
    
    // Вход пользователя
    socket.on('login', async (data) => {
        try {
            const { username, password } = data;
            
            console.log('Попытка входа:', username);
            
            if (!username || !password) {
                socket.emit('login-response', { success: false, message: 'Заполните все поля' });
                return;
            }
            
            // Ищем пользователя в БД
            const user = await User.findOne({ username });
            
            if (!user) {
                console.log('❌ Пользователь не найден:', username);
                socket.emit('login-response', { success: false, message: 'Пользователь не найден' });
                return;
            }
            
            if (user.password !== password) {
                console.log('❌ Неверный пароль для:', username);
                socket.emit('login-response', { success: false, message: 'Неверный пароль' });
                return;
            }
            
            // Сохраняем сессию
            socket.username = username;
            connectedUsers.set(socket.id, { username, socketId: socket.id });
            
            console.log('✅ Пользователь вошел:', username);
            socket.emit('login-response', { success: true, message: 'Вход успешен' });
            
            // Отправляем список всех пользователей
            const users = await User.find({}, 'username');
            const usersList = users.map(u => u.username);
            socket.emit('users-list', usersList);
            
            // Отправляем список онлайн пользователей
            const onlineUsers = Array.from(connectedUsers.values()).map(u => u.username);
            io.emit('online-users', onlineUsers);
            
            // Отправляем историю общего чата
            const messages = await Message.find({ isGeneral: 1 }).sort({ createdAt: 1 }).limit(100);
            const formattedMessages = messages.map(msg => ({
                id: msg._id.toString(),
                username: msg.fromUser,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.createdAt,
                type: msg.type
            }));
            socket.emit('load-general-messages', formattedMessages);
            
            // Уведомляем всех что пользователь онлайн
            io.to('general').emit('user-status', { 
                username: username, 
                status: 'online' 
            });
            
        } catch (error) {
            console.error('❌ Ошибка входа:', error.message);
            socket.emit('login-response', { success: false, message: 'Ошибка сервера: ' + error.message });
        }
    });
    
    // Загрузка истории приватного чата
    socket.on('load-private-messages', async (data) => {
        try {
            const currentUser = socket.username;
            const otherUser = data.username;
            
            if (!currentUser) return;
            
            const messages = await Message.find({
                isGeneral: 0,
                $or: [
                    { fromUser: currentUser, toUser: otherUser },
                    { fromUser: otherUser, toUser: currentUser }
                ]
            }).sort({ createdAt: 1 }).limit(100);
            
            const formattedMessages = messages.map(msg => ({
                id: msg._id.toString(),
                from: msg.fromUser,
                to: msg.toUser,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.createdAt,
                type: msg.type
            }));
            socket.emit('private-messages-loaded', formattedMessages);
            
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
        }
    });
    
    // Загрузка истории общего чата
    socket.on('load-general-chat', async (data) => {
        try {
            const messages = await Message.find({ isGeneral: 1 }).sort({ createdAt: 1 }).limit(100);
            const formattedMessages = messages.map(msg => ({
                id: msg._id.toString(),
                username: msg.fromUser,
                message: msg.message,
                filename: msg.filename,
                originalname: msg.originalname,
                url: msg.url,
                mimetype: msg.mimetype,
                caption: msg.caption,
                timestamp: msg.createdAt,
                type: msg.type
            }));
            socket.emit('load-general-messages', formattedMessages);
        } catch (error) {
            console.error('Ошибка загрузки общего чата:', error);
        }
    });
    
    // Обработка сообщений в общий чат
    socket.on('send-message', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const message = new Message({
                fromUser: username,
                toUser: 'general',
                message: data.message,
                type: 'text',
                isGeneral: 1
            });
            await message.save();
            
            const formattedMessage = {
                id: message._id.toString(),
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
    
    // Обработка файлов в общий чат
    socket.on('send-file', async (data) => {
        try {
            const username = socket.username;
            if (!username) return;
            
            const message = new Message({
                fromUser: username,
                toUser: 'general',
                filename: data.filename,
                originalname: data.originalname,
                url: data.url,
                mimetype: data.mimetype,
                caption: data.caption || '',
                type: 'file',
                isGeneral: 1
            });
            await message.save();
            
            const formattedMessage = {
                id: message._id.toString(),
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
            await Message.findByIdAndDelete(data.id);
            io.emit('message-deleted', { id: data.id });
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
        }
    });
    
    // Личные сообщения
    socket.on('send-private-message', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, message } = data;
            
            const msg = new Message({
                fromUser: senderUsername,
                toUser: recipientUsername,
                message: message,
                type: 'text',
                isGeneral: 0
            });
            await msg.save();
            
            // Находим socket ID получателя
            let recipientSocketId = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    break;
                }
            }
            
            const formattedMessage = {
                id: msg._id.toString(),
                from: senderUsername,
                to: recipientUsername,
                message: message,
                timestamp: new Date().toLocaleString('ru-RU'),
                type: 'text'
            };
            
            // Отправляем отправителю
            socket.emit('private-message', formattedMessage);
            
            // Отправляем получателю если онлайн
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('private-message', formattedMessage);
            }
            
        } catch (error) {
            console.error('Ошибка отправки приватного сообщения:', error);
        }
    });
    
    // Личные файлы
    socket.on('send-private-file', async (data) => {
        try {
            const senderUsername = socket.username;
            if (!senderUsername) return;
            
            const { recipientUsername, filename, originalname, url, mimetype, caption } = data;
            
            const msg = new Message({
                fromUser: senderUsername,
                toUser: recipientUsername,
                filename: filename,
                originalname: originalname,
                url: url,
                mimetype: mimetype,
                caption: caption || '',
                type: 'file',
                isGeneral: 0
            });
            await msg.save();
            
            // Находим socket ID получателя
            let recipientSocketId = null;
            for (const [socketId, user] of connectedUsers.entries()) {
                if (user.username === recipientUsername) {
                    recipientSocketId = socketId;
                    break;
                }
            }
            
            const formattedMessage = {
                id: msg._id.toString(),
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
            
            // Отправляем отправителю
            socket.emit('private-message', formattedMessage);
            
            // Отправляем получателю если онлайн
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Закрытие подключения к MongoDB...');
    mongoose.connection.close();
    process.exit(0);
});
