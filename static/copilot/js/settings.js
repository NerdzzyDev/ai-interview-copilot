document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const themeSelect = document.getElementById('theme');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const deepgramApiKeyInput = document.getElementById('deepgramApiKey');
    const languageSelect = document.getElementById('language');
    const promptTextarea = document.getElementById('prompt');
    const resumeTextarea = document.getElementById('resume');

    // Load current settings
    fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
            themeSelect.value = data.theme || 'light';
            openaiApiKeyInput.value = data.openai_api_key || '';
            deepgramApiKeyInput.value = data.deepgram_api_key || '';
            languageSelect.value = data.language || 'ru';
            promptTextarea.value = data.prompt || '';
            resumeTextarea.value = data.resume || '';

            // Apply theme
            document.body.setAttribute('data-theme', themeSelect.value);
            localStorage.setItem('theme', themeSelect.value);
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            alert('Failed to load settings');
        });

    // Handle form submission
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const settings = {
            theme: themeSelect.value,
            openai_api_key: openaiApiKeyInput.value,
            deepgram_api_key: deepgramApiKeyInput.value,
            language: languageSelect.value,
            prompt: promptTextarea.value,
            resume: resumeTextarea.value
        };

        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                document.body.setAttribute('data-theme', settings.theme);
                localStorage.setItem('theme', settings.theme);
                alert('Settings saved successfully');
            } else {
                alert('Failed to save settings: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        });
    });
});