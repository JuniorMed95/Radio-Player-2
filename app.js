import * as THREE from 'three';

class RadioPlayer {
    constructor() {
        this.audio = new Audio('https://media.radiostreamingjm.com/listen/radiojmrockpop/radio.mp3');
        this.audio.crossOrigin = "anonymous";
        this.audio.volume = 1;
        this.isPlaying = false;
        this.pendingPlay = false;

        this.setupUI();
        this.setupVisualizer();
        this.setupMetadataUpdates();
        this.createBackgroundImage();
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    setupUI() {
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.volumeControl = document.getElementById('volume');
        this.volumePercent = document.getElementById('volumePercent');
        
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.volumeControl.addEventListener('input', (e) => {
            this.audio.volume = e.target.value;
            this.volumePercent.textContent = `${Math.round(e.target.value * 100)}%`;
        });
        
        // Initialize volume percentage display
        this.volumePercent.textContent = `${Math.round(this.audio.volume * 100)}%`;
    }

    async setupMetadataUpdates() {
        const updateMetadata = async () => {
            try {
                const response = await fetch('https://media.radiostreamingjm.com/api/nowplaying/radiojmrockpop');
                const data = await response.json();
                
                document.getElementById('track-title').textContent = data.now_playing.song.title;
                document.getElementById('track-artist').textContent = data.now_playing.song.artist;
                const artUrl = data.now_playing.song.art || '';
                document.getElementById('song-art').src = artUrl;
                
                // Update background image
                if (artUrl) {
                    this.bgImage.src = artUrl;
                    await this.updateVisualizerColor(artUrl);
                }
            } catch (error) {
                console.error('Error fetching metadata:', error);
            }
        };

        await updateMetadata();
        setInterval(updateMetadata, 10000);
    }

    async togglePlay() {
        if (this.pendingPlay) return;
        this.pendingPlay = true;
        
        try {
            if (!this.isPlaying) {
                // Create new audio element with fresh stream
                if (this.audioContext) {
                    await this.audioContext.close();
                    this.audioContext = null;
                }
                
                this.audio = new Audio(`https://media.radiostreamingjm.com/listen/radiojmrockpop/radio.mp3?t=${Date.now()}`);
                this.audio.crossOrigin = "anonymous";
                this.audio.volume = this.volumeControl.value;
                
                this.setupAudioContext();
                await this.audio.play();
                this.isPlaying = true;
            } else {
                this.audio.pause();
                this.isPlaying = false;
            }
            
            this.updatePlayButton();
        } catch (err) {
            console.error('Playback error:', err);
            this.isPlaying = false;
            this.updatePlayButton();
        } finally {
            this.pendingPlay = false;
        }
    }

    updatePlayButton() {
        this.playPauseBtn.querySelector('.play-icon').style.display = this.isPlaying ? 'none' : 'block';
        this.playPauseBtn.querySelector('.pause-icon').style.display = this.isPlaying ? 'block' : 'none';
    }

    setupAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.analyser.fftSize = 2048;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    setupVisualizer() {
        const container = document.getElementById('visualizer');
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Create frequency bars geometry
        this.barsGeometry = new THREE.BufferGeometry();
        const numBars = 256;
        const positions = new Float32Array(numBars * 3);
        
        // Initialize bars across screen width
        for(let i = 0; i < numBars; i++) {
            positions[i * 3] = (i / (numBars - 1)) * 2 - 1; // X position (-1 to 1)
            positions[i * 3 + 1] = -0.95; // Base Y position at bottom
        }
        
        this.barsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Create bar material
        this.barMaterial = new THREE.LineBasicMaterial({
            color: 0x9fffcb,
            linewidth: 2
        });
        
        this.waveLine = new THREE.Line(this.barsGeometry, this.barMaterial);
        this.scene.add(this.waveLine);
        
        this.camera.position.z = 1;
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.analyser) {
            // Get frequency domain data
            this.analyser.getByteFrequencyData(this.dataArray);
            
            const positions = this.barsGeometry.attributes.position.array;
            
            // Update Y positions based on frequency data
            for(let i = 0; i < this.dataArray.length; i++) {
                const value = this.dataArray[i] / 255 * 1.5; // Normalize and scale
                positions[i * 3 + 1] = -0.95 + value;
            }
            
            this.barsGeometry.attributes.position.needsUpdate = true;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    handleResize() {
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    updateVisualizerColor() {}

    createBackgroundImage() {
        this.bgImage = document.createElement('img');
        this.bgImage.className = 'bg-image';
        document.body.insertBefore(this.bgImage, document.body.firstChild);
    }
}

window.addEventListener('load', () => {
    new RadioPlayer();
});
