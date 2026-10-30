#!/usr/bin/env bash
# Prepare a server to run cloud phones (Redroid). Ubuntu 22.04 / 24.04, ARM64 strongly recommended.
#   sudo ANDROID_VERSIONS="13 12" bash install-phone-host.sh
# Ends with a test: boots one Android container and waits until it has started.
set -euo pipefail

VERSIONS="${ANDROID_VERSIONS:-13}"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

ARCH="$(uname -m)"
if [ "$ARCH" != "aarch64" ]; then
  echo "WARNING: this server is $ARCH, not ARM64. Most Android games ship ARM-only code and"
  echo "         won't open on x86 phones. Continue only for testing."
fi

echo "==> Packages (Docker, ADB, extra kernel modules)"
apt-get update -q
apt-get install -y -q docker.io adb
apt-get install -y -q "linux-modules-extra-$(uname -r)" 2>/dev/null || echo "    (no linux-modules-extra package for this kernel — binder may be built in)"
systemctl enable --now docker >/dev/null

echo "==> binder (required by Android)"
echo binder_linux > /etc/modules-load.d/redroid.conf
echo 'options binder_linux devices="binder,hwbinder,vndbinder"' > /etc/modprobe.d/redroid.conf
if ! modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null && ! grep -q binder /proc/filesystems; then
  echo
  echo "FAILED: this kernel has no binder support."
  echo "  - Container-based VPS (LXC/OpenVZ) can't load kernel modules: use a KVM VPS or a dedicated server."
  echo "  - On KVM, try a generic Ubuntu kernel (apt install linux-generic, reboot) and run this again."
  exit 1
fi
echo "    binder OK"

echo "==> Android images: $VERSIONS"
for v in $VERSIONS; do docker pull -q "redroid/redroid:${v}.0.0-latest"; done

echo "==> Remote-control user 'deploy' (for a separate dashboard server)"
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> Test: boot one phone (up to 3 minutes)"
FIRST="$(echo "$VERSIONS" | awk '{print $1}')"
docker rm -f jp-selftest >/dev/null 2>&1 || true
docker run -d --rm --privileged --name jp-selftest -p 127.0.0.1:5599:5555 "redroid/redroid:${FIRST}.0.0-latest" \
  androidboot.redroid_width=720 androidboot.redroid_height=1280 androidboot.redroid_dpi=320 androidboot.use_memfd=true >/dev/null
ok=""
for _ in $(seq 1 60); do
  adb connect 127.0.0.1:5599 >/dev/null 2>&1 || true
  if [ "$(adb -s 127.0.0.1:5599 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then ok=1; break; fi
  sleep 3
done
echo "    Android: $(adb -s 127.0.0.1:5599 shell getprop ro.build.version.release 2>/dev/null | tr -d '\r')  CPU ABI: $(adb -s 127.0.0.1:5599 shell getprop ro.product.cpu.abi 2>/dev/null | tr -d '\r')"
adb disconnect 127.0.0.1:5599 >/dev/null 2>&1 || true
docker rm -f jp-selftest >/dev/null 2>&1 || true

if [ -n "$ok" ]; then
  echo
  echo "Phone host ready."
  echo "  Same server as the dashboard: set ENGINE=redroid in /etc/jpphone.env and restart jpphone."
  echo "  Separate server: add the dashboard's SSH key to /home/deploy/.ssh/authorized_keys and"
  echo "  connect both servers over WireGuard (see deploy/README.md)."
else
  echo "FAILED: Android didn't finish booting. Check: docker logs (re-run the docker run line above without --rm)."
  exit 1
fi
