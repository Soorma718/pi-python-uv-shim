# pi-python-uv-shim

A Pi extension that installs managed `python` and `python3` shims into Pi's agent bin directory and steers Python usage to `uv`.

## What it does

- Blocks these module invocations:
  - `python -m pip`
  - `python -m venv`
  - `python -m py_compile`
- Prints clear replacement commands for each blocked call.
- Dispatches all other invocations to:

```bash
uv run python "$@"
```

## Why

LLM agents frequently default to `python3 -m pip`, `python3 -m venv`, and `python3 -m py_compile`.
This extension enforces an opinionated workflow that:

- keeps dependency management on `uv`
- avoids accidental `__pycache__` churn from `py_compile`
- gives deterministic command behavior across sessions

## Install

### Option 1: install from GitHub as a Pi package

```bash
pi install git:github.com/<your-username>/pi-python-uv-shim
```

### Option 2: local path install

```bash
pi install /absolute/path/to/pi-python-uv-shim
```

## Verify

Run from a Pi shell session (where Pi prepends `~/.pi/agent/bin` to PATH):

```bash
python -m pip --version      # should fail with guidance
python -m py_compile x.py    # should fail with guidance
python -c 'print("ok")'       # should run via uv
```

## Notes

- On Windows, shim installation is skipped intentionally (to avoid `.cmd/.exe` resolution regressions).
- The extension writes only to Pi's managed agent bin directory (`~/.pi/agent/bin` or `PI_CODING_AGENT_DIR/bin`).

## Security and privacy

- No telemetry.
- No network calls.
- No hardcoded user-specific paths or tokens.
- No data is sent anywhere by this extension.

## License

MIT
