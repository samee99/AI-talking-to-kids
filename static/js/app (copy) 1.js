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
    const listeningStatus = document.getElementById('listening-status');

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
    let isUserSignedIn = false;
    let recognition = null;
    let recognitionState = 'idle';

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

    async function showCallOverlay(soundType) {
        callOverlay.classList.remove('hidden');
        callObjectName.textContent = soundType.charAt(0).toUpperCase() + soundType.slice(1);
        callStartTime = Date.now();
        updateCallTimer();
        callTimerInterval = setInterval(updateCallTimer, 1000);
        resizeCanvas();
        currentSoundType = soundType;
        drawVisualizer();

        await sendMessageToAI("Hello", true);
    }

    function hideCallOverlay() {
        callOverlay.classList.add('hidden');
        clearInterval(callTimerInterval);
        callTimer.textContent = '00:00';
        cancelAnimationFrame(animationId);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (recognition) {
            recognition.stop();
        }
    }

    async function checkUserAuthentication() {
        const response = await fetch('/check-auth');
        const data = await response.json();
        isUserSignedIn = data.authenticated;
        return isUserSignedIn;
    }

    async function playSound(soundType) {
        if (currentAudio) {
            currentAudio.stop();
            cancelAnimationFrame(animationId);
        }

        const isUserSignedIn = await checkUserAuthentication();
        const age = parseInt(ageSelect.value);

        if (isUserSignedIn) {
            showCallOverlay(soundType);
            await sendMessageToAI("Hello", true);
        } else {
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
            currentSoundType = soundType;

            showCallOverlay(soundType);

            source.onended = () => {
                hideCallOverlay();
            };
        }
    }

    function drawVisualizer() {
        if (callOverlay.classList.contains('hidden') || !analyser) {
            console.log('Analyser not initialized or call overlay is hidden');
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

    async function checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Error accessing microphone:', err);
            return false;
        }
    }

    function playBeep() {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // 880 Hz (A5)
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1); // 100ms duration
    }

    async function startContinuousListening() {
        // Check if SpeechRecognition is supported
        if (!('webkitSpeechRecognition' in window)) {
            alert("Speech recognition is not supported in your browser. Please use Chrome or Edge.");
            return;
        }

        // Check for microphone permissions
        const hasMicrophonePermission = await checkMicrophonePermission();
        if (!hasMicrophonePermission) {
            alert("Unable to access the microphone. Please make sure you've granted microphone permissions to this website in your browser settings.");
            return;
        }

        // Make sure we don't start multiple recognition sessions
        if (recognitionState === 'listening' || recognitionState === 'processing') {
            console.log('Recognition is already running. Current state:', recognitionState);
            return;
        }

        // Initialize SpeechRecognition if not already initialized
        if (!recognition) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = false; // Stop after one result, we will restart it manually
            recognition.interimResults = false; // Get only final results

            recognition.onstart = () => {
                recognitionState = 'listening';
                listeningStatus.textContent = "Listening...";
                console.log('Recognition started');
                playBeep(); // Play beep sound when recognition starts
            };

            recognition.onresult = (event) => {
                recognitionState = 'processing';
                const transcript = event.results[0][0].transcript;
                listeningStatus.textContent = "Processing...";
                console.log('Recognition result:', transcript);
                sendMessageToAI(transcript); // Send the recognized speech to AI
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                listeningStatus.textContent = "Error occurred: " + event.error;
                recognitionState = 'idle';

                // Retry recognition unless the error is 'aborted'
                if (event.error !== 'aborted') {
                    setTimeout(() => {
                        console.log('Retrying recognition after error...');
                        recognition.start();
                    }, 500);
                }
            };

            recognition.onend = () => {
                console.log('Recognition ended. Current state:', recognitionState);
                if (recognitionState === 'processing') {
                    recognitionState = 'idle';
                } else {
                    // If the call overlay is visible, restart recognition
                    if (!callOverlay.classList.contains('hidden')) {
                        console.log("Restarting recognition...");
                        recognitionState = 'idle';
                        recognition.start();
                    }
                }
            };
        }

        // Start recognition only if idle
        if (recognitionState === 'idle') {
            recognition.start();
        }
    }


    async function sendMessageToAI(message, isInitialGreeting = false) {
        try {
            // Prevent sending the message twice if recognition is not idle and this isn't an initial greeting
            if (recognitionState !== 'idle' && !isInitialGreeting) {
                console.log('Recognition is not idle. Current state:', recognitionState);
                return;
            }

            listeningStatus.textContent = "AI is thinking...";

            if (!currentSoundType) {
                throw new Error('No object selected. Please select an object before sending a message.');
            }

            const requestBody = {
                message: message,
                object: currentSoundType,
                age: parseInt(ageSelect.value),
                is_initial_greeting: isInitialGreeting
            };

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
            await playAIResponse(data.text, data.audio_url);

            // Start continuous listening only after the AI finishes speaking
            if (isInitialGreeting) {
                startContinuousListening();  // Trigger only after the greeting
            } else if (recognitionState === 'idle') {
                recognition.start();  // Restart recognition after AI finishes speaking
            }

        } catch (error) {
            console.error('Error in sendMessageToAI:', error);
            alert(`An error occurred while processing your message: ${error.message}. Please try again.`);
            listeningStatus.textContent = "Click to speak";
            hideCallOverlay();
        }
    }

    async function playAIResponse(text, audioUrl) {
        listeningStatus.textContent = "AI is speaking...";

        try {
            const audio = new Audio(audioUrl);
            await audio.play();

            const source = audioContext.createMediaElementSource(audio);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            analyser.connect(audioContext.destination);

            drawVisualizer();

            audio.onended = () => {
                cancelAnimationFrame(animationId);
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                listeningStatus.textContent = "Listening...";
                if (recognition && recognitionState === 'idle') {
                    recognition.start();  // Restart recognition only when idle
                }
            };
        } catch (error) {
            console.error('Error playing audio:', error);
            alert('An error occurred while playing the audio. Please try again.');
            listeningStatus.textContent = "Click to speak";
            if (recognition && recognitionState === 'idle') {
                recognition.start();  // Restart recognition only when idle
            }
        }
    }


    checkUserAuthentication().then((authenticated) => {
        if (authenticated) {
            console.log('User is signed in');
        } else {
            console.log('User is not signed in');
        }
    });
});
