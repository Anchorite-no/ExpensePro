/**
 * ExpensePro Launcher
 * - Cleans up residual processes on ports 3001/5173 before starting
 * - Ensures local env and dependencies exist
 * - Pushes the schema to the local database
 * - Spawns the backend and frontend together
 * - Kills the child process tree on exit
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT_DIR = __dirname;
const SERVER_DIR = path.join(ROOT_DIR, "server");
const CLIENT_DIR = path.join(ROOT_DIR, "client");
const SERVER_ENV_PATH = path.join(SERVER_DIR, ".env");
const SERVER_ENV_EXAMPLE_PATH = path.join(SERVER_DIR, ".env.example");
const PORTS = [3001, 5173];
const isWin = os.platform() === "win32";

function runCommand(command, options = {}) {
  execSync(command, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    ...options,
  });
}

function killPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    if (!out) return;

    const pids = [...new Set(out.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
    for (const pid of pids) {
      if (pid === "0" || pid === String(process.pid)) continue;
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { timeout: 3000, stdio: "ignore" });
        console.log(`  Killed residual process PID ${pid} on port ${port}`);
      } catch {
        // Ignore already-exited processes.
      }
    }
  } catch {
    // Nothing is listening on the port.
  }
}

function ensureServerEnv() {
  if (fs.existsSync(SERVER_ENV_PATH)) return;

  if (!fs.existsSync(SERVER_ENV_EXAMPLE_PATH)) {
    throw new Error("server/.env.example is missing. Cannot bootstrap local environment.");
  }

  fs.copyFileSync(SERVER_ENV_EXAMPLE_PATH, SERVER_ENV_PATH);
  console.log("Created server/.env from server/.env.example.");
  console.log("Please update DATABASE_URL in server/.env if your local MySQL password is different.\n");
}

function readDatabaseUrl() {
  const envContent = fs.readFileSync(SERVER_ENV_PATH, "utf8");
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing in server/.env.");
  }

  return match[1].replace(/^["']|["']$/g, "").trim();
}

function validateServerEnv() {
  const databaseUrl = readDatabaseUrl();
  if (!databaseUrl || databaseUrl.includes("your_password")) {
    throw new Error("Please set a real DATABASE_URL in server/.env before starting ExpensePro.");
  }
}

function ensureDependencies() {
  const targets = [
    { label: "root", dir: ROOT_DIR, installCommand: "npm install" },
    { label: "client", dir: CLIENT_DIR, installCommand: "npm install --prefix client" },
    { label: "server", dir: SERVER_DIR, installCommand: "npm install --prefix server" },
  ];

  for (const target of targets) {
    const nodeModulesPath = path.join(target.dir, "node_modules");
    if (fs.existsSync(nodeModulesPath)) continue;

    console.log(`Installing missing dependencies for ${target.label}...`);
    runCommand(target.installCommand);
  }
}

function prepareLocalDebug() {
  console.log("Checking local debug prerequisites...");
  ensureServerEnv();
  validateServerEnv();
  ensureDependencies();

  console.log("Syncing database schema...");
  runCommand("npm run db:push");
  console.log("Local debug prerequisites are ready.\n");
}

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

try {
  prepareLocalDebug();
} catch (error) {
  console.error("\nStartup failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const child = spawn("npm start", {
  cwd: ROOT_DIR,
  stdio: "inherit",
  shell: true,
});

let exiting = false;

function cleanup() {
  if (exiting) return;
  exiting = true;
  console.log("\nStopping ExpensePro...");

  if (child && child.pid && !child.killed) {
    try {
      if (isWin) {
        execSync(`taskkill /F /T /PID ${child.pid}`, { timeout: 5000, stdio: "ignore" });
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    } catch {
      // Ignore already-exited processes.
    }
  }

  for (const port of PORTS) {
    killPort(port);
  }
  console.log("All processes stopped.");
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGHUP", () => { cleanup(); process.exit(0); });

child.on("exit", (code) => {
  console.log(`\nnpm start exited with code ${code}`);
  cleanup();
  process.exit(code || 0);
});
