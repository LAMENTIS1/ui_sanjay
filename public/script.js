const leftEye = document.getElementById('leftEye');
const rightEye = document.getElementById('rightEye');
const listeningContainer = document.getElementById('listeningContainer');
const eyesContainer = document.querySelector('.eyes-wrapper');
const audioBars = Array.from(document.querySelectorAll('.audio-bar'));
const recordingIndicator = document.getElementById('recordingIndicator');
const toggle = document.getElementById('toggle');
const longpressIndicator = document.getElementById('longpressIndicator');
const body = document.body;
const transcriptContainer = document.getElementById('transcript-container');
const transcriptText = document.getElementById('transcript-text');
const emotionColors = {
    default: '#00FFFF',
    thinking: '#00FFFF',
    happy: '#00FFFF',
    curious: '#00FFFF',
    surprised: '#00FFFF',
    blinking: '#00FFFF',
    angry: '#f87171', 
    fear: '#c084fc',
    disgust: '#4ade80',
    listening: '#00FFFF'
};
let currentEmotion = 'default';
let audioVisualizationInterval = null;
let currentAmplitude = 3;
let isRecording = false;
let longPressTimer = null;
let longPressActive = false;
const LONG_PRESS_DURATION = 1500; // 1.5 seconds for long press
let speechSynthesis = window.speechSynthesis;
let speaking = false;
// Add this flag to track when API is being processed
let isProcessingAPI = false;

const noiseSeed = Array(20).fill(0).map(() => Math.random() * 2 - 1);
let seedPosition = 0;
function applyEmotion(emotion) {
    const emotionClasses = [
        'emotion-blinking', 'emotion-thinking', 'emotion-happy', 
        'emotion-surprised', 'emotion-curious', 'emotion-angry', 
        'emotion-fear', 'emotion-disgust', 'emotion-listening'
    ];
    
    leftEye.classList.remove(...emotionClasses);
    rightEye.classList.remove(...emotionClasses);
    if (emotion !== 'default' && emotion !== 'listening') {
        leftEye.classList.add(`emotion-${emotion}`);
        rightEye.classList.add(`emotion-${emotion}`);
    }
    const color = emotionColors[emotion];
    leftEye.style.backgroundColor = color;
    rightEye.style.backgroundColor = color;
    audioBars.forEach(bar => {
        bar.style.backgroundColor = color;
    });
    if (emotion === 'listening') {
        eyesContainer.style.opacity = '0';
        isRecording = true;
        recordingIndicator.classList.add('active');
        listeningContainer.classList.add('active');
        startRecordingVisualization();
    } else {
        clearInterval(audioVisualizationInterval);
        isRecording = false;
        recordingIndicator.classList.remove('active');
        listeningContainer.classList.remove('active');
        eyesContainer.style.opacity = '1';
    }
}
function setEmotion(emotion) {
    currentEmotion = emotion;
    applyEmotion(emotion);
    if (emotion !== 'listening' && emotion !== 'default' && emotion !== 'thinking') {
        setTimeout(() => {
            currentEmotion = 'default';
            applyEmotion('default');
        }, 1000);
    }
}
function getNoise() {
    seedPosition = (seedPosition + 1) % noiseSeed.length;
    return noiseSeed[seedPosition];
}
function startRecordingVisualization() {
    clearInterval(audioVisualizationInterval);
    
    const centerValues = [2.5, 3, 4, 4.5, 4, 3, 2.5];
    
    audioBars.forEach((bar, index) => {
        bar.style.height = `${centerValues[index]}rem`;
    });
    
    setInterval(() => {
        if (Math.random() < 0.3) {
            currentAmplitude = 2 + Math.random() * 2.5;
        }
    }, 800);
    
    audioVisualizationInterval = setInterval(() => {
        audioBars.forEach((bar, index) => {
            const centerFactor = 1 - Math.abs(index - 3) / 3.5;
            const baseHeight = 2 + (centerFactor * currentAmplitude);
            const noise = getNoise() * 0.7;
            const height = Math.max(1.5, baseHeight + noise);
            
            bar.style.height = `${height}rem`;
            bar.style.opacity = 0.7 + (height - 2) * 0.1;
        });
    }, 80);
}

