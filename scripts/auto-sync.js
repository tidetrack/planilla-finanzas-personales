const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoPath = path.resolve(__dirname, '..');
let debounceTimer;

const DEBOUNCE_MS = 10000; // 10 segundos agrupando cambios antes de commitear

console.log(`🚀 Iniciando Github Auto-Sync (Autopilot) en ${repoPath}`);
console.log(`👀 Observando archivos de manera continua... (Presioná CTRL+C para detener)`);

// Realiza un push inicial al arrancar por si quedaron cosas colgadas
try {
    const status = execSync('git status --porcelain', { cwd: repoPath }).toString();
    if (status.trim().length > 0) {
        console.log(`[INIT] Cambios iniciales detectados. Sincronizando...`);
        execSync('git add .', { cwd: repoPath });
        execSync('git commit -m "chore(auto): push inicial de sincronización continua"', { cwd: repoPath });
        execSync('git push', { cwd: repoPath });
        console.log(`✅ Sincronización inicial exitosa.`);
    }
} catch (e) {
    // ignorar error inicial
}

fs.watch(repoPath, { recursive: true }, (eventType, filename) => {
    // Ignorar cambios dentro del propio .git para no hacer loops infinitos
    if (filename && (filename.includes('.git') || filename.includes('node_modules'))) return;
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        try {
            const status = execSync('git status --porcelain', { cwd: repoPath }).toString();
            if (status.trim().length > 0) {
                const time = new Date().toLocaleTimeString();
                console.log(`[${time}] Modificación en '${filename}'. Sincronizando con GitHub...`);
                execSync('git add .', { cwd: repoPath });
                execSync('git commit -m "chore(auto): backup del proyecto (autopilot)"', { cwd: repoPath });
                execSync('git push', { cwd: repoPath });
                console.log(`✅ Push exitoso.`);
            }
        } catch (error) {
            console.error(`❌ Error en sincronización:`, error.message);
        }
    }, DEBOUNCE_MS); 
});
