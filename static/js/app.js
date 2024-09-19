document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButtons = document.querySelectorAll('.sound-button');
    const ageSlider = document.getElementById('ageSlider');

    const sounds = {
        moon: { file: 'moon' },
        sun: { file: 'sun' },
        rock: { file: 'rock' },
        tree: { file: 'tree' }
    };

    let currentAudio = null;

    async function loadSound(soundType, age) {
        const response = await fetch(`/static/sounds/${sounds[soundType].file}_${age}_year_old.mp3`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    }

    async function playSound(soundType) {
        if (currentAudio) {
            currentAudio.stop();
        }

        const age = parseInt(ageSlider.value);
        const audioBuffer = await loadSound(soundType, age);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

        currentAudio = source;

        // Change background color temporarily
        document.body.style.backgroundColor = '#e0f7fa';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 500);
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

    ageSlider.addEventListener('input', () => {
        // Update visuals or any other age-dependent elements if needed
        const age = parseInt(ageSlider.value);
        document.getElementById('ageDisplay').textContent = `${age} years old`;
    });
});