function initBlinking() {
    setInterval(() => {
        if (currentEmotion === 'default' && toggle.checked) {
            setEmotion('blinking');
        }
    }, 4000);
}
function initRandomEmotions() {
    setInterval(() => {
        if (currentEmotion === 'default' && Math.random() < 0.3 && toggle.checked) {
            const emotions = ['thinking', 'happy', 'curious', 'surprised'];
            const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
            setEmotion(randomEmotion);
        }
    }, 3000);
}
function simulateSpeechPattern() {
    setInterval(() => {
        if (isRecording) {
            if (Math.random() < 0.1) {
                currentAmplitude = 1;
                setTimeout(() => {
                    currentAmplitude = 2 + Math.random() * 2.5;
                }, 300 + Math.random() * 400);
            }
            
            if (Math.random() < 0.15) {
                currentAmplitude = 4 + Math.random();
                setTimeout(() => {
                    currentAmplitude = 2 + Math.random() * 2.5;
                }, 200 + Math.random() * 300);
            }
        }
    }, 1000);
}
// Long Press Handlers
function startLongPress(event) {
    if (longPressActive || !toggle.checked || isProcessingAPI) return;
    
    longPressActive = true;
    
    // Position the indicator near where the user is pressing
    const x = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
    const y = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
    
    longpressIndicator.style.left = (x - 60) + 'px'; // Center the 120px wide indicator
    longpressIndicator.style.top = (y - 60) + 'px';  // Center the 120px tall indicator
    
    // Start long press timer
    longPressTimer = setTimeout(() => {
        // Toggle between listening and default
        if (currentEmotion === 'listening') {
            setEmotion('default');
            stopListening();
        } else {
            setEmotion('listening');
            startListening();
        }
        longpressIndicator.classList.remove('active');
        longPressActive = false;
    }, LONG_PRESS_DURATION);
    
    // Show the indicator
    longpressIndicator.classList.add('active');
}
function cancelLongPress() {
    if (!longPressActive) return;
    
    clearTimeout(longPressTimer);
    longpressIndicator.classList.remove('active');
    longPressActive = false;
}
// Speech Recognition Implementation
let recognition = null;
let silenceTimeout = null;
let isFinalResult = false;
let isListening = false;
function initializeSpeechRecognition() {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        console.error('Speech recognition not supported in this browser');
        return null;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const newRecognition = new SpeechRecognition();
    newRecognition.continuous = true;
    newRecognition.interimResults = true;
    newRecognition.maxAlternatives = 1;
    newRecognition.lang = 'en-US';
    
    return newRecognition;
}
function startListening() {
    // Don't start if already listening, toggle is off, or API is processing
    if (isListening || !toggle.checked || isProcessingAPI) return;
    
    try {
        if (recognition) {
            recognition.stop();
        }
        recognition = initializeSpeechRecognition();
        if (!recognition) {
            console.error('Could not initialize speech recognition');
            return;
        }
        
        // Show transcript container
        transcriptContainer.style.opacity = '1';
        transcriptText.textContent = 'Listening...';
        
        // Set up event handlers
        recognition.onstart = function() {
            isListening = true;
            setEmotion('listening');
            console.log('Speech recognition started');
        };
        recognition.onresult = function(event) {
            clearTimeout(silenceTimeout);
            const lastResult = event.results[event.results.length - 1];
            const transcript = lastResult[0].transcript.trim();
            isFinalResult = lastResult.isFinal;
            
            transcriptText.textContent = transcript;
            
            // If it's a final result, process it
            if (isFinalResult) {
                processFinalTranscript(transcript);
            } else {
                // Set a timeout for silence detection (2 seconds)
                silenceTimeout = setTimeout(() => {
                    processFinalTranscript(transcript);
                }, 2000);
            }
        };
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // No speech detected, continue listening
                restartRecognition();
            } else if (event.error === 'aborted' || event.error === 'network') {
                stopListening();
            }
        };
        recognition.onend = function() {
            // If ended but we still want to be listening, restart
            if (isListening && toggle.checked && !isProcessingAPI) {
                restartRecognition();
            } else {
                transcriptContainer.style.opacity = '0';
                setTimeout(() => {
                    if (!isListening) {
                        transcriptText.textContent = '';
                    }
                }, 300);
                setEmotion('default');
            }
        };
        recognition.onspeechend = function() {
            // When speech ends but recognition is still active
            console.log('Speech ended, still listening for more');
            // Check if there's transcript to process
            const transcript = transcriptText.textContent;
            if (transcript && transcript !== 'Listening...') {
                processFinalTranscript(transcript);
            }
        };
        recognition.start();
    } catch (error) {
        console.error('Failed to start speech recognition:', error);
        isListening = false;
    }
}
function stopListening() {
    if (recognition) {
        isListening = false;
        recognition.stop();
        setEmotion('default');
        console.log('Speech recognition stopped');
        
        // Hide transcript
        transcriptContainer.style.opacity = '0';
        setTimeout(() => {
            transcriptText.textContent = '';
        }, 300);
    }
}
function restartRecognition() {
    if (isListening && toggle.checked && !isProcessingAPI) {
        setTimeout(() => {
            try {
                recognition.start();
            } catch (error) {
                console.error('Error restarting recognition:', error);
                isListening = false;
                setEmotion('default');
            }
        }, 200);
    }
}
function processFinalTranscript(transcript) {
    if (!transcript || transcript === 'Listening...') return;
    
    console.log('Processing final transcript:', transcript);
    
    // Set the processing flag to true - this indicates we're calling the API
    isProcessingAPI = true;
    
    // Stop listening since we're now processing
    if (isListening) {
        stopListening();
    }
    
    // Show thinking animation while processing
    setEmotion('thinking');
    transcriptText.textContent = 'Processing...';
    
    // Cancel any ongoing speech
    if (speaking) {
        speechSynthesis.cancel();
        speaking = false;
    }
    
    // Send the transcript to the API
    query({ question: transcript })
        .then(response => {
            console.log('API response:', response);
            
            // Display the response
            transcriptText.textContent = response.text;
            
            // Speak the response using text-to-speech
            speakResponse(response.text);
            
            // Reset the processing flag when done
            isProcessingAPI = false;
            
            // Clear transcript after the speech ends or after a delay if speech fails
            setTimeout(() => {
                if (!isListening && !speaking) {
                    transcriptContainer.style.opacity = '0';
                    setTimeout(() => {
                        transcriptText.textContent = '';
                    }, 300);
                }
            }, 5000);
        })
        .catch(error => {
            console.error('API error:', error);
            transcriptText.textContent = 'Sorry, there was an error processing your request.';
            speakResponse('Sorry, there was an error processing your request.');
            setEmotion('default');
            
            // Reset the processing flag even on error
            isProcessingAPI = false;
        });
}
// Add this new function to handle text-to-speech
function speakResponse(text) {
    // Don't attempt to speak if speech synthesis is not available
    if (!speechSynthesis) {
        console.error('Speech synthesis not supported in this browser');
        setEmotion('default');
        return;
    }
    
    // Create a new speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Set voice, rate, pitch, etc.
    utterance.rate = 1.0;  // Speech rate (0.1 to 10)
    utterance.pitch = 1.0; // Speech pitch (0 to 2)
    utterance.volume = 1.0; // Speech volume (0 to 1)
    
    // Optionally select a specific voice
    // Get all available voices
    const voices = speechSynthesis.getVoices();
    // You can choose a specific voice if available
    // Find a voice that sounds good - preferably female and English
    const preferredVoice = voices.find(voice => 
        voice.name.includes('Female') && 
        (voice.lang.includes('en-US') || voice.lang.includes('en-GB'))
    ) || voices[0]; // Fallback to first available voice
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    // Event listeners
    utterance.onstart = () => {
        speaking = true;
        setEmotion('listening'); // Reuse the listening animation for speaking
        console.log('Speech started');
    };
    
    utterance.onend = () => {
        speaking = false;
        setEmotion('default');
        console.log('Speech ended');
        
        // Hide transcript if not listening
        if (!isListening) {
            setTimeout(() => {
                transcriptContainer.style.opacity = '0';
                setTimeout(() => {
                    transcriptText.textContent = '';
                }, 300);
            }, 1000);
        }
    };
    
    utterance.onerror = (event) => {
        speaking = false;
        setEmotion('default');
        console.error('Speech synthesis error:', event);
    };
    
    // Start speaking
    speechSynthesis.speak(utterance);
}
// API query function
async function query(data) {
    try {
        const response = await fetch(
            "https://srivatsavdamaraju-flowise.hf.space/api/v1/prediction/2875301a-c26f-4bd5-ab10-71fa13393541", 
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            }
        );
        
        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API query error:', error);
        throw error;
    }
}
// Initialize all features
initBlinking();
initRandomEmotions();
simulateSpeechPattern();

