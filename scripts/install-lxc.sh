#!/usr/bin/env bash
# Innerhalb eines eigenen Debian-LXC ausführen, nicht auf dem Proxmox-Host.
set -Eeuo pipefail

configure() {
  source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  app_dir=/opt/familien-organisierer
  runtime_root=/opt/familien-organisierer-runtime
  runtime_link=/opt/familien-organisierer-node
  backup_root=/var/backups/familien-organisierer
  unit_file=/etc/systemd/system/familien-organisierer.service
  lock_file=/run/lock/familien-organisierer-install.lock
  os_release=/etc/os-release
  systemd_directory=/run/systemd/system
  service_name=familien-organisierer.service
  service_user=family-organizer
  check_only=false
  node_version=''
  work_dir=''
  stage_dir=''
  previous_app=''
  previous_runtime=''
  database_backup=''
  service_was_active=false
  service_was_enabled=false
  had_unit=false
  service_stopped=false
  app_replaced=false
  runtime_replaced=false
  finished=false
}

say() { printf '%s\n' "$*"; }
die() { printf 'Fehler: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Familien Organisierer – Installation / Update im Debian-LXC

  bash scripts/install-lxc.sh
  bash scripts/install-lxc.sh --check
  bash scripts/install-lxc.sh --node-version v24.21.0

--check         Ziel und Projekt prüfen, ohne etwas zu installieren.
--node-version  Eine bestimmte offizielle Node.js-24-Version verwenden.
Ohne Versionsangabe wird die aktuelle offizielle 24.x-Version verwendet.
HELP
}

check_target() {
  [ "$(id -u)" -eq 0 ] || die 'Als root in der Konsole des LXC ausführen.'
  if command -v pveversion >/dev/null 2>&1 || [ -d /etc/pve ]; then
    die 'Proxmox-Host erkannt. Bitte die Konsole des vorgesehenen LXC öffnen.'
  fi
  command -v systemd-detect-virt >/dev/null 2>&1 || die 'systemd-detect-virt fehlt.'
  local container_kind
  container_kind="$(systemd-detect-virt --container 2>/dev/null || true)"
  case "$container_kind" in lxc|lxc-libvirt) ;; *) die 'Dieses Skript setzt einen LXC-Container voraus.' ;; esac
  [ -d "$systemd_directory" ] || die 'systemd läuft nicht in diesem Container.'
  [ -r "$os_release" ] || die 'Betriebssystem nicht erkannt.'
  local ID='' VERSION_ID=''
  # Diese Datei gehört zum Betriebssystem, nicht zur Anwendungskonfiguration.
  source "$os_release"
  [ "$ID" = debian ] || die 'Unterstützt werden Debian 12 und Debian 13.'
  case "$VERSION_ID" in 12|13) ;; *) die 'Unterstützt werden Debian 12 und Debian 13.' ;; esac
  case "$(uname -m)" in x86_64) node_arch=x64 ;; aarch64) node_arch=arm64 ;; *) die 'Unterstützte Architekturen: x86_64 und aarch64.' ;; esac
  say "Ziel geprüft: Debian $VERSION_ID, LXC, $node_arch."
}

check_source() {
  local item
  for item in server.mjs package.json src public scripts/lxc-config.mjs scripts/backup.mjs deploy/familien-organisierer.service .env.example README.md LICENSE; do
    [ -e "$source_dir/$item" ] || die "Projektdatei fehlt: $item. Bitte das ganze Projekt entpacken/klonen."
  done
  [ ! -L "$app_dir" ] || die 'Der Anwendungsordner darf kein Symlink sein.'
  if [ -e "$app_dir" ] && [ ! -f "$app_dir/server.mjs" ]; then
    die 'Der Zielordner ist bereits durch andere Dateien belegt.'
  fi
  [ ! -e "$runtime_link" ] || [ -L "$runtime_link" ] || die 'Der reservierte Node.js-Pfad ist bereits durch einen normalen Ordner belegt.'
}

download() {
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 15 --max-time 300 --retry 3 "$1" -o "$2"
}

