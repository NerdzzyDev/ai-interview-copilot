//document.addEventListener('DOMContentLoaded', function() {
//    // DOM Elements
//    const startButton = document.getElementById('startButton');
//    const statusElement = document.getElementById('status');
//    const conversationBox = document.getElementById('conversationBox');
//    const videoPreview = document.getElementById('videoPreview');
//    const resumeSummary = document.getElementById('resumeSummary');
//    const jobSummary = document.getElementById('jobSummary');
//
//    // WebSocket connection
//    let socket;
//    let mediaRecorder;
//    let stream;
//    let deepgramSocket;
//    let currentTranscript = '';
//    let interimTranscript = '';
//    let transcriptionTimeout;
//    let liveTranscriptElement = null;
//    const TRANSCRIPTION_PAUSE_THRESHOLD = 2000; // 2 seconds
//
//    // Initialize WebSocket connection
//    function initWebSocket() {
//        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
//        const wsUrl = `${wsProtocol}//${window.location.host}/ws/interview/`;
//
//        socket = new WebSocket(wsUrl);
//
//        socket.onopen = () => {
//            statusElement.textContent = 'Connected to server';
//            console.log('WebSocket connection established');
//        };
//
//        socket.onmessage = (event) => {
//            const data = JSON.parse(event.data);
//
//            switch(data.type) {
//                case 'initialization':
//                    // Update summaries
//                    resumeSummary.textContent = data.resume_summary;
//                    jobSummary.textContent = data.job_summary;
//                    break;
//
//                case 'question':
//                    // Display the transcribed question
//                    addMessageToConversation('question', data.text, data.timestamp);
//                    break;
//
//                case 'answer_chunk':
//                    // Handle streaming response chunks
//                    updateOrAddAnswer(data.text, data.timestamp);
//                    break;
//
//                case 'answer_complete':
//                    // Mark the current answer as complete
//                    completeCurrentAnswer();
//                    break;
//            }
//        };
//
//        socket.onclose = () => {
//            statusElement.textContent = 'Disconnected from server';
//            console.log('WebSocket connection closed');
//        };
//
//        socket.onerror = (error) => {
//            statusElement.textContent = 'Error: ' + error;
//            console.error('WebSocket error:', error);
//        };
//    }
//
//    // Initialize Deepgram WebSocket for transcription
//    function initDeepgramSocket() {
//        deepgramSocket = new WebSocket('wss://api.deepgram.com/v1/listen?language=ru&model=nova-2', [
//            'token',
//            DEEPGRAM_API_KEY,
//        ]);
//
//        deepgramSocket.onopen = () => {
//            statusElement.textContent = 'Connected - Transcribing System Audio (Russian)';
//            console.log('Deepgram WebSocket connection established');
//
//            // Create a live transcription element
//            createLiveTranscriptionElement();
//
//            // Start recording and sending audio
//            mediaRecorder.addEventListener('dataavailable', async (event) => {
//                if (event.data.size > 0 && deepgramSocket.readyState == 1) {
//                    deepgramSocket.send(event.data);
//                }
//            });
//
//            mediaRecorder.start(1000);
//        };
//
//        deepgramSocket.onmessage = (message) => {
//            const received = JSON.parse(message.data);
//            const transcript = received.channel.alternatives[0].transcript;
//
//            // Clear previous timeout to avoid early submission while still speaking
//            clearTimeout(transcriptionTimeout);
//
//            if (transcript) {
//                if (received.is_final) {
//                    // Add final transcript to current transcript with a space
//                    currentTranscript += transcript + ' ';
//                    interimTranscript = '';
//
//                    // Update live transcription immediately with current accumulated transcript
//                    updateLiveTranscription(currentTranscript);
//
//                    // Set timeout for submission after silence
//                    transcriptionTimeout = setTimeout(() => {
//                        if (currentTranscript.trim()) {
//                            sendTranscriptionToServer(currentTranscript.trim());
//                            currentTranscript = '';
//
//                            // Clear live transcription after sending
//                            if (liveTranscriptElement) {
//                                liveTranscriptElement.innerHTML = '<p><em>Listening...</em></p>';
//                            }
//                        }
//                    }, TRANSCRIPTION_PAUSE_THRESHOLD);
//                } else {
//                    // Real-time interim results
//                    interimTranscript = transcript;
//
//                    // Show both final and interim transcripts for real-time streaming effect
//                    updateLiveTranscription(currentTranscript + '<span class="interim">' + interimTranscript + '</span>');
//                }
//            }
//        };
//
//        deepgramSocket.onclose = () => {
//            console.log('Deepgram WebSocket connection closed');
//            statusElement.textContent = 'Disconnected from transcription service';
//            if (liveTranscriptElement) {
//                liveTranscriptElement.remove();
//                liveTranscriptElement = null;
//            }
//        };
//
//        deepgramSocket.onerror = (error) => {
//            console.error('Deepgram WebSocket error:', error);
//            statusElement.textContent = 'Transcription Error: ' + error;
//        };
//    }
//
//    // Create live transcription element
//    function createLiveTranscriptionElement() {
//        if (!liveTranscriptElement) {
//            liveTranscriptElement = document.createElement('div');
//            liveTranscriptElement.className = 'live-transcript';
//            liveTranscriptElement.innerHTML = '<p><em>Listening...</em></p>';
//            conversationBox.appendChild(liveTranscriptElement);
//            conversationBox.scrollTop = conversationBox.scrollHeight;
//        }
//    }
//
//    // Update live transcription
//    function updateLiveTranscription(text) {
//        if (!liveTranscriptElement) {
//            createLiveTranscriptionElement();
//        }
//
//        // Use innerHTML instead of textContent to support the interim span for styling
//        liveTranscriptElement.innerHTML = `<p>${text}</p>`;
//        conversationBox.scrollTop = conversationBox.scrollHeight;
//    }
//
//    // Send transcription to server
//    function sendTranscriptionToServer(text) {
//        if (socket && socket.readyState === WebSocket.OPEN) {
//            socket.send(JSON.stringify({
//                type: 'transcription',
//                text: text
//            }));
//        }
//    }
//
//    // Add message to conversation
//    function addMessageToConversation(type, text, timestamp) {
//        const messageDiv = document.createElement('div');
//        messageDiv.className = type;
//
//        const timeSpan = document.createElement('span');
//        timeSpan.className = 'timestamp';
//        timeSpan.textContent = timestamp;
//
//        const textParagraph = document.createElement('p');
//        textParagraph.textContent = text;
//
//        messageDiv.appendChild(timeSpan);
//        messageDiv.appendChild(textParagraph);
//
//        if (type === 'answer') {
//            messageDiv.id = 'current-answer';
//        }
//
//        conversationBox.appendChild(messageDiv);
//        conversationBox.scrollTop = conversationBox.scrollHeight;
//    }
//
//    // Update or add answer
//    function updateOrAddAnswer(text, timestamp) {
//        let answerDiv = document.getElementById('current-answer');
//
//        if (!answerDiv) {
//            addMessageToConversation('answer', text, timestamp);
//        } else {
//            const textParagraph = answerDiv.querySelector('p');
//            textParagraph.textContent += text;
//            conversationBox.scrollTop = conversationBox.scrollHeight;
//        }
//    }
//
//    // Complete current answer
//    function completeCurrentAnswer() {
//        const answerDiv = document.getElementById('current-answer');
//        if (answerDiv) {
//            answerDiv.removeAttribute('id');
//        }
//    }
//
//    // Start capturing system audio
//    async function startCapturingSystemAudio() {
//        try {
//            // Request screen capture with audio
//            stream = await navigator.mediaDevices.getDisplayMedia({
//                video: true,
//                audio: true
//            });
//
//            // Check if audio track is available
//            const audioTracks = stream.getAudioTracks();
//            if (audioTracks.length === 0) {
//                alert('No audio track available. Make sure to select "Share audio" when sharing.');
//                stream.getTracks().forEach(track => track.stop());
//                return;
//            }
//
//            // Show video preview
//            videoPreview.srcObject = stream;
//            videoPreview.style.display = 'block';
//            document.querySelector('.preview-placeholder').style.display = 'none';
//
//            // Create a new MediaStream with only the audio track for recording
//            const audioStream = new MediaStream(audioTracks);
//
//            if (!MediaRecorder.isTypeSupported('audio/webm')) {
//                alert('Browser not supported');
//                audioStream.getTracks().forEach(track => track.stop());
//                return;
//            }
//
//            mediaRecorder = new MediaRecorder(audioStream, {
//                mimeType: 'audio/webm',
//            });
//
//            // Initialize Deepgram for transcription
//            initDeepgramSocket();
//
//            // Add event handler to stop everything when screen sharing is stopped
//            stream.getTracks()[0].onended = () => {
//                stopCapturing();
//            };
//
//            // Disable start button
//            startButton.disabled = true;
//            startButton.textContent = 'Interview in Progress';
//
//        } catch (error) {
//            console.error('Error accessing system audio:', error);
//            statusElement.textContent = 'Error: ' + error.message;
//        }
//    }
//
//    // Stop capturing
//    function stopCapturing() {
//        if (stream) {
//            stream.getTracks().forEach(track => track.stop());
//        }
//
//        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
//            mediaRecorder.stop();
//        }
//
//        if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
//            deepgramSocket.close();
//        }
//
//        // Reset UI
//        videoPreview.style.display = 'none';
//        document.querySelector('.preview-placeholder').style.display = 'flex';
//        statusElement.textContent = 'Disconnected - Screen sharing stopped';
//
//        if (liveTranscriptElement) {
//            liveTranscriptElement.remove();
//            liveTranscriptElement = null;
//        }
//
//        // Enable start button
//        startButton.disabled = false;
//        startButton.textContent = 'Start Interview';
//    }
//
//    // Event listeners
//    startButton.addEventListener('click', () => {
//        startCapturingSystemAudio();
//    });
//
//    // Initialize WebSocket connection on page load
//    initWebSocket();
//});