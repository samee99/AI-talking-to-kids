document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButtons = document.querySelectorAll('.sound-button');
    const ageSlider = document.getElementById('ageSlider');

    const sounds = {
        moon: { baseFrequency: 220, waveform: 'sine' },
        sun: { baseFrequency: 440, waveform: 'square' },
        rock: { baseFrequency: 330, waveform: 'triangle' },
        tree: { baseFrequency: 110, waveform: 'sawtooth' }
    };

    let oscillator = null;
    let gainNode = null;

    function createSound(soundType) {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        const age = parseInt(ageSlider.value);
        const complexityFactor = (age - 5) / 5; // 0 for 5-year-old, 1 for 10-year-old

        oscillator.type = sounds[soundType].waveform;
        const frequency = sounds[soundType].baseFrequency * (1 + complexityFactor * 0.5);
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + (0.5 + complexityFactor * 0.5));

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + (0.5 + complexityFactor * 0.5));

        // Add harmonics for older ages
        if (age > 7) {
            const harmonicOscillator = audioContext.createOscillator();
            harmonicOscillator.type = 'sine';
            harmonicOscillator.frequency.setValueAtTime(frequency * 2, audioContext.currentTime);
            harmonicOscillator.connect(gainNode);
            harmonicOscillator.start();
            harmonicOscillator.stop(audioContext.currentTime + (0.5 + complexityFactor * 0.5));
        }
    }

    soundButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            const soundType = button.dataset.sound;
            createSound(soundType);
            
            // Change background color temporarily
            document.body.style.backgroundColor = '#e0f7fa';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
            }, 500);
        });
    });

    ageSlider.addEventListener('input', () => {
        // Update visuals or any other age-dependent elements if needed
    });
});
