// KeyHunter Content Script

async function gatherResources() {
    const resources = [];

    // 1. Scan Inline Scripts
    const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'));
    inlineScripts.forEach((script, index) => {
        resources.push({
            type: 'inline_script',
            content: script.textContent,
            source: `Inline Script #${index + 1}`
        });
    });

    // 2. Scan External Scripts
    const externalScripts = Array.from(document.querySelectorAll('script[src]'));
    externalScripts.forEach(script => {
        resources.push({
            type: 'remote_resource',
            url: script.src
        });
    });

    // 3. Scan Main HTML
    resources.push({
        type: 'inline_content',
        content: document.documentElement.outerHTML,
        source: 'Page HTML Body'
    });

    // 4. Scan Stylesheets (often contain API keys for fonts/maps)
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach(link => {
        if (link.href) {
            resources.push({
                type: 'remote_resource',
                url: link.href
            });
        }
    });

    const inlineStyles = Array.from(document.querySelectorAll('style'));
    inlineStyles.forEach((style, index) => {
        resources.push({
            type: 'inline_content',
            content: style.textContent,
            source: `Inline Style #${index + 1}`
        });
    });

    return resources;
}

async function runScan() {
    const resources = await gatherResources();
    const allFindings = [];

    const scanPromises = resources.map(res => {
        if (res.type === 'remote_resource') {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: "scanRemoteResource", url: res.url }, (response) => {
                    if (response && response.data) {
                        allFindings.push(...response.data);
                    }
                    resolve();
                });
            });
        } else {
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: "scanLocalContent",
                    content: res.content,
                    source: res.source
                }, (response) => {
                    if (response && response.data) {
                        allFindings.push(...response.data);
                    }
                    resolve();
                });
            });
        }
    });

    await Promise.all(scanPromises);

    // Deduplicate findings
    const uniqueFindings = [...new Map(allFindings.map(item => [item.type + item.value + item.source, item])).values()];
    return uniqueFindings;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScan") {
        runScan().then(results => sendResponse({ data: results }));
        return true;
    }
});
