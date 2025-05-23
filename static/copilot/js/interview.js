document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startButton = document.getElementById('startButton');
    const stopAnswerButton = document.getElementById('stopAnswerButton');
    const settingsButton = document.getElementById('settingsButton');
    const screenshotButton = document.getElementById('screenshotButton');
    const microphoneButton = document.getElementById('microphoneButton');
    const statusElement = document.getElementById('status');
    const conversationBox = document.getElementById('conversationBox');
    const answerBox = document.getElementById('answerBox');
    const videoPreview = document.getElementById('videoPreview');
    const resumeSummary = document.getElementById('resumeSummary');
    const manualQuestionInput = document.getElementById('manualQuestion');
    const submitQuestionButton = document.getElementById('submitQuestion');

    // WebSocket connection
    let socket;
    let mediaRecorder;
    let stream;
    let deepgramSocket;
    let currentTranscript = '';
    let interimTranscript = '';
    let transcriptionTimeout;
    let liveTranscriptElement = null;
    const TRANSCRIPTION_PAUSE_THRESHOLD = 2000; // 2 seconds
    let currentAnswerMarkdown = ''; // Track current answer for Markdown
    let questionQueue = []; // Queue for transcriptions
    let isProcessingAnswer = false; // Track if an answer is being processed
    let isRecording = false; // Track microphone state
    let language = 'ru'; // Default language

    // Initialize theme
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);

        // Load language from settings
        fetch('/api/settings')
            .then(response => response.json())
            .then(data => {
                language = data.language || 'ru';
            })
            .catch(error => {
                console.error('Error loading language:', error);
            });
    };

    // Check browser support
    const checkBrowserSupport = () => {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (isSafari) {
            const safariVersion = parseInt(navigator.userAgent.match(/Version\/(\d+)/)?.[1] || '0');

            if (safariVersion < 14) {
                alert('Safari version 14 or later is required for this application.');
                return false;
            }

            statusElement.textContent = 'Note: In Safari, ensure microphone permissions are granted';
        }

        return true;
    };

    // Initialize WebSocket connection
    function initWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/interview`;

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            statusElement.textContent = 'Connected to server';
            console.log('WebSocket connection established');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch(data.type) {
                case 'initialization':
                    resumeSummary.textContent = data.resume_summary;
                    break;

                case 'question':
                    addMessageToConversation('question', data.text, data.timestamp);
                    stopAnswerButton.disabled = false;
                    isProcessingAnswer = true;
                    break;

                case 'answer_chunk':
                    console.log('Received answer_chunk:', data.text);
                    updateOrAddAnswer(data.text, data.timestamp);
                    break;

                case 'answer_complete':
                    console.log('Answer complete received');
                    completeCurrentAnswer();
                    stopAnswerButton.disabled = true;
                    isProcessingAnswer = false;
                    processNextQuestion();
                    break;

                case 'answer_stopped':
                    console.log('Answer stopped received');
                    completeCurrentAnswer();
                    addMessageToAnswerBox('system-message', data.message, data.timestamp);
                    stopAnswerButton.disabled = true;
                    break;
            }
        };

        socket.onclosearked.parse(text) : text;

        messageDiv.appendChild(timeSpan);
        messageDiv.appendChild(contentDiv);

        if (type === 'answer') {
            messageDiv.id = 'current-answer';
        }

        answerBox.appendChild(messageDiv);
        console.log(`Added ${type} to answerBox: ${text}`);
        requestAnimationFrame(() => {
            if (answerBox && answerBox.scrollHeight) {
                answerBox.scrollTop = answerBox.scrollHeight;
            }
        });
    }

    // Update or add answer
    function updateOrAddAnswer(text, timestamp) {
        let answerDiv = document.getElementById('current-answer');

        if (!answerDiv) {
            currentAnswerMarkdown = text;
            addMessageToAnswerBox('answer', currentAnswerMarkdown, timestamp);
        } else {
            currentAnswerMarkdown += text;
            const contentDiv = answerDiv.querySelector('.markdown-content');
            contentDiv.innerHTML = marked.parse(currentAnswerMarkdown);
            console.log(`Updated answer: ${currentAnswerMarkdown}`);
            requestAnimationFrame(() => {
                if (answerBox && answerBox.scrollHeight) {
                    answerBox.scrollTop = answerBox.scrollHeight;
                }
            });
        }
    }

    // Complete current answer
    function completeCurrentAnswer() {
        const answerDiv = document.getElementById('current-answer');
        if (answerDiv) {
            answerDiv.removeAttribute('id');
            currentAnswerMarkdown = ''; // Reset for next answer
        }
    }

    // Stop answer
    function stopAnswer() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'stop'
            }));
            console.log('Stop answer requested');
            // Immediately reset state and process next question
            completeCurrentAnswer();
            stopAnswerButton.disabled = true;
            isProcessingAnswer = false;
            processNextQuestion();
        } else {
            console.log('WebSocket not open, cannot send stop');
        }
    }

    // Capture screenshot
    function captureScreenshot() {
        const mainElement = document.querySelector('main');
        if (!mainElement) {
            console.error('Main element not found');
            statusElement.textContent = 'Error: Cannot capture screenshot';
            return;
        }

        statusElement.textContent = 'Capturing screenshot...';
        html2canvas(mainElement, {
            scale: 2,
            useCORS: true,
            logging: false
        }).then(canvas => {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
            link.download = `interview_screenshot_${timestamp}.png`;
            link.href = dataUrl;
            link.click();
            console.log('Screenshot captured and downloaded');
            statusElement.textContent = 'Screenshot saved';
            setTimeout(() => {
                statusElement.textContent = socket.readyState === WebSocket.OPEN ? 'Connected to server' : 'Disconnected';
            }, 2000);
        }).catch(error => {
            console.error('Screenshot error:', error);
            statusElement.textContent = 'Error: Failed to capture screenshot';
        });
    }

    // Toggle microphone recording
    async function toggleMicrophone() {
        if (!checkBrowserSupport()) {
            return;
        }

        if (!isRecording) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length === 0) {
                    alert('No audio track available. Please check microphone permissions.');
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const mimeType = getSupportedMimeType();
                if (!mimeType) {
                    alert('Your browser does not support required audio formats.');
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const options = {
                    mimeType: mimeType,
                    audioBitsPerSecond: 128000
                };

                try {
                    mediaRecorder = new MediaRecorder(stream, options);
                } catch (e) {
                    console.warn('Failed to create MediaRecorder with options, using defaults', e);
                    mediaRecorder = new MediaRecorder(stream);
                }

                initDeepgramSocket();

                isRecording = true;
                microphoneButton.classList.add('recording');
                microphoneButton.disabled = false;
                startButton.disabled = true;
                console.log('Microphone recording started');
            } catch (error) {
                console.error('Error accessing microphone:', error);
                statusElement.textContent = 'Error: ' + error.message;
                if (error.name === 'NotAllowedError') {
                    statusElement.textContent = 'Error: Microphone permission denied.';
                }
            }
        } else {
            stopCapturing();
            isRecording = false;
            microphoneButton.classList.remove('recording');
            microphoneButton.disabled = false;
            startButton.disabled = false;
            console.log('Microphone recording stopped');
        }
    }

    // Handle manual question submission
    function submitManualQuestion() {
        const question = manualQuestionInput.value.trim();
        if (question && socket && socket.readyState === WebSocket.OPEN) {
            queueTranscription(question);
            manualQuestionInput.value = '';
        }
    }

    // Get supported MIME type for recording
    function getSupportedMimeType() {
        const types = [
            'audio/webm',
            'audio/webm;codecs=opus',
            'audio/mp4',
            'audio/ogg;codecs=opus'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return null;
    }

    // Start capturing system audio
    async function startCapturingSystemAudio() {
        if (!checkBrowserSupport()) {
            return;
        }

        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                alert('No audio track available. Make sure to select "Share audio" when sharing.');
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            videoPreview.srcObject = stream;
            videoPreview.style.display = 'block';
            document.querySelector('.preview-placeholder').style.display = 'none';

            const audioStream = new MediaStream(audioTracks);

            const mimeType = getSupportedMimeType();
            if (!mimeType) {
                alert('Your browser does not support any of the required audio recording formats.');
                audioStream.getTracks().forEach(track => track.stop());
                return;
            }

            const options = {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            };

            try {
                mediaRecorder = new MediaRecorder(audioStream, options);
            } catch (e) {
                console.warn('Failed to create MediaRecorder with specified options, trying with defaults', e);
                mediaRecorder = new MediaRecorder(audioStream);
            }

            initDeepgramSocket();

            stream.getTracks()[0].onended = () => {
                stopCapturing();
            };

            startButton.disabled = true;
            startButton.textContent = 'Interview in Progress';
            microphoneButton.disabled = true;

        } catch (error) {
            console.error('Error accessing system audio:', error);
            statusElement.textContent = 'Error: ' + error.message;

            if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
                if (error.name === 'NotAllowedError') {
                    statusElement.textContent = 'Error: Permission denied. In Safari, ensure screen recording permissions.';
                } else if (error.name === 'NotSupportedError') {
                    statusElement.textContent = 'Error: Screen sharing with audio not supported in this Safari version.';
                }
            }
        }
    }

    // Stop capturing
    function stopCapturing() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }

        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.close();
        }

        videoPreview.style.display = 'none';
        document.querySelector('.preview-placeholder').style.display = 'flex';
        statusElement.textContent = 'Disconnected - Screen sharing stopped';

        if (liveTranscriptElement) {
            liveTranscriptElement.remove();
            liveTranscriptElement = null;
        }

        startButton.disabled = false;
        startButton.textContent = 'Start Interview';
        stopAnswerButton.disabled = true;
        microphoneButton.disabled = false;
    }

    // Event listeners
    startButton.addEventListener('click', () => {
        startCapturingSystemAudio();
    });

    stopAnswerButton.addEventListener('click', () => {
        stopAnswer();
    });

    screenshotButton.addEventListener('click', () => {
        captureScreenshot();
    });

    microphoneButton.addEventListener('click', () => {
        toggleMicrophone();
    });

    settingsButton.addEventListener('click', () => {
        window.location.href = '/settings';
    });

    submitQuestionButton.addEventListener('click', () => {
        submitManualQuestion();
    });

    manualQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitManualQuestion();
        }
    });

    // Keyboard shortcut for screenshot (Ctrl+Shift+S or Cmd+Shift+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            captureScreenshot();
        }
    });

    // Initialize theme and WebSocket
    initTheme();
    initWebSocket();
});