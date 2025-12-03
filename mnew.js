const fs = require('fs');
const https = require('https');
const { spawn, exec } = require('child_process');
const path = require('path');

// ==========================================
// ⚙️ KONFIGURASI (WAJIB DIGANTI)
// ==========================================
const CONFIG = {
    wallet: "RRBLBzMc6w6wBxq2XCDqAJ8kymF1fJmQEn", // Ganti Wallet VRSC Anda
    worker: "Andyy1955vip",                        // Nama Worker
    pool: "stratum+tcp://na.luckpool.net:3956",  // Pool
    cpu_threads: 4                               // Jumlah Core CPU
};

// ==========================================
// 🔧 SYSTEM (JANGAN UBAH)
// ==========================================
const MINER_URL = "https://github.com/hellcatz/hminer/releases/download/v0.59.1/hellminer_linux64.tar.gz";
const MINER_PATH = path.join(__dirname, 'hellminer');
const ARCHIVE_NAME = path.join(__dirname, 'miner.tar.gz');

// Variabel Penyimpanan Data Realtime
let stats = {
    balance: 0,
    paid: 0,
    priceIDR: 0,
    hashrate: "0 MH/s",
    shares: 0
};

// Warna & Style Console
const COLOR = {
    reset: "\x1b[0m",
    green: "\x1b[32m",    // Sukses
    yellow: "\x1b[33m",   // Warning/Info
    cyan: "\x1b[36m",     // Dekorasi
    red: "\x1b[31m",      // Error
    magenta: "\x1b[35m",  // Uang/Angka
    bold: "\x1b[1m"
};

// ==========================================
// 🚀 FUNGSI UTAMA
// ==========================================
async function start() {
    console.clear();
    console.log(`${COLOR.cyan}${COLOR.bold}╔═══════════════════════════════════════════════╗`);
    console.log(`║      🚀 VERUS COIN MINER PRO MONITOR 🚀       ║`);
    console.log(`╚═══════════════════════════════════════════════╝${COLOR.reset}`);

    // 1. Download Miner Jika Tidak Ada
    if (!fs.existsSync(MINER_PATH)) {
        console.log(`${COLOR.yellow}[SYSTEM] Miner belum ada. Sedang download...${COLOR.reset}`);
        await downloadMiner();
    }

    // 2. Mulai Background Service (Cek Harga & Saldo)
    console.log(`${COLOR.green}[SYSTEM] Memulai service monitoring keuangan...${COLOR.reset}`);
    updateFinancialData(); // Jalankan sekali di awal
    
    // Update data setiap 60 detik (biar gak kena limit API)
    setInterval(updateFinancialData, 60000); 

    // 3. Jalankan Miner
    runMiner();
}

// ==========================================
// 💸 LOGIC KEUANGAN (API)
// ==========================================
function updateFinancialData() {
    // 1. Ambil Harga VRSC ke Rupiah dari CoinGecko
    https.get('https://api.coingecko.com/api/v3/simple/price?ids=verus-coin&vs_currencies=idr', (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json['verus-coin']) stats.priceIDR = json['verus-coin'].idr;
            } catch(e) {}
        });
    }).on('error', () => {});

    // 2. Ambil Saldo dari Luckpool
    https.get(`https://luckpool.net/verus/miner/${CONFIG.wallet}`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.balance) stats.balance = parseFloat(json.balance);
                if (json.paid) stats.paid = parseFloat(json.paid);
            } catch(e) {}
        });
    }).on('error', () => {});
}

// ==========================================
// ⛏️ MINER ENGINE & CUSTOM LOG
// ==========================================
function runMiner() {
    // Beri izin execute
    if (fs.existsSync(MINER_PATH)) exec(`chmod +x ${MINER_PATH}`);

    const miner = spawn(MINER_PATH, [
        '-c', CONFIG.pool,
        '-u', `${CONFIG.wallet}.${CONFIG.worker}`,
        '-p', 'x',
        '--cpu', CONFIG.cpu_threads
    ]);

    // Tangkap Output Miner
    miner.stdout.on('data', (data) => {
        const text = data.toString().trim();
        processLog(text);
    });

    miner.stderr.on('data', (data) => {
        // Log error miner biasanya info penting juga
        processLog(data.toString().trim());
    });

    miner.on('close', (code) => {
        console.log(`${COLOR.red}[STOP] Miner mati (Code ${code}). Restart 5 detik...${COLOR.reset}`);
        setTimeout(runMiner, 5000);
    });
}

function processLog(rawText) {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // CASE 1: SHARE ACCEPTED (UANG MASUK)
    if (rawText.includes("accepted") || rawText.includes("Yes!")) {
        stats.shares++;
        const estRupiah = Math.floor(stats.balance * stats.priceIDR).toLocaleString('id-ID');
        
        console.log(
            `${COLOR.green}[${time}] ✅ SHARE MASUK!${COLOR.reset} ` +
            `| ${COLOR.cyan}Ping: OK${COLOR.reset} ` +
            `| ${COLOR.magenta}💰 Pool: ${stats.balance.toFixed(6)} VRSC (Rp ${estRupiah})${COLOR.reset}`
        );
    } 
    // CASE 2: HASHRATE/SPEED
    else if (rawText.includes("Speed") || rawText.includes("MH/s")) {
        // Ambil angka hashrate pakai Regex
        const match = rawText.match(/Speed:\s*([\d.]+)\s*MH\/s/);
        const speed = match ? match[1] : "0.00";
        
        console.log(
            `${COLOR.cyan}[${time}] ⚡ MINING..${COLOR.reset}   ` +
            `| Speed: ${COLOR.bold}${speed} MH/s${COLOR.reset} ` +
            `| Total Shares: ${stats.shares}`
        );
    }
    // CASE 3: ERROR / REJECTED
    else if (rawText.includes("rejected") || rawText.includes("auth failed")) {
        console.log(`${COLOR.red}[${time}] ❌ DITOLAK/ERROR: ${rawText}${COLOR.reset}`);
    }
    // CASE 4: LOG SAMPAH/KONEKSI (Sembunyikan atau tampilkan tipis)
    else if (rawText.includes("Stratum")) {
        console.log(`${COLOR.yellow}[${time}] 🔌 KONEKSI: ${rawText}${COLOR.reset}`);
    }
}

// ==========================================
// 📥 DOWNLOADER ENGINE
// ==========================================
function downloadMiner() {
    return new Promise((resolve) => {
        const file = fs.createWriteStream(ARCHIVE_NAME);
        https.get(MINER_URL, (res) => {
            // Handle Redirect
            if (res.statusCode === 301 || res.statusCode === 302) {
                https.get(res.headers.location, (res2) => {
                    res2.pipe(file);
                    res2.on('end', () => finishDownload(resolve));
                });
                return;
            }
            res.pipe(file);
            res.on('end', () => finishDownload(resolve));
        });
    });
}

function finishDownload(resolve) {
    console.log(`${COLOR.green}[SYSTEM] Download selesai. Mengekstrak...${COLOR.reset}`);
    const tar = spawn('tar', ['-xvf', 'miner.tar.gz']);
    tar.on('close', () => {
        // Auto rename jika perlu
        const files = fs.readdirSync(__dirname);
        const bin = files.find(f => f.includes('hellminer') && !f.endsWith('.gz') && !f.endsWith('.js'));
        if (bin && bin !== 'hellminer') fs.renameSync(path.join(__dirname, bin), MINER_PATH);
        resolve();
    });
}

start();