document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButtons = document.querySelectorAll('.sound-button');
    const ageSelect = document.getElementById('ageSelect');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const callOverlay = document.getElementById('call-overlay');
    const callTimer = document.getElementById('call-timer');
    const callObjectName = document.getElementById('call-object-name');
    const endCallButton = document.getElementById('end-call-button');
    const talkBackButton = document.getElementById('talk-back-button');

    const sounds = {
        moon: { file: 'moon', image: new Image() },
        sun: { file: 'sun', image: new Image() },
        rock: { file: 'rock', image: new Image() },
        tree: { file: 'tree', image: new Image() }
    };

    for (const [key, value] of Object.entries(sounds)) {
        value.image.src = `/static/images/${key}.jpg`;
    }

    let currentAudio = null;
    let analyser = null;
    let dataArray = null;
    let animationId = null;
    let callStartTime = null;
    let callTimerInterval = null;
    let currentSoundType = null;

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

    function updateCallTimer() {
        const now = Date.now();
        const elapsedTime = Math.floor((now - callStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
        const seconds = (elapsedTime % 60).toString().padStart(2, '0');
        callTimer.textContent = `${minutes}:${seconds}`;
    }

    function showCallOverlay(soundType) {
        callOverlay.classList.remove('hidden');
        callObjectName.textContent = soundType.charAt(0).toUpperCase() + soundType.slice(1);
        callStartTime = Date.now();
        updateCallTimer();
        callTimerInterval = setInterval(updateCallTimer, 1000);
        resizeCanvas();
        currentSoundType = soundType;
        drawVisualizer();
    }

    function hideCallOverlay() {
        callOverlay.classList.add('hidden');
        clearInterval(callTimerInterval);
        callTimer.textContent = '00:00';
        cancelAnimationFrame(animationId);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        currentSoundType = null;
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

        showCallOverlay(soundType);
        console.log('Current sound type updated:', soundType);

        source.onended = () => {
            hideCallOverlay();
        };
    }

    function drawVisualizer() {
        if (callOverlay.classList.contains('hidden')) {
            return;
        }

        animationId = requestAnimationFrame(drawVisualizer);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;

        const image = sounds[currentSoundType].image;
        const imageSize = radius * 2;
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        canvasCtx.clip();
        canvasCtx.drawImage(image, centerX - radius, centerY - radius, imageSize, imageSize);
        canvasCtx.restore();

        for (let i = 0; i < dataArray.length; i++) {
            const angle = (i / dataArray.length) * 2 * Math.PI;
            const length = (dataArray[i] / 255) * radius * 0.5;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius - length);
            const y2 = centerY + Math.sin(angle) * (radius - length);

            canvasCtx.beginPath();
            canvasCtx.moveTo(x1, y1);
            canvasCtx.lineTo(x2, y2);
            canvasCtx.strokeStyle = `hsla(${(i / dataArray.length) * 360}, 100%, 50%, 0.8)`;
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
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

    endCallButton.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.stop();
        }
        hideCallOverlay();
    });

    talkBackButton.addEventListener('click', () => {
        fetch('/check-auth')
            .then(response => response.json())
            .then(data => {
                if (data.authenticated) {
                    showTalkBackModal();
                } else {
                    showAuthModal();
                }
            });
    });

    function showAuthModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="auth-modal">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">Sign Up or Sign In</h3>
                        <div class="mt-2 px-7 py-3">
                            <p class="text-sm text-gray-500">
                                You need to sign up or sign in to use the Talk Back feature.
                            </p>
                        </div>
                        <div class="items-center px-4 py-3">
                            <button id="sign-up-btn" class="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300">
                                Sign Up
                            </button>
                            <button id="sign-in-btn" class="mt-3 px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                                Sign In
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('sign-up-btn').addEventListener('click', () => {
            window.location.href = '/signup';
        });
        document.getElementById('sign-in-btn').addEventListener('click', () => {
            window.location.href = '/signin';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    function showTalkBackModal() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="talk-back-modal">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">Talk to ${currentSoundType}</h3>
                        <div class="mt-2 px-7 py-3">
                            <textarea id="user-message" class="w-full p-2 border rounded" rows="4" placeholder="Type your message here..."></textarea>
                        </div>
                        <div class="items-center px-4 py-3">
                            <button id="send-message-btn" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                                Send Message
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('send-message-btn').addEventListener('click', () => {
            const userMessage = document.getElementById('user-message').value;
            if (userMessage.trim() !== '') {
                sendMessageToAI(userMessage);
                document.body.removeChild(modal);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    async function sendMessageToAI(message) {
        try {
            console.log('Sending message to AI:', message);
            console.log('Current sound type:', currentSoundType);
            console.log('Selected age:', ageSelect.value);
            
            if (!currentSoundType) {
                throw new Error('No object selected. Please select an object before sending a message.');
            }

            const requestBody = {
                message: message,
                object: currentSoundType,
                age: parseInt(ageSelect.value)
            };
            
            console.log('Request body:', JSON.stringify(requestBody));

            const response = await fetch('/generate-response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            console.log('Received response from server:', data);
            playAIResponse(data.text, data.audio_url);
        } catch (error) {
            console.error('Error in sendMessageToAI:', error);
            alert(`An error occurred while processing your message: ${error.message}. Please try again.`);
        }
    }

    async function playAIResponse(text, audioUrl) {
        console.log('Playing AI response:', text, audioUrl);
        const responseModal = document.createElement('div');
        responseModal.innerHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="ai-response-modal">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3 text-center">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">${currentSoundType}'s Response</h3>
                        <div class="mt-2 px-7 py-3">
                            <p id="ai-response-text" class="text-sm text-gray-500">${text}</p>
                        </div>
                        <div class="items-center px-4 py-3">
                            <button id="close-response-btn" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(responseModal);

        document.getElementById('close-response-btn').addEventListener('click', () => {
            document.body.removeChild(responseModal);
        });

        try {
            const audio = new Audio(audioUrl);
            await audio.play();
            console.log('Audio playback started');

            const source = audioContext.createMediaElementSource(audio);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            analyser.connect(audioContext.destination);

            drawVisualizer();

            audio.onended = () => {
                console.log('Audio playback ended');
                cancelAnimationFrame(animationId);
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            };
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('An error occurred while playing the audio. Please try again.');
        }
    }
});