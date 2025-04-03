// Function to apply the theme
function applyTheme(theme) {
    const body = document.body;
    const button = document.querySelector('.toggle-button i');

    body.classList.remove('light-mode', 'dark-mode');
    body.classList.add(theme);

    if (theme === 'dark-mode') {
        button.classList.remove('fa-moon');
        button.classList.add('fa-sun');
    } else {
        button.classList.remove('fa-sun');
        button.classList.add('fa-moon');
    }
}

// Detect system preference and apply it
function detectSystemPreference() {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = systemPrefersDark ? 'dark-mode' : 'light-mode';
    sessionStorage.setItem('theme', theme); // Store the detected theme in sessionStorage
    applyTheme(theme);
}

// Apply the theme from sessionStorage or detect it
function initializeTheme() {
    const savedTheme = sessionStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        detectSystemPreference();
    }
}

// Toggle theme on button click
function toggleMode() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark-mode' : 'light-mode';
    const newTheme = currentTheme === 'dark-mode' ? 'light-mode' : 'dark-mode';
    sessionStorage.setItem('theme', newTheme); // Update the theme in sessionStorage
    applyTheme(newTheme);
}

// Initialize theme on page load
initializeTheme();