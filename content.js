async function loadPatterns() {
    const url = chrome.runtime.getURL('patterns.json');
    const response = await fetch(url);
    const data = await response.json();
    return data.patterns; 
}

async function scanPage() {
    let foundSecrets = [];
    const patterns = await loadPatterns();
    const scripts = Array.from(document.querySelectorAll('script'));

    for (let script of scripts) {
        let content = "";
        let sourceName = script.src || "Inline Script";

        try {
            if (script.src) {
                const response = await fetch(script.src);
                content = await response.text();
            } else {
                content = script.textContent;
            }

            patterns.forEach(item => {
                const p = item.pattern; // Senin JSON yapına uygun erişim
                try {
                    const regex = new RegExp(p.regex, 'g');
                    let matches = content.match(regex);
                    if (matches) {
                        matches.forEach(match => {
                            foundSecrets.push({
                                type: p.name,
                                value: match,
                                confidence: p.confidence || 'unknown',
                                source: sourceName
                            });
                        });
                    }
                } catch (reErr) { /* Geçersiz regexleri atla */ }
            });
        } catch (e) {
            console.warn("Erişim engellendi:", sourceName);
        }
    }
    // Tekrar eden bulguları temizle
    return [...new Map(foundSecrets.map(item => [item.value, item])).values()];
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScan") {
        scanPage().then(results => sendResponse({ data: results }));
        return true;
    }
});
