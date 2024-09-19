document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButtons = document.querySelectorAll('.sound-button');
    const ageSelect = document.getElementById('ageSelect');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');

    const sounds = {
        moon: { file: 'moon' },
        sun: { file: 'sun' },
        rock: { file: 'rock' },
        tree: { file: 'tree' }
    };

    let currentAudio = null;
    let analyser = null;
    let dataArray = null;
    let animationId = null;

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    async function loadSound(soundType, age) {
        const response = await fetch(`/static/sounds/${sounds[soundType].file}_${age}_year_old.mp3`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    }

    async function playSound(soundType) {
        if (currentAudio) {
            currentAudio.stop();
            cancelAnimationFrame(animationId);
        }

        const age = parseInt(ageSelect.value);
        const audioBuffer = await loadSound(soundType, age);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        analyser.connect(audioContext.destination);
        source.start();

        currentAudio = source;

        if (soundType === 'sun') {
            window.location.href = '/sun_call';
            source.onended = () => {
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000); // Wait for 2 seconds before returning to the main page
            };
        } else {
            function drawVisualizer() {
                animationId = requestAnimationFrame(drawVisualizer);

                analyser.getByteFrequencyData(dataArray);

                canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

                const barWidth = (canvas.width / bufferLength) * 2.5;
                let barHeight;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i] * 2;

                    const hue = (i / bufferLength) * 360;
                    canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                    
                    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                    x += barWidth + 1;
                }

                // Add circular visualizer
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                const radius = Math.min(centerX, centerY) * 0.8;

                canvasCtx.beginPath();
                canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();

                for (let i = 0; i < bufferLength; i++) {
                    const angle = (i / bufferLength) * 2 * Math.PI;
                    const length = (dataArray[i] / 255) * radius;

                    const x1 = centerX + Math.cos(angle) * radius;
                    const y1 = centerY + Math.sin(angle) * radius;
                    const x2 = centerX + Math.cos(angle) * (radius - length);
                    const y2 = centerY + Math.sin(angle) * (radius - length);

                    canvasCtx.beginPath();
                    canvasCtx.moveTo(x1, y1);
                    canvasCtx.lineTo(x2, y2);
                    canvasCtx.strokeStyle = `hsl(${(i / bufferLength) * 360}, 100%, 50%)`;
                    canvasCtx.lineWidth = 2;
                    canvasCtx.stroke();
                }
            }

            drawVisualizer();
        }
    }

    soundButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            const soundType = button.dataset.sound;
            playSound(soundType);
        });
    });

    ageSelect.addEventListener('change', () => {
        const age = parseInt(ageSelect.value);
        document.getElementById('ageDisplay').textContent = `${age} years old`;
    });
});
