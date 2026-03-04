import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SHIM_HEADER = "# managed-by-pi-extension python-uv-shim v1";
const SHIM_SCRIPT = [
  "#!/usr/bin/env bash",
  SHIM_HEADER,
  "",
  "# Check for disallowed module invocations",
  "for arg in \"$@\"; do",
  "    case \"$arg\" in",
  "        -mpip|-m\\ pip|pip)",
  "            echo \"Error: 'python3 -m pip' is disabled. Use uv instead:\" >&2",
  "            echo \"\" >&2",
  "            echo \"  To install a package for a script: uv run --with PACKAGE python script.py\" >&2",
  "            echo \"  To add a dependency to the project: uv add PACKAGE\" >&2",
  "            echo \"\" >&2",
  "            exit 1",
  "            ;;",
  "        -mvenv|-m\\ venv|venv)",
  "            echo \"Error: 'python3 -m venv' is disabled. Use uv instead:\" >&2",
  "            echo \"\" >&2",
  "            echo \"  To create a virtual environment: uv venv\" >&2",
  "            echo \"\" >&2",
  "            exit 1",
  "            ;;",
  "        -mpy_compile|-m\\ py_compile|py_compile)",
  "            echo \"Error: 'python3 -m py_compile' is disabled because it writes .pyc files to __pycache__.\" >&2",
  "            echo \"\" >&2",
  "            echo \"  To verify syntax without bytecode output: uv run python -m ast path/to/file.py >/dev/null\" >&2",
  "            echo \"\" >&2",
  "            exit 1",
  "            ;;",
  "    esac",
  "done",
  "",
  "# Check for -m flag followed by pip, venv, or py_compile",
  "prev=\"\"",
  "for arg in \"$@\"; do",
  "    if [ \"$prev\" = \"-m\" ]; then",
  "        case \"$arg\" in",
  "            pip)",
  "                echo \"Error: 'python3 -m pip' is disabled. Use uv instead:\" >&2",
  "                echo \"\" >&2",
  "                echo \"  To install a package for a script: uv run --with PACKAGE python script.py\" >&2",
  "                echo \"  To add a dependency to the project: uv add PACKAGE\" >&2",
  "                echo \"\" >&2",
  "                exit 1",
  "                ;;",
  "            venv)",
  "                echo \"Error: 'python3 -m venv' is disabled. Use uv instead:\" >&2",
  "                echo \"\" >&2",
  "                echo \"  To create a virtual environment: uv venv\" >&2",
  "                echo \"\" >&2",
  "                exit 1",
  "                ;;",
  "            py_compile)",
  "                echo \"Error: 'python3 -m py_compile' is disabled because it writes .pyc files to __pycache__.\" >&2",
  "                echo \"\" >&2",
  "                echo \"  To verify syntax without bytecode output: uv run python -m ast path/to/file.py >/dev/null\" >&2",
  "                echo \"\" >&2",
  "                exit 1",
  "                ;;",
  "        esac",
  "    fi",
  "    prev=\"$arg\"",
  "done",
  "",
  "# Dispatch to uv run python",
  "exec uv run python \"$@\"",
  "",
].join("\n");

function resolveAgentDir() {
  const fromEnv = process.env.PI_CODING_AGENT_DIR;
  if (!fromEnv) {
    return join(homedir(), ".pi", "agent");
  }
  if (fromEnv === "~") {
    return homedir();
  }
  if (fromEnv.startsWith("~/")) {
    return join(homedir(), fromEnv.slice(2));
  }
  return fromEnv;
}

function writeManagedShim(shimPath) {
  const existing = existsSync(shimPath) ? readFileSync(shimPath, "utf-8") : null;
  if (existing === SHIM_SCRIPT) {
    return false;
  }

  writeFileSync(shimPath, SHIM_SCRIPT, { mode: 0o755 });
  try {
    chmodSync(shimPath, 0o755);
  } catch {
    // Ignore mode-setting failures on non-POSIX filesystems.
  }
  return true;
}

function ensurePythonUvShims() {
  if (process.platform === "win32") {
    return { changed: [], skipped: true };
  }

  const agentDir = resolveAgentDir();
  const binDir = join(agentDir, "bin");
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const changed = [];
  for (const shimName of ["python", "python3"]) {
    const shimPath = join(binDir, shimName);
    if (writeManagedShim(shimPath)) {
      changed.push(shimName);
    }
  }

  return { changed, skipped: false };
}

export default function pythonUvShimExtension(pi) {
  const applyShims = () => {
    try {
      return { ok: true, ...ensurePythonUvShims() };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  // Enforce immediately when extension loads.
  applyShims();

  // Re-apply after /reload and session startup.
  pi.on("session_start", async (_event, ctx) => {
    const result = applyShims();
    if (!result.ok) {
      ctx.ui.notify(`python-uv-shim error: ${result.error}`, "error");
      return;
    }

    if (!result.skipped && result.changed.length > 0) {
      ctx.ui.notify(`python/uv shims installed: ${result.changed.join(", ")}`, "info");
    }
  });
}
