#!/usr/bin/env python3
"""
7handsetup.py — deploy the FlaccidFacade/7hand stack on a Raspberry Pi (arm64).

Usage (run as root or with sudo):
    sudo python3 7handsetup.py os          # §2: update, timezone, swap check
    sudo python3 7handsetup.py docker     # §3: Docker Engine + compose plugin
    sudo python3 7handsetup.py app         # §4: clone repo + write .env
    sudo python3 7handsetup.py start       # §5/8: add frontend restart policy, compose up
    sudo python3 7handsetup.py verify      # §6: health checks + log assertions
    sudo python3 7handsetup.py firewall   # §10: ufw rules (22, 5353, 8000, 8443)
    sudo python3 7handsetup.py backup      # §9: pg_dump to ./backups/
    sudo python3 7handsetup.py restore FILE
    sudo python3 7handsetup.py update      # §9: git pull + rebuild + restart
    sudo python3 7handsetup.py reset-db    # §9: removes volume (DESTRUCTIVE)
    sudo python3 7handsetup.py all        # os -> docker -> app -> start -> verify

Verify each phase ends with OK. Nothing here exposes ports beyond 8000 (+22/5353/8443).
"""

import argparse
import datetime
import os
import platform
import re
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

REPO_URL = "https://github.com/FlaccidFacade/7hand.git"
APP_DIR = Path("/opt/sevenhand")           # clone target; change via --dir
PROD_SERVICES = ["sevenhand-proxy", "frontend", "backend", "db"]
EXPECTED_BOOT_LINES = ["Database migrations complete", "Backend listening on port 3000"]
DOCKER_GPG_URL = "https://download.docker.com/linux/debian/gpg"  # per https://docs.docker.com/engine/install/debian/


