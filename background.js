// KeyHunter Background Service Worker

let patterns = [];
let precompiledPatterns = [];
const resourceCache = new Map(); // Cache results for URLs to avoid redundant scanning

// Load patterns on startup and when updated
async function loadAllPatterns() {
    const url = chrome.runtime.getURL('patterns.json');
    try {
        const response = await fetch(url);
        const data = await response.json();

        let loadedPatterns = data.patterns.map(p => ({
            name: p.name,
            regex: p.regex,
            confidence: p.confidence || 'unknown',
            category: p.category || 'Miscellaneous'
        }));

        const storage = await chrome.storage.local.get(['customPatterns']);
        if (storage.customPatterns) {
            loadedPatterns = [...loadedPatterns, ...storage.customPatterns];
        }

        patterns = loadedPatterns;

        // Performance: Pre-compile regexes
        precompiledPatterns = patterns.map(p => {
            try {
                return { ...p, compiled: new RegExp(p.regex, 'g') };
            } catch (e) {
                console.warn(`Invalid regex for ${p.name}: ${p.regex}`);
                return null;
            }
        }).filter(Boolean);

        // Clear cache when patterns change
        resourceCache.clear();
        console.log(`Loaded ${patterns.length} patterns total. Cache cleared.`);
    } catch (err) {
        console.error("Failed to load patterns:", err);
    }
}

loadAllPatterns();

// Core scanning function
function scanContent(content, source) {
    const results = [];
    if (!content || typeof content !== 'string') return results;

    // Optimization: Check for empty or too small content
    if (content.length < 10) return results;

    precompiledPatterns.forEach(p => {
        p.compiled.lastIndex = 0;
        let match;
        let count = 0;
        while ((match = p.compiled.exec(content)) !== null) {
            if (match.index === p.compiled.lastIndex) {
                p.compiled.lastIndex++;
            }

            const value = match[0];
            const index = match.index;

            // PERFORMANCE: Use a faster line counting method for large strings if necessary
            // For now, substring and split is readable.
            const before = content.substring(0, index);
            const lineNumber = before.split('\n').length;

            const start = Math.max(0, index - 40);
            const end = Math.min(content.length, index + value.length + 40);
            let snippet = content.substring(start, end);

            results.push({
                type: p.name,
                value: value,
                confidence: p.confidence,
                category: p.category,
                source: source,
                line: lineNumber,
                snippet: snippet
            });

            // Cap results per pattern to avoid catastrophic backtracking or spam
            count++;
            if (count > 50) break;
        }
    });
    return results;
}

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanRemoteResource") {
        // PERFORMANCE: Return cached results if available
        if (resourceCache.has(request.url)) {
            sendResponse({ data: resourceCache.get(request.url) });
            return false;
        }

        fetch(request.url)
            .then(res => {
                // Don't scan if it's not a text-based resource
                const contentType = res.headers.get('content-type');
                if (contentType && !contentType.includes('javascript') && !contentType.includes('text') && !contentType.includes('json')) {
                    return "";
                }
                return res.text();
            })
            .then(content => {
                const findings = scanContent(content, request.url);
                resourceCache.set(request.url, findings);
                sendResponse({ data: findings });
            })
            .catch(err => {
                console.warn(`Could not fetch ${request.url}:`, err);
                sendResponse({ data: [], error: err.message });
            });
        return true;
    }

    if (request.action === "scanLocalContent") {
        const findings = scanContent(request.content, request.source);
        sendResponse({ data: findings });
        return false;
    }

    if (request.action === "reloadPatterns") {
        loadAllPatterns();
        return false;
    }
});

// Network monitoring
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Only scan if it's a sub_frame or main_frame or script to reduce noise
        if (['main_frame', 'sub_frame', 'script', 'xmlhttprequest'].includes(details.type)) {
            const findings = scanContent(details.url, "Network Request URL");
            if (findings.length > 0) {
                // findings could be broadcasted or stored
            }
        }
    },
    { urls: ["<all_urls>"] }
);