prepare_node() {
  local distribution filename checksum archive_version candidate_dir
  distribution="https://nodejs.org/dist/${node_version:-latest-v24.x}"
  say 'Offizielle Node.js-24-Version und Prüfsumme abrufen …'
  download "$distribution/SHASUMS256.txt" "$work_dir/SHASUMS256.txt"
  filename="$(awk -v arch="$node_arch" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-linux-" arch "\\.tar\\.xz$") {print $2}' "$work_dir/SHASUMS256.txt")"
  [[ "$filename" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || die 'Keine eindeutige passende Node.js-Datei im Manifest.'
  checksum="$(awk -v file="$filename" '$2 == file {print $1}' "$work_dir/SHASUMS256.txt")"
  [[ "$checksum" =~ ^[[:xdigit:]]{64}$ ]] || die 'Ungültige SHA-256-Prüfsumme im Node.js-Manifest.'
  archive_version="${filename#node-}"
  archive_version="${archive_version%-linux-*}"
  [ -z "$node_version" ] || [ "$archive_version" = "$node_version" ] || die 'Node.js-Version passt nicht zum Manifest.'
  candidate_dir="$runtime_root/${filename%.tar.xz}"
  if [ ! -x "$candidate_dir/bin/node" ]; then
    # Versionsfester URL verhindert einen Wechsel der latest-Version zwischen den Downloads.
    download "https://nodejs.org/dist/$archive_version/$filename" "$work_dir/$filename"
    (cd "$work_dir"; printf '%s  %s\n' "$checksum" "$filename" | sha256sum --check --status -) || die 'Node.js-Prüfsumme stimmt nicht. Installation abgebrochen.'
    install -d -m 0755 "$runtime_root"
    mkdir "$work_dir/node"
    tar -xJf "$work_dir/$filename" -C "$work_dir/node" --no-same-owner
    [ -x "$work_dir/node/${filename%.tar.xz}/bin/node" ] || die 'Node.js-Archiv ist unvollständig.'
    mv "$work_dir/node/${filename%.tar.xz}" "$candidate_dir"
  fi
  # Der Dienst läuft als eigener Benutzer und muss die Laufzeit durchqueren können.
  chmod 0755 "$runtime_root"
  chown -R root:root "$candidate_dir"
  chmod -R u+rwX,go+rX,go-w "$candidate_dir"
  selected_runtime="$candidate_dir"
  selected_node="$selected_runtime/bin/node"
  [ "$("$selected_node" --version)" = "$archive_version" ] || die 'Die vorhandene Node.js-Laufzeit passt nicht zur gewählten Version.'
  "$selected_node" --input-type=module -e 'import { DatabaseSync, backup } from "node:sqlite"; if (Number(process.versions.node.split(".")[0]) !== 24 || typeof backup !== "function") process.exit(1); const db = new DatabaseSync(":memory:"); db.close();' || die 'Die Node.js-Laufzeit kann SQLite nicht ausführen.'
  say "Node.js bereit: $("$selected_node" --version)."
}

prepare_app() {
  local item
  stage_dir="$work_dir/app"
  mkdir "$stage_dir"
  # Nur Quellcode kopieren. .git, echte .env, Daten, Bilder und Backups bleiben draußen.
  for item in server.mjs package.json src public scripts deploy docs tests README.md LICENSE PROJECT_STATE.md .env.example .gitignore Dockerfile compose.yaml .dockerignore .github; do
    if [ -e "$source_dir/$item" ]; then cp -a "$source_dir/$item" "$stage_dir/"; fi
  done
  chown -R root:root "$stage_dir"
  chmod -R u+rwX,go+rX,go-w "$stage_dir"
  if [ -e "$app_dir/.env" ]; then
    install -m 0600 "$app_dir/.env" "$stage_dir/.env"
  else
    install -m 0600 "$stage_dir/.env.example" "$stage_dir/.env"
  fi
  local configuration
  configuration="$("$selected_node" "$stage_dir/scripts/lxc-config.mjs" "$stage_dir/.env" "$app_dir" "$runtime_root" "$backup_root")"
  local config_values
  mapfile -t config_values <<< "$configuration"
  data_dir="${config_values[0]}"
  photo_dir="${config_values[1]}"
  health_url="${config_values[2]}"
  expected_version="${config_values[3]}"
  "$selected_node" --check "$stage_dir/server.mjs"
  "$selected_node" --input-type=module - "$stage_dir/deploy/familien-organisierer.service" "$work_dir/new.service" "$app_dir" "$runtime_link" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const [source, target, app, runtime] = process.argv.slice(2);
const unit = readFileSync(source, 'utf8').replaceAll('/opt/familien-organisierer-node', runtime).replaceAll('/opt/familien-organisierer/', app + '/').replaceAll('WorkingDirectory=/opt/familien-organisierer\n', 'WorkingDirectory=' + app + '\n');
writeFileSync(target, unit);
NODE
}

prepare_account() {
  if ! getent passwd "$service_user" >/dev/null; then
    useradd --system --user-group --home-dir "$data_dir" --shell /usr/sbin/nologin "$service_user"
  fi
  install -d -m 0755 "$(dirname "$app_dir")"
  install -d -o "$service_user" -g "$service_user" -m 0700 "$data_dir"
  if [ ! -d "$photo_dir" ]; then install -d -o "$service_user" -g "$service_user" -m 0700 "$photo_dir"; fi
  chown "$service_user:$service_user" "$stage_dir/.env"
  install -d -o root -g root -m 0700 "$backup_root"
}

save_previous() {
  if [ -e "$unit_file" ]; then
    had_unit=true
    cp -a "$unit_file" "$work_dir/previous.service"
  fi
  if [ -L "$runtime_link" ]; then previous_runtime="$(readlink "$runtime_link")"; fi
  if systemctl is-active --quiet "$service_name"; then service_was_active=true; fi
  if systemctl is-enabled --quiet "$service_name"; then service_was_enabled=true; fi
  if $had_unit || $service_was_active; then
    say 'Vorhandenen Dienst für eine ruhende Updatesicherung stoppen …'
    service_stopped=true
    systemctl stop "$service_name"
  fi
  if [ -f "$data_dir/family.sqlite" ]; then
    say 'Datenbank, Schlüssel, Konfiguration und Fotos vor dem Update sichern …'
    database_backup="$(DATA_DIR="$data_dir" PHOTO_DIR="$photo_dir" "$selected_node" "$stage_dir/scripts/backup.mjs" "$backup_root/updates")"
    [ -f "$database_backup/family.sqlite" ] && [ -f "$database_backup/master.key" ] || die 'Die Updatesicherung ist unvollständig.'
    say "Sicherung erstellt: $database_backup"
  fi
}

activate() {
  if [ -d "$app_dir" ]; then
    previous_app="$backup_root/code-$(date -u +%Y%m%dT%H%M%S)-${work_dir##*.}"
    # Kopie in /var/backups funktioniert auch bei verschiedenen Dateisystemen.
    cp -a "$app_dir" "$previous_app"
    chmod 0700 "$previous_app"
    mv "$app_dir" "$work_dir/old-app"
  fi
  mv "$stage_dir" "$app_dir"
  stage_dir=''
  app_replaced=true
  ln -s "$selected_runtime" "$work_dir/node-link"
  mv -Tf "$work_dir/node-link" "$runtime_link"
  runtime_replaced=true
  install -m 0644 "$work_dir/new.service" "$unit_file"
  systemctl daemon-reload
  systemctl enable "$service_name"
  systemctl start "$service_name"
}

wait_for_app() {
  local attempt
  say 'Dienst und HTTP-Antwort prüfen …'
  for attempt in {1..15}; do
    if systemctl is-active --quiet "$service_name" && \
       curl --fail --silent --max-time 2 --noproxy '*' "$health_url" -o "$work_dir/health.json" && \
       "$selected_node" --input-type=module - "$work_dir/health.json" "$expected_version" <<'NODE'
import { readFileSync } from 'node:fs';
try { const health = JSON.parse(readFileSync(process.argv[2], 'utf8')); if (health.ok !== true || health.version !== process.argv[3]) process.exit(1); }
catch { process.exit(1); }
NODE
    then return 0; fi
    sleep 1
  done
  die 'Dienst wurde nicht gesund gestartet. Der vorherige Stand wird wiederhergestellt.'
}

rollback() {
  say 'Installation fehlgeschlagen – vorherigen Stand wiederherstellen …' >&2
  local restore_failed=false
  if ! systemctl stop "$service_name" >/dev/null 2>&1; then
    say "Der Dienst konnte nicht sicher gestoppt werden. Daten wurden nicht zurückkopiert. Arbeitsordner behalten: $work_dir; Sicherungen: $backup_root" >&2
    work_dir=''
    return 1
  fi
  if $app_replaced; then
    # Fehlerhaften Code für die Diagnose privat behalten.
    mv "$app_dir" "$backup_root/failed-code-$(date -u +%Y%m%dT%H%M%S)-${work_dir##*.}" || restore_failed=true
    if [ -d "$work_dir/old-app" ]; then mv "$work_dir/old-app" "$app_dir" || restore_failed=true; fi
    if [ -n "$database_backup" ]; then
      local failed_data="$backup_root/failed-database-$(date -u +%Y%m%dT%H%M%S)-${work_dir##*.}" file
      install -d -m 0700 "$failed_data" || restore_failed=true
      for file in family.sqlite family.sqlite-wal family.sqlite-shm master.key; do
        if [ -e "$data_dir/$file" ]; then mv "$data_dir/$file" "$failed_data/" || restore_failed=true; fi
      done
      install -o "$service_user" -g "$service_user" -m 0600 "$database_backup/family.sqlite" "$data_dir/family.sqlite" || restore_failed=true
      install -o "$service_user" -g "$service_user" -m 0600 "$database_backup/master.key" "$data_dir/master.key" || restore_failed=true
    fi
  elif [ -d "$work_dir/old-app" ]; then
    mv "$work_dir/old-app" "$app_dir" || restore_failed=true
  fi
  if $runtime_replaced; then
    if [ -n "$previous_runtime" ]; then
      ln -s "$previous_runtime" "$work_dir/restore-node-link" && mv -Tf "$work_dir/restore-node-link" "$runtime_link" || restore_failed=true
    else rm -f "$runtime_link" || restore_failed=true; fi
  fi
  if $had_unit; then
    cp -a "$work_dir/previous.service" "$unit_file" || restore_failed=true
  elif $app_replaced; then
    systemctl disable "$service_name" >/dev/null 2>&1 || true
    rm -f "$unit_file" || restore_failed=true
  fi
  systemctl daemon-reload || restore_failed=true
  if $had_unit && ! $service_was_enabled; then systemctl disable "$service_name" >/dev/null 2>&1 || restore_failed=true; fi
  if $service_was_active && ! $restore_failed; then systemctl start "$service_name" || restore_failed=true; fi
  if $restore_failed; then
    say "Automatische Wiederherstellung nicht vollständig. Sicherungen: $backup_root; Arbeitsordner: $work_dir" >&2
    # Die Arbeitskopie wird in diesem Fall ausdrücklich behalten.
    work_dir=''
  elif $had_unit || [ -n "$previous_app" ]; then say 'Vorheriger Stand wiederhergestellt.' >&2
  else say 'Erstinstallation zurückgenommen. Ein bereits erzeugter Datenordner bleibt erhalten.' >&2; fi
}

cleanup() {
  local status=$?
  trap - EXIT ERR INT TERM
  set +e
  if [ "$status" -ne 0 ] && ! $finished && { $service_stopped || $app_replaced || [ -d "${work_dir:-/nonexistent}/old-app" ]; }; then rollback; fi
  if [ -n "$work_dir" ] && [ -d "$work_dir" ]; then rm -rf -- "$work_dir"; fi
  exit "$status"
}

main() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --check) check_only=true ;;
      --node-version) shift; [ "$#" -gt 0 ] || die 'Versionsnummer fehlt.'; node_version="$1"; [[ "$node_version" =~ ^v24\.[0-9]+\.[0-9]+$ ]] || die 'Bitte eine Version im Format v24.x.x verwenden.' ;;
      -h|--help) usage; return 0 ;;
      *) die "Unbekannte Option: $1" ;;
    esac
    shift
  done
  check_target
  check_source
  if $check_only; then say 'Prüfung bestanden. Es wurde nichts installiert.'; return 0; fi
  umask 077
  install -d -m 0755 "$(dirname "$app_dir")" "$(dirname "$lock_file")"
  exec 9>"$lock_file"
  flock -n 9 || die 'Eine andere Installation läuft bereits.'
  work_dir="$(mktemp -d "$(dirname "$app_dir")/.familien-organisierer-install.XXXXXXXX")"
  trap cleanup EXIT
  trap 'printf "Installation bei Zeile %s fehlgeschlagen.\n" "$LINENO" >&2' ERR
  trap 'exit 130' INT
  trap 'exit 143' TERM
  say 'Benötigte Debian-Pakete installieren …'
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl xz-utils git unzip
  prepare_node
  prepare_app
  prepare_account
  save_previous
  activate
  wait_for_app
  finished=true
  say "Familien Organisierer $expected_version läuft."
  local address port
  address="$(hostname -I 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\./) {print $i;exit}}')"
  address="${address:-CONTAINER-IP}"
  port="${health_url##*:}"; port="${port%%/*}"
  say "Im Browser: http://$address:$port"
  say 'Familie und Passwort beim ersten Öffnen einrichten.'
  say "Konfiguration: $app_dir/.env"
  say "Status: systemctl status $service_name --no-pager"
  [ -z "$previous_app" ] || say "Vorheriger Quellcode: $previous_app"
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then configure; main "$@"; fi