// Connect to previous listening button functionality
const listenButton = document.querySelector('button[onclick="setEmotion(\'listening\')"]');
if (listenButton) {
    listenButton.addEventListener('click', () => {
        // Don't allow starting listening if we're processing an API call
        if (!isListening && !isProcessingAPI) {
            startListening();
        } else {
            stopListening();
        }
    });
}

// Setup long press events on the document body
document.addEventListener('touchstart', (e) => {
    startLongPress(e);
}, { passive: false });

document.addEventListener('touchend', () => {
    cancelLongPress();
});

document.addEventListener('touchcancel', () => {
    cancelLongPress();
});

// Mouse events for desktop
document.addEventListener('mousedown', (e) => {
    startLongPress(e);
});

document.addEventListener('mouseup', () => {
    cancelLongPress();
});

document.addEventListener('mouseleave', () => {
    cancelLongPress();
});

// For mobile devices, ensure audio context is resumed after user interaction
document.addEventListener('click', function() {
    if (window.audioContext && window.audioContext.state === 'suspended') {
        window.audioContext.resume();
    }
}, { once: true });

// Connect toggle button to speech recognition
toggle.addEventListener('change', function() {
    if (toggle.checked) {
        // When turning on, request microphone permission
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                console.log('Microphone permission granted');
            })
            .catch(error => {
                console.error('Microphone permission denied:', error);
            });
    } else {
        // When turning off, stop listening if active
        if (isListening) {
            stopListening();
        }
    }
});

