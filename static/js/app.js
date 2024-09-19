document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButtons = document.querySelectorAll('.sound-button');
    const pitchSlider = document.getElementById('pitchSlider');

    const sounds = {
        moon: { frequency: 220, waveform: 'sine' },
        sun: { frequency: 440, waveform: 'square' },
        rock: { frequency: 330, waveform: 'triangle' },
        tree: { frequency: 110, waveform: 'sawtooth' }
    };

    let oscillator = null;
    let gainNode = null;

    function createSound(soundType) {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.type = sounds[soundType].waveform;
        oscillator.frequency.setValueAtTime(sounds[soundType].frequency, audioContext.currentTime);
        
        const pitchValue = parseFloat(pitchSlider.value);
        oscillator.detune.setValueAtTime(1200 * Math.log2(pitchValue), audioContext.currentTime);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
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

    pitchSlider.addEventListener('input', () => {
        const pitchValue = parseFloat(pitchSlider.value);
        if (oscillator) {
            oscillator.detune.setValueAtTime(1200 * Math.log2(pitchValue), audioContext.currentTime);
        }
    });
});