def run(cmd: list[str], capture: bool = False, check: bool = True,
        cwd: Path | None = None, shell: bool = False, quiet: bool = False):
    """Run a command, echoing it unless quiet."""
    if not quiet:
        print(f"  $ {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    env = None
    if isinstance(cmd, list) and cmd and cmd[0] == "apt-get":
        # Ensure unattended apt operations during setup runs.
        env = os.environ.copy()
        env.setdefault("DEBIAN_FRONTEND", "noninteractive")
        env.setdefault("APT_LISTCHANGES_FRONTEND", "none")
        env.setdefault("NEEDRESTART_MODE", "a")
    r = subprocess.run(cmd, cwd=cwd, shell=shell, capture_output=capture, text=True, env=env)
    if check and r.returncode != 0:
        out = (r.stdout or "") + (r.stderr or "")
        die(f"command failed ({r.returncode}): {cmd}\n{out.strip()[:500]}")
    return r


def die(msg: str):
    print(f"\n✗ FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def ok(msg: str):
    print(f"  ✓ {msg}")


def assert_pi_arm64():
    if platform.machine() != "aarch64":
        die(f"expected aarch64 (64-bit Pi OS), got {platform.machine()}. "
            "Re-flash with Raspberry Pi OS Lite (64-bit).")
    if not Path("/proc/device-tree/model").exists() and "raspberrypi" not in open("/proc/cpuinfo").read().lower():
        print("  ! not detected as a Raspberry Pi — continuing anyway")


def check_root():
    if os.geteuid() == 0:
        ok("running as root")
        return
    die("must run as root (sudo)")


def check_memory_and_swap():
    info = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        k, _, v = line.partition(":")
        info[k] = int(v.strip().split()[0])
    mem_gb = round(info["MemTotal"] / 1024 / 1024, 1)
    swap_mb = info["SwapTotal"] // 1024
    print(f"  RAM: {mem_gb} GB, swap: {swap_mb} MB")
    if mem_gb <= 2.2 and swap_mb < 2048:
        print("  ! <=2GB RAM with little swap: the Angular production build WILL likely OOM.")
        print("    Fix: add swap (see §5 of the guide) or buildx cross-build on another machine:")
        print("    https://docs.docker.com/build/building/multi-platform/")
    elif mem_gb >= 3.5:
        ok("RAM sufficient for on-device build")


# ---------------------------------------------------------------- §2 OS setup
def cmd_os(args):
    check_root(); assert_pi_arm64()
    print("[1/4] apt update + full-upgrade (slow the first time)")
    run(["apt-get", "update", "-y"])
    run(["apt-get", "full-upgrade", "-y"])
    print("[2/4] timezone")
    tz = args.timezone
    if tz:
        run(["timedatectl", "set-timezone", tz])
    cur = run(["timedatectl"], capture=True).stdout
    ok(f"timezone: {next(l.strip() for l in cur.splitlines() if 'Time zone' in l)}")
    print("[3/4] enable/boot check for Docker")
    run(["systemctl", "enable", "docker"], check=False)  # ok if docker not installed yet
    print("[4/4] memory assessment")
    check_memory_and_swap()
    ip = run(["hostname", "-I"], capture=True).stdout.split()
    ok(f"LAN IP(s): {', '.join(ip)} — reserve one at your router (DHCP reservation)")


# ------------------------------------------------------------- §3 docker
def cmd_docker(args):
    check_root(); assert_pi_arm64()
    if shutil.which("docker") and shutil.which("docker-compose") is not None:
        ok("docker already installed")
        run(["docker", "--version"])
        return
    if shutil.which("docker"):
        ok("docker present")
    else:
        print("[1/4] install prerequisites + Docker's official apt repo")
        print("      (follows https://docs.docker.com/engine/install/debian/)")
        run(["apt-get", "update", "-y"])
        run(["apt-get", "install", "-y", "ca-certificates", "curl", "gnupg"])
        run(["install", "-m", "0755", "-d", "/etc/apt/keyrings"])
        r = run(["curl", "-fsSL", DOCKER_GPG_URL], capture=True, check=True)
        g = subprocess.run(["gpg", "--dearmor"], input=r.stdout.encode(),
                           capture_output=True, check=True)
        Path("/etc/apt/keyrings/docker.gpg").write_bytes(g.stdout)
        run(["chmod", "a+r", "/etc/apt/keyrings/docker.gpg"])
        codename = subprocess.getoutput(". /etc/os-release && echo $VERSION_CODENAME")
        repo_line = (f"deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] "
                     f"https://download.docker.com/linux/debian {codename} stable")
        Path("/etc/apt/sources.list.d/docker.list").write_text(repo_line + "\n")
        run(["apt-get", "update", "-y"])
        run(["apt-get", "install", "-y", "docker-ce", "docker-ce-cli",
             "containerd.io", "docker-buildx-plugin", "docker-compose-plugin"])

    print("[2/4] docker group for your user (so you don't need sudo)")
    user = args.user or "pi-admin"
    if args.user:
        run(["usermod", "-aG", "docker", user])
        ok(f"'{user}' added to docker group (log out/in to take effect)")

    print("[3/4] smoke test")
    out = run(["docker", "run", "--rm", "hello-world"], capture=True)
    ok("hello-world ran") if "Hello from Docker" in out.stdout else die(out.stdout)

    print("[4/4] compose plugin")
    run(["docker", "compose", "version"])
    ok("docker + compose ready")


# --------------------------------------------------------------- §4 app
def cmd_app(args):
    check_root()
    d = Path(args.dir)
    print(f"[1/3] clone to {d}")
    if (d / ".git").exists():
        ok("repo already cloned")
    else:
        run(["git", "clone", REPO_URL, str(d)])
    print("[2/3] write .env next to docker-compose.yml")
    env_path = d / ".env"
    if env_path.exists():
        ok(".env already exists — leaving it alone (never overwrite a live DB password)")
        return
    pw = secrets.token_urlsafe(24)
    env_path.write_text(
        "# 7hand overrides — Compose interpolates these into the backend pool\n"
        "# vars AND DATABASE_URL; do NOT set DATABASE_URL separately.\n"
        "# Ref: https://docs.docker.com/compose/environment-variables/env-file/\n"
        "DB_PASSWORD=%s\n" % pw)
    env_path.chmod(0o600)
    print(f"[3/3] BACK THIS UP — Postgres remembers this password forever:\n"
          f"      DB_PASSWORD={pw}")
    print("  ! If you change DB_PASSWORD later, the existing volume keeps the OLD one;")
    print("    either recreate the volume (reset-db, loses data) or ALTER USER in psql.")


# --------------------------------------------------------- §5/§8 start
def ensure_frontend_restart_policy(compose_file: Path) -> bool:
    """Add 'restart: unless-stopped' to the frontend service if absent (§8).
    Returns True if the file was modified."""
    text = compose_file.read_text()
    m = re.search(r"(?ms)^  frontend:.*?(?=^  \w|\Z)", text)
    if not m:
        die(f"could not locate 'frontend' service in {compose_file} — check the file")
    block = m.group(0)
    if re.search(r"^\s+restart:", block, re.M):
        ok("frontend already has a restart policy")
        return False
    patched = block.rstrip("\n") + "\n    restart: unless-stopped\n"
    compose_file.write_text(text.replace(block, patched))
    ok("added 'restart: unless-stopped' to frontend "
       "(ref: https://docs.docker.com/engine/containers/start-containers-automatically/)")
    return True


def compose(*args, d: Path, check=True, capture=False):
    return run(["docker", "compose", *args], cwd=d, check=check, capture=capture)


def cmd_start(args):
    d = Path(args.dir)
    cf = d / "docker-compose.yml"
    if not cf.exists():
        die(f"{cf} not found — run the 'app' step first")
    print("[1/3] ensure .env and frontend restart policy")
    if not (d / ".env").exists():
        die(".env missing — run the 'app' step first (password must be set BEFORE first start)")
    if ensure_frontend_restart_policy(cf):
        print("  (frontend service patched; other services keep their existing policies)")
    print("[2/3] build + start ONLY production services (never selenium-*/frontend-dev)")
    print("      Angular production build takes 10-20+ min on a Pi — this is normal.")
    compose("up", "-d", "--build", *PROD_SERVICES, d=d)
    print("[3/3] recent backend startup logs")
    compose("logs", "--tail", "120", "backend", d=d, check=False)


# ------------------------------------------------------------ §6 verify
def cmd_verify(args):
    d = Path(args.dir)
    print("[1/4] containers")
    ps = compose("ps", d=d, capture=True).stdout
    print("     " + "\n     ".join(ps.splitlines()))
    bad = [s for s in PROD_SERVICES if s not in ps]
    if bad:
        die(f"missing/not-running services: {bad}")

    print("[2/4] proxy /health (nginx only — proves nothing about the DB)")
    r = run(["curl", "-fsS", "http://localhost:8000/health"], capture=True, check=False)
    if r.returncode == 0:
        ok(f"proxy healthy: {r.stdout.strip()[:80]}")
    else:
        die("proxy /health failed — is sevenhand-proxy up?")

    print("[3/4] backend /api/health (checks API + database)")
    r = run(["curl", "-fsS", "http://localhost:8000/api/health"], capture=True, check=False)
    if r.returncode != 0:
        die("/api/health failed while /health passed → backend or DB is down. "
            "'docker compose logs backend':\n"
            "  'PostgreSQL connection error' (w/ attempt N) = waiting for DB, normal;\n"
            "  'Database migration failed' + exit         = migration broke, NOT recoverable by retry.")
    ok(f"backend + DB healthy: {r.stdout.strip()[:120]}")

    print("[4/4] backend log assertions")
    logs = compose("logs", "backend", d=d, capture=True).stdout
    for line in EXPECTED_BOOT_LINES:
        if line in logs:
            ok(f"log contains: '{line}'")
        else:
            die(f"expected log line not found: '{line}' — full log:\n{logs[-1000:]}")
    ip = run(["hostname", "-I"], capture=True).stdout.split()[0]
    print(f"\nALL CHECKS PASSED. Open http://{ip}:8000 (or http://sevenhand.local:8000) "
          f"from a phone/laptop and register + create a lobby.")


# ------------------------------------------------------------ §10 firewall
def cmd_firewall(args):
    check_root()
    if shutil.which("ufw") is None:
        run(["apt-get", "install", "-y", "ufw"])
    print("Default-deny inbound, allow SSH/mDNS/game ports only")
    run(["ufw", "default", "deny", "incoming"])
    run(["ufw", "default", "allow", "outgoing"])
    run(["ufw", "allow", "22/tcp"])        # SSH
    run(["ufw", "allow", "5353/udp"])      # mDNS — omitting this breaks .local resolution
    run(["ufw", "allow", "8000/tcp"])      # sevenhand-proxy (only published port)
    run(["ufw", "allow", "8443/tcp"], check=False)  # optional HTTPS later
    if not args.assume_yes:
        ans = input("Enable ufw now? This may disrupt active SSH if rules above are wrong [yN] ")
        if ans.strip().lower() != "y":
            print("aborted (rules staged; run 'sudo ufw enable' manually)")
            return
    run(["ufw", "--force", "enable"])
    print(run(["ufw", "status", "verbose"], capture=True).stdout)
    print("Backend:3000 / db:5432 are already unpublished (compose network only) — no rule needed.")
    print("Ref: https://manpages.ubuntu.com/manpages/noble/en/man8/ufw.8.html")


# ---------------------------------------------------------- §9 operations
def cmd_backup(args):
    d = Path(args.dir)
    bdir = d / "backups"
    bdir.mkdir(exist_ok=True)
    stamp = datetime.date.today().isoformat()
    dest = bdir / f"sevenhand-{stamp}.dump"
    print(f"pg_dump -> {dest}")
    with open(dest, "wb") as f:
        subprocess.run(["docker", "compose", "exec", "-T", "db",
                        "pg_dump", "-U", "card-game", "-d", "card-game-db", "-Fc"],
                       cwd=d, stdout=f, check=True)
    ok(f"wrote {dest} ({dest.stat().st_size // 1024} KiB)")


def cmd_restore(args):
    d = Path(args.dir)
    src = Path(args.file)
    if not src.is_file():
        die(f"no such file: {src}")
    print(f"restoring {src}")
    with open(src, "rb") as f:
        subprocess.run(["docker", "compose", "exec", "-T", "db",
                        "pg_restore", "-U", "card-game", "-d", "card-game-db",
                        "--clean", "--if-exists"], cwd=d, stdin=f, check=True)
    ok("restore complete")


def cmd_update(args):
    d = Path(args.dir)
    print("[1/2] git pull")
    run(["git", "pull"], cwd=d)
    print("[2/2] rebuild + restart (10-20+ min for the Angular build)")
    compose("up", "-d", "--build", *PROD_SERVICES, d=d)
    ok("updated")


def cmd_reset_db(args):
    check_root()
    d = Path(args.dir)
    volumes = run(["docker", "volume", "ls", "--format", "{{.Name}}"],
                  capture=True).stdout.split()
    matches = [v for v in volumes if v.endswith("db-data")]
    if len(matches) != 1:
        die(f"expected exactly one '*db-data' volume, found {matches}")
    if not args.yes:
        ans = input(f"DESTROY {matches[0]} (all game/user data)? Type the volume name to confirm: ")
        if ans.strip() != matches[0]:
            print("aborted")
            return
    compose("down", d=d)
    run(["docker", "volume", "rm", matches[0]])
    compose("up", "-d", *PROD_SERVICES, d=d)
    print("DB recreated with the CURRENT .env password. Old backups are the only recovery.")


def cmd_all(args):
    for fn in (cmd_os, cmd_docker, cmd_app, lambda a: cmd_start(a), cmd_verify):
        fn(args)
        print()


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dir", default=str(APP_DIR), help="clone/deployment directory")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("os").add_argument("--timezone", "-tz", default="America/New_York")
    dp = sub.add_parser("docker"); dp.add_argument("--user", "-u", default=None)
    sub.add_parser("app")
    sub.add_parser("start")
    sub.add_parser("verify")
    fp = sub.add_parser("firewall"); fp.add_argument("-y", "--assume-yes", action="store_true")
    sub.add_parser("backup")
    rp = sub.add_parser("restore"); rp.add_argument("file")
    sub.add_parser("update")
    xp = sub.add_parser("reset-db"); xp.add_argument("-y", "--yes", action="store_true")
    sub.add_parser("all")
    args = p.parse_args()
    {"os": cmd_os, "docker": cmd_docker, "app": cmd_app, "start": cmd_start,
     "verify": cmd_verify, "firewall": cmd_firewall, "backup": cmd_backup,
     "restore": cmd_restore, "update": cmd_update, "reset-db": cmd_reset_db,
     "all": cmd_all}[args.cmd](args)


if __name__ == "__main__":
    main()