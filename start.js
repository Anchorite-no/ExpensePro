/**
 * ExpensePro Launcher
 * - Cleans up residual processes on ports 3001/5173 before starting
 * - Spawns `npm start` (concurrently: server + client)
 * - Kills child process tree on exit (including window close on Windows)
 */

const { spawn, execSync } = require("child_process");
const os = require("os");

const PORTS = [3001, 5173];

// ---- Utility: kill processes listening on a given port (Windows only) ----
function killPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    if (!out) return;
    const pids = [...new Set(out.split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
    for (const pid of pids) {
      if (pid === "0" || pid === String(process.pid)) continue;
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { timeout: 3000, stdio: "ignore" });
        console.log(`  Killed residual process PID ${pid} on port ${port}`);
      } catch { /* already dead */ }
    }
  } catch { /* no process on that port */ }
}

// ---- Startup cleanup ----
console.log("=".repeat(55));
console.log("  ExpensePro - Starting Backend (3001) + Frontend (5173)");
console.log("  Close this window to stop ALL processes.");
console.log("=".repeat(55));
console.log();

console.log("Cleaning up residual processes...");
for (const port of PORTS) {
  killPort(port);
}
console.log("Cleanup done.\n");

// ---- Launch npm start ----
const isWin = os.platform() === "win32";
const child = spawn(isWin ? "npm.cmd" : "npm", ["start"], {
  stdio: "inherit",
  // Do NOT detach — we want the child tied to this process
});

let exiting = false;

function cleanup() {
  if (exiting) return;
  exiting = true;
  console.log("\nStopping ExpensePro...");

  // Kill the direct child process tree
  if (child && child.pid && !child.killed) {
    try {
      if (isWin) {
        // taskkill /T kills the entire process tree
        execSync(`taskkill /F /T /PID ${child.pid}`, { timeout: 5000, stdio: "ignore" });
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    } catch { /* already dead */ }
  }

  // Also sweep ports in case anything leaked
  for (const port of PORTS) {
    killPort(port);
  }
  console.log("All processes stopped.");
}

// ---- Register exit handlers ----
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
// Windows: console window close, Ctrl+Break, logoff, shutdown
process.on("SIGHUP", () => { cleanup(); process.exit(0); });

child.on("exit", (code) => {
  console.log(`\nnpm start exited with code ${code}`);
  cleanup();
  process.exit(code || 0);
});
