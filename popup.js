let currentResults = [];

document.getElementById('scanBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const resultsDiv = document.getElementById('results');
    const scanBtn = document.getElementById('scanBtn');
    
    scanBtn.innerText = "Taranıyor... Sabırlı olun...";
    scanBtn.disabled = true;

    chrome.tabs.sendMessage(tab.id, { action: "startScan" }, (response) => {
        scanBtn.innerText = "Yeniden Tara";
        scanBtn.disabled = false;
        resultsDiv.innerHTML = "";

        if (response && response.data.length > 0) {
            currentResults = response.data;
            document.getElementById('count').innerText = `${currentResults.length} bulgu`;
            document.getElementById('downloadBtn').style.display = "block";

            currentResults.forEach(item => {
                const div = document.createElement('div');
                div.className = `key-item conf-${item.confidence}`;
                div.innerHTML = `
                    <div class="label">${item.type.toUpperCase()} [${item.confidence}]</div>
                    <div class="value">${item.value}</div>
                    <div class="source">Kaynak: ${item.source.substring(0, 50)}...</div>
                `;
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.innerHTML = "Temiz! Hassas veri bulunamadı.";
            document.getElementById('downloadBtn').style.display = "none";
        }
    });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(currentResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-results-${new Date().getTime()}.json`;
    a.click();
});
