// ==========================================================================
// PatternLab Global Utilities & Theme Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('patternlab-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'dark'); // default dark for studio feel
    
    setTheme(initialTheme);
    
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(nextTheme);
        });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('patternlab-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// Global Dataset Storage in Session
function storeDatasetState(analysis, filepath, filename, suggestedTarget = null) {
    const state = {
        analysis: analysis,
        filepath: filepath,
        filename: filename,
        target: suggestedTarget || null,
        loadedAt: new Date().toISOString()
    };
    sessionStorage.setItem('currentDataset', JSON.stringify(state));
}

function getDatasetState() {
    try {
        const state = sessionStorage.getItem('currentDataset');
        return state ? JSON.parse(state) : null;
    } catch {
        return null;
    }
}

// Global Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error' || type === 'danger') icon = '⚠️';
    
    toast.innerHTML = `
        <span>${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
