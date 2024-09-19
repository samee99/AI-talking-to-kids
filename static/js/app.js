document.addEventListener('DOMContentLoaded', () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const soundButton = document.getElementById('soundButton');
    const pitchSlider = document.getElementById('pitchSlider');

    let oscillator = null;
    let gainNode = null;

    function createSound() {
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        
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

    soundButton.addEventListener('click', () => {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        createSound();
        
        // Change background color temporarily
        document.body.style.backgroundColor = '#e0f7fa';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 500);
    });

    pitchSlider.addEventListener('input', () => {
        const pitchValue = parseFloat(pitchSlider.value);
        if (oscillator) {
            oscillator.detune.setValueAtTime(1200 * Math.log2(pitchValue), audioContext.currentTime);
        }
    });
});
