/**
 * VERUS COIN ULTIMATE MINER & DASHBOARD
 * Features: Auto-Download, Real-time Price (IDR), Luckpool API Sync, Cool UI
 * No npm install required. Native Node.js.
 */

const fs = require('fs');
const https = require('https');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

// ==========================================
// KONFIGURASI PENGGUNA (EDIT DISINI)
// ==========================================
const CONFIG = {
    wallet: "RRBLBzMc6w6wBxq2XCDqAJ8kymF1fJmQEn", // Ganti dengan Wallet VRSC Anda
    worker: "Andyy1955vip",
    pool: "stratum+tcp://na.luckpool.net:3956",
    core: 4 // Jumlah CPU Core yang digunakan
};

// ==========================================
// SYSTEM VARIABLES (JANGAN UBAH)
// ==========================================
const MINER_URL = "https://github.com/hellcatz/hminer/releases/download/v0.59.1/hellminer_linux64.tar.gz";
const MINER_DIR = __dirname;
const MINER_PATH = path.join(MINER_DIR, 'hellminer');
const ARCHIVE_PATH = path.join(MINER_DIR, 'miner.tar.gz');

// Data Monitoring
let stats = {
    hashrate: "0.00 MH/s",
    accepted: 0,
    rejected: 0,
    algo: "VerusHash",
    uptime: 0,
    vrscPriceIDR: 0,
    vrscPriceUSD: 0,
    poolBalance: 0,
    poolHashrate: "0.00",
    lastLog: ["Menunggu log miner..."]
};

// Warna Console
const C = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    bgBlue: "\x1b[44m"
};

// ==========================================
// FUNGSI UTAMA
// ==========================================

async function start() {
    console.clear();
    console.log(`${C.cyan}╔════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.cyan}║   VERUS COIN ULTIMATE MINER DASHBOARD      ║${C.reset}`);
    console.log(`${C.cyan}╚════════════════════════════════════════════╝${C.reset}`);
    
    // 1. Cek Miner
    if (!fs.existsSync(MINER_PATH)) {
        console.log(`${C.yellow}[SYSTEM] Miner tidak ditemukan. Mengunduh...${C.reset}`);
        await downloadMiner();
    }

    // 2. Start Services
    console.log(`${C.green}[SYSTEM] Memulai Mining & Monitoring...${C.reset}`);
    
    // Fetch data awal
    fetchPrice(); 
    fetchPoolStats();

    // Interval Update
    setInterval(updateDashboard, 1000); // Refresh UI tiap detik
    setInterval(fetchPrice, 60000); // Harga tiap 1 menit
    setInterval(fetchPoolStats, 30000); // Pool stats tiap 30 detik
    setInterval(() => { stats.uptime++ }, 1000);

    // Jalankan Miner
    runMiner();
}

// ==========================================
// DASHBOARD UI
// ==========================================
function updateDashboard() {
    // Format Uptime
    const h = Math.floor(stats.uptime / 3600).toString().padStart(2, '0');
    const m = Math.floor((stats.uptime % 3600) / 60).toString().padStart(2, '0');
    const s = (stats.uptime % 60).toString().padStart(2, '0');

    // Estimasi Rupiah (Balance * Harga)
    const estIDR = (stats.poolBalance * stats.vrscPriceIDR).toLocaleString('id-ID');
    const priceIDR = stats.vrscPriceIDR.toLocaleString('id-ID');

    console.clear();
    console.log(`${C.cyan}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.cyan}║ ${C.bright}${C.yellow}⚡ VERUS MINER MONITOR PRO v2.0${C.cyan}                              ║${C.reset}`);
    console.log(`${C.cyan}╠═══════════════════════════════════════════════════════════════╣${C.reset}`);
    
    // INFO SERVER
    console.log(`║ ${C.bright}SERVER INFO${C.reset}`);
    console.log(`║ OS      : ${os.type()} ${os.release()}`);
    console.log(`║ CPU     : ${os.cpus()[0].model}`);
    console.log(`║ Uptime  : ${C.green}${h}:${m}:${s}${C.reset}`);
    console.log(`${C.cyan}╠═══════════════════════════════════════════════════════════════╣${C.reset}`);
    
    // INFO MINING LOCAL
    console.log(`║ ${C.bright}LOCAL MINING STATUS${C.reset}`);
    console.log(`║ Hashrate: ${C.green}${stats.hashrate}${C.reset}`);
    console.log(`║ Shares  : ${C.green}Accepted ${stats.accepted}${C.reset} | ${C.red}Rejected ${stats.rejected}${C.reset}`);
    console.log(`${C.cyan}╠═══════════════════════════════════════════════════════════════╣${C.reset}`);

    // INFO KEUANGAN & POOL
    console.log(`║ ${C.bright}FINANCIAL & POOL (Luckpool)${C.reset}`);
    console.log(`║ Wallet  : ...${CONFIG.wallet.slice(-10)}`);
    console.log(`║ Price   : ${C.yellow}Rp ${priceIDR} / VRSC${C.reset}`);
    console.log(`║ Balance : ${C.green}${stats.poolBalance.toFixed(6)} VRSC${C.reset} (Est: Rp ${estIDR})`);
    console.log(`║ Pool HR : ${stats.poolHashrate}`);
    console.log(`${C.cyan}╠═══════════════════════════════════════════════════════════════╣${C.reset}`);
    
    // LIVE LOGS
    console.log(`║ ${C.bright}LIVE LOGS${C.reset}`);
    const logsToShow = stats.lastLog.slice(-5); // Tampilkan 5 log terakhir
    logsToShow.forEach(log => {
        console.log(`║ > ${log.substring(0, 60)}`);
    });
    console.log(`${C.cyan}╚═══════════════════════════════════════════════════════════════╝${C.reset}`);
}

