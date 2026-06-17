import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function spawnProcess(name, command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const exitCode = code ?? (signal ? 1 : 0);
    for (const running of children) {
      if (running !== child && !running.killed) {
        running.kill("SIGTERM");
      }
    }
    process.exitCode = exitCode;
  });

  child.on("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    process.exitCode = 1;
  });

  return child;
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

spawnProcess("web", "npm", ["run", "dev:web"]);
spawnProcess("worker", "npm", ["run", "worker:dev"]);
