// KeyHunter Popup Controller

let allFindings = [];
let currentFilter = 'all';

const scanBtn = document.getElementById('scanBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultsDiv = document.getElementById('results');
const statsSpan = document.getElementById('stats');
const filterContainer = document.getElementById('filterContainer');
const settingsToggle = document.getElementById('settingsToggle');
const mainView = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');

const customNameInput = document.getElementById('customName');
const customRegexInput = document.getElementById('customRegex');
const addCustomBtn = document.getElementById('addCustomBtn');
const customPatternsList = document.getElementById('customPatternsList');

// View Toggling
settingsToggle.addEventListener('click', () => {
    mainView.classList.toggle('hidden');
    settingsView.classList.toggle('hidden');
    if (!settingsView.classList.contains('hidden')) {
        renderCustomPatterns();
    }
});

scanBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    scanBtn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Scanning...`;
    scanBtn.disabled = true;

    chrome.tabs.sendMessage(tab.id, { action: "startScan" }, (response) => {
        scanBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Rescan`;
        scanBtn.disabled = false;

        if (response && response.data) {
            allFindings = response.data;
            renderResults();
            renderFilters();
        } else {
            allFindings = [];
            resultsDiv.innerHTML = `<div class="empty-state"><p>No response from page. Try refreshing the tab.</p></div>`;
        }
    });
});

function renderFilters() {
    if (allFindings.length === 0) {
        filterContainer.style.display = 'none';
        return;
    }

    const categories = ['all', ...new Set(allFindings.map(f => f.category))];
    filterContainer.innerHTML = '';
    filterContainer.style.display = 'flex';

    categories.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = `filter-chip ${currentFilter === cat ? 'active' : ''}`;
        chip.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);
        chip.dataset.cat = cat;
        chip.addEventListener('click', () => {
            currentFilter = cat;
            renderFilters();
            renderResults();
        });
        filterContainer.appendChild(chip);
    });
}

function renderResults() {
    resultsDiv.innerHTML = "";
    const filtered = currentFilter === 'all'
        ? allFindings
        : allFindings.filter(f => f.category === currentFilter);

    statsSpan.innerText = `${allFindings.length} findings`;

    if (filtered.length > 0) {
        downloadBtn.style.display = "flex";
        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = `finding-card conf-${item.confidence}`;

            const displaySource = item.source.length > 50
                ? '...' + item.source.slice(-47)
                : item.source;

            card.innerHTML = `
                <div class="finding-header">
                    <span class="finding-type">${item.type}</span>
                    <span class="finding-category">${item.category || 'Misc'}</span>
                </div>
                <div class="finding-value">${escapeHtml(item.value)}</div>
                <div class="finding-meta">
                    <div><span>Source:</span> ${displaySource}</div>
                    <div><span>Line:</span> ${item.line} | <span>Confidence:</span> ${item.confidence}</div>
                </div>
                ${item.snippet ? `<div class="snippet">${escapeHtml(item.snippet.trim())}</div>` : ''}
            `;
            resultsDiv.appendChild(card);
        });
    } else {
        downloadBtn.style.display = "none";
        resultsDiv.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <p>${allFindings.length > 0 ? 'No findings match this filter.' : 'Clean! No sensitive data found.'}</p>
            </div>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

downloadBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(allFindings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyhunter-results-${new Date().getTime()}.json`;
    a.click();
});

// Custom Patterns Logic
addCustomBtn.addEventListener('click', () => {
    const name = customNameInput.value.trim();
    const regex = customRegexInput.value.trim();

    if (name && regex) {
        chrome.storage.local.get(['customPatterns'], (result) => {
            const list = result.customPatterns || [];
            list.push({ name, regex, confidence: 'high', category: 'Custom' });
            chrome.storage.local.set({ customPatterns: list }, () => {
                customNameInput.value = '';
                customRegexInput.value = '';
                renderCustomPatterns();
                // Notify background script to reload patterns
                chrome.runtime.sendMessage({ action: "reloadPatterns" });
            });
        });
    }
});

function renderCustomPatterns() {
    chrome.storage.local.get(['customPatterns'], (result) => {
        const list = result.customPatterns || [];
        customPatternsList.innerHTML = '<h3 style="font-size: 13px; margin: 16px 0 8px;">Your Patterns</h3>';

        if (list.length === 0) {
            customPatternsList.innerHTML += '<p style="font-size: 11px; color: var(--text-muted);">No custom patterns added yet.</p>';
            return;
        }

        list.forEach((p, index) => {
            const item = document.createElement('div');
            item.style = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 4px; font-size: 12px;';
            item.innerHTML = `
                <div>
                    <strong>${escapeHtml(p.name)}</strong>
                    <div style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${escapeHtml(p.regex)}</div>
                </div>
                <button class="delete-pattern" data-index="${index}" style="flex: none; width: auto; padding: 4px 8px; background: #fee2e2; color: #ef4444;">Delete</button>
            `;
            customPatternsList.appendChild(item);
        });

        document.querySelectorAll('.delete-pattern').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.dataset.index;
                removeCustomPattern(idx);
            });
        });
    });
}

function removeCustomPattern(index) {
    chrome.storage.local.get(['customPatterns'], (result) => {
        const list = result.customPatterns || [];
        list.splice(index, 1);
        chrome.storage.local.set({ customPatterns: list }, () => {
            renderCustomPatterns();
            chrome.runtime.sendMessage({ action: "reloadPatterns" });
        });
    });
}