// This ensures we get the voices list as soon as possible



// Function to move the eyes to a specific (x, y) coordinate
function moveEyes(x, y) {
    // Get the dimensions of the screen
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Calculate the center of the screen
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    // Normalize the (x, y) coordinates relative to the center of the screen
    const normalizedX = (x - centerX) / centerX; // Range: [-1, 1]
    const normalizedY = (y - centerY) / centerY; // Range: [-1, 1]

    // Define the maximum movement range for the eyes (in pixels)
    const maxMovementX = 20; // Maximum horizontal movement
    const maxMovementY = 20; // Maximum vertical movement

    // Calculate the new position for the eyes
    const leftEyeX = normalizedX * maxMovementX;
    const leftEyeY = normalizedY * maxMovementY;
    const rightEyeX = normalizedX * maxMovementX;
    const rightEyeY = normalizedY * maxMovementY;

    // Apply the new position to the eyes
    leftEye.style.transform = `translate(${leftEyeX}px, ${leftEyeY}px)`;
    rightEye.style.transform = `translate(${rightEyeX}px, ${rightEyeY}px)`;
}

// Example usage:
// // Move the eyes to the position (100, 150) relative to the center of the screen
moveEyes(900, 900);


// document.addEventListener('mousemove', (event) => {
//     moveEyes(event.clientX, event.clientY);
// });

// document.addEventListener('touchmove', (event) => {
//     const touch = event.touches[0];
//     moveEyes(touch.clientX, touch.clientY);
// });


// Function to move the eyes smoothly and quickly
function moveEyes(x, y) {
    // Get the dimensions of the screen
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Calculate the center of the screen
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;

    // Normalize the (x, y) coordinates relative to the center of the screen
    const normalizedX = (x - centerX) / centerX; // Range: [-1, 1]
    const normalizedY = (y - centerY) / centerY; // Range: [-1, 1]

    // Define the maximum movement range for the eyes (in pixels)
    const maxMovementX = 20; // Maximum horizontal movement
    const maxMovementY = 20; // Maximum vertical movement

    // Calculate the new position for the eyes
    const leftEyeX = normalizedX * maxMovementX;
    const leftEyeY = normalizedY * maxMovementY;
    const rightEyeX = normalizedX * maxMovementX;
    const rightEyeY = normalizedY * maxMovementY;

    // Use requestAnimationFrame for smoother animation
    requestAnimationFrame(() => {
        leftEye.style.transform = `translate(${leftEyeX}px, ${leftEyeY}px)`;
        rightEye.style.transform = `translate(${rightEyeX}px, ${rightEyeY}px)`;
    });
}

// // Throttle the mousemove and touchmove events for better performance
let isAnimating = false;

document.addEventListener('mousemove', (event) => {
    if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(() => {
            moveEyes(event.clientX, event.clientY);
            isAnimating = false;
        });
    }
});

document.addEventListener('touchmove', (event) => {
    if (!isAnimating) {
        isAnimating = true;
        const touch = event.touches[0];
        requestAnimationFrame(() => {
            moveEyes(touch.clientX, touch.clientY);
            isAnimating = false;
        });
    }
});

speechSynthesis.onvoiceschanged = () => console.log('Voices loaded:', speechSynthesis.getVoices().length);