// ==========================================
// API HANDLERS
// ==========================================
function fetchPrice() {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=verus-coin&vs_currencies=idr,usd";
    https.get(url, { headers: { 'User-Agent': 'NodeMiner/1.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if(json['verus-coin']) {
                    stats.vrscPriceIDR = json['verus-coin'].idr;
                    stats.vrscPriceUSD = json['verus-coin'].usd;
                    addLog(`Harga Update: Rp ${stats.vrscPriceIDR}`);
                }
            } catch (e) {}
        });
    }).on('error', () => {});
}

function fetchPoolStats() {
    const url = `https://luckpool.net/verus/miner/${CONFIG.wallet}`;
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.balance) stats.poolBalance = parseFloat(json.balance);
                if (json.hashrate) stats.poolHashrate = json.hashrate;
            } catch (e) {}
        });
    }).on('error', () => {});
}

// ==========================================
// MINER LOGIC
// ==========================================
function runMiner() {
    exec(`chmod +x ${MINER_PATH}`);
    
    const miner = spawn(MINER_PATH, [
        '-c', CONFIG.pool,
        '-u', `${CONFIG.wallet}.${CONFIG.worker}`,
        '-p', 'x',
        '--cpu', CONFIG.core
    ]);

    miner.stdout.on('data', (data) => {
        const str = data.toString().trim();
        parseLog(str);
        addLog(str);
    });

    miner.stderr.on('data', (data) => {
        addLog(data.toString().trim());
    });

    miner.on('close', (code) => {
        addLog(`${C.red}Miner mati (Code ${code}). Restarting...${C.reset}`);
        setTimeout(runMiner, 5000);
    });
}

function parseLog(log) {
    // Regex untuk mengambil hashrate: "Speed: 5.23 MH/s"
    const speedMatch = log.match(/Speed:\s*([\d.]+)\s*MH\/s/);
    if (speedMatch) stats.hashrate = speedMatch[1] + " MH/s";

    if (log.includes("accepted")) stats.accepted++;
    if (log.includes("rejected")) stats.rejected++;
}

function addLog(msg) {
    // Bersihkan kode warna dari log asli agar dashboard rapi
    const cleanMsg = msg.replace(/\u001b\[.*?m/g, ''); 
    stats.lastLog.push(cleanMsg);
    if (stats.lastLog.length > 10) stats.lastLog.shift();
}

// ==========================================
// DOWNLOADER UTILS
// ==========================================
async function downloadMiner() {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(ARCHIVE_PATH);
        https.get(MINER_URL, (response) => {
            // Handle Redirect
            if (response.statusCode === 301 || response.statusCode === 302) {
                return https.get(response.headers.location, (res2) => {
                    res2.pipe(file);
                    res2.on('end', () => {
                        file.close();
                        extractMiner().then(resolve);
                    });
                });
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                extractMiner().then(resolve);
            });
        });
    });
}

function extractMiner() {
    return new Promise((resolve) => {
        console.log(`${C.yellow}[SYSTEM] Mengekstrak...${C.reset}`);
        const tar = spawn('tar', ['-xvf', 'miner.tar.gz', '-C', MINER_DIR]);
        tar.on('close', () => {
            const files = fs.readdirSync(MINER_DIR);
            const bin = files.find(f => f.includes('hellminer') && !f.endsWith('.gz') && !f.endsWith('.js'));
            if(bin && bin !== 'hellminer') fs.renameSync(path.join(MINER_DIR, bin), MINER_PATH);
            resolve();
        });
    });
}

start();