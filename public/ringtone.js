// Функция для воспроизведения рингтона
function playRingtone() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Создаём последовательность звуков для рингтона
        const now = audioContext.currentTime;
        const duration = 0.5;
        const gap = 0.2;
        
        // Первый звук (высокий)
        playTone(audioContext, 800, now, duration);
        playTone(audioContext, 800, now + duration + gap, duration);
        
        // Второй звук (низкий)
        playTone(audioContext, 600, now + (duration + gap) * 2, duration);
        playTone(audioContext, 600, now + (duration + gap) * 3, duration);
        
    } catch (error) {
        console.error('Ошибка воспроизведения рингтона:', error);
    }
}

function playTone(audioContext, frequency, startTime, duration) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

// Функция для повторного воспроизведения рингтона каждые 3 секунды
let ringtoneInterval = null;

function startRingtone() {
    playRingtone();
    ringtoneInterval = setInterval(() => {
        playRingtone();
    }, 2000);
}

function stopRingtone() {
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
}
