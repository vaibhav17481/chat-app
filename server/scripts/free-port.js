#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PORT, serverRoot } from "../src/config/env.js";

const sleep = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const run = (command, args) => {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
};

const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Every pid that listens on the given port. */
const findListeningPids = (port) => {
  const pids = new Set();

  // lsof is available on Linux and on macOS.
  run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
    .split("\n")
    .forEach((line) => {
      const pid = Number(line.trim());

      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    });

  // ss is the fallback for the systems without lsof.
  if (pids.size === 0) {
    const output = run("ss", ["-ltnpH", `sport = :${port}`]);

    for (const match of output.matchAll(/pid=(\d+)/g)) {
      pids.add(Number(match[1]));
    }
  }

  // fuser is the last resort.
  if (pids.size === 0) {
    run("fuser", ["-n", "tcp", String(port)])
      .split(/\s+/)
      .forEach((line) => {
        const pid = Number(line.trim());

        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      });
  }

  return [...pids];
};

/** The command line of a process. */
const readCmdline = (pid) => {
  try {
    return fs
      .readFileSync(`/proc/${pid}/cmdline`, "utf8")
      .replace(/\0/g, " ")
      .trim();
  } catch {
    // macOS has no /proc.
    return run("ps", ["-o", "command=", "-p", String(pid)]).trim();
  }
};

/** Every process of the machine with its pid and its command line. */
const listProcesses = () => {
  const processes = [];

  try {
    fs.readdirSync("/proc")
      .filter((entry) => /^\d+$/.test(entry))
      .forEach((entry) => {
        const cmdline = readCmdline(entry);

        if (cmdline) processes.push({ pid: Number(entry), cmdline });
      });

    return processes;
  } catch {
    // macOS has no /proc.
    run("ps", ["-Ao", "pid=,command="])
      .split("\n")
      .forEach((line) => {
        const match = line.trim().match(/^(\d+)\s+(.*)$/);

        if (match) processes.push({ pid: Number(match[1]), cmdline: match[2] });
      });

    return processes;
  }
};

const readCwd = (pid) => {
  try {
    return fs.realpathSync(`/proc/${pid}/cwd`);
  } catch {
    // macOS has no /proc, lsof knows the working directory too.
    const output = run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);

    return output.split("\n").find((line) => line.startsWith("n/"))?.slice(1);
  }
};

/** True when the process runs this project and can be stopped safely. */
const belongsToProject = (pid, cmdline) => {
  const cwd = readCwd(pid);

  if (cwd && path.resolve(cwd) === serverRoot) return true;

  return cmdline.includes(path.join(serverRoot, "src", "server.js"));
};

/** The watcher of a previous "npm run dev" of this project. */
const isProjectWatcher = (pid, cmdline) => {
  if (!belongsToProject(pid, cmdline)) return false;

  return (
    cmdline.includes(path.join(serverRoot, "node_modules", ".bin", "nodemon")) ||
    cmdline.includes("nodemon src/server.js")
  );
};

const stop = (pid) => {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    if (!isRunning(pid)) return;

    sleep(100);
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process is already gone.
  }
};

const ownPids = new Set([process.pid, process.ppid]);
const processes = listProcesses();

const watchers = processes.filter(
  ({ pid, cmdline }) => !ownPids.has(pid) && isProjectWatcher(pid, cmdline)
);

for (const { pid, cmdline } of watchers) {
  console.log(`Stopping the previous dev server (${cmdline}).`);
  stop(pid);
}

const pids = findListeningPids(PORT).filter((pid) => !ownPids.has(pid));

if (pids.length === 0) {
  console.log(`Port ${PORT} is free.`);
  process.exit(0);
}

let blocked = false;

for (const pid of pids) {
  const cmdline = readCmdline(pid) || `pid ${pid}`;

  if (!belongsToProject(pid, cmdline)) {
    console.error(
      `Port ${PORT} is used by ${cmdline}, which does not belong to this project.\n` +
        `Stop it manually and start the server again.`
    );
    blocked = true;
    continue;
  }

  console.log(`Stopping the server on port ${PORT} (${cmdline}).`);
  stop(pid);
}

if (blocked) {
  process.exit(1);
}
