#!/usr/bin/env bash
# Auf dem Proxmox-Host aus dem vollständigen Projekt ausführen.
set -Eeuo pipefail

configure_proxmox() {
  project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  vmid=''
  ct_hostname=familien-organizer
  cores=1
  memory=1024
  swap=512
  disk=8
  rootfs_storage=''
  template_storage=''
  bridge=''
  ip4=dhcp
  gateway=''
  nameserver=''
  vlan=''
  debian=''
  dry_run=false
  work_dir=''
  work_prefix=/var/tmp/familien-organizer-proxmox.XXXXXXXX
  lock_file=/run/lock/familien-organizer-proxmox.lock
  container_archive=/root/familien-organisierer-source.tar.gz
  container_project=/root/familien-organisierer-src
  container_created=false
  installed=false
}

say() { printf '%s\n' "$*"; }
die() { printf 'Fehler: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Familien Organisierer – neuen Proxmox-LXC erstellen und installieren

  bash scripts/create-proxmox-lxc.sh
  bash scripts/create-proxmox-lxc.sh --dry-run
  bash scripts/create-proxmox-lxc.sh --vmid 120 --rootfs-storage local-lvm --bridge vmbr0

Startwerte: 1 Kern, 1024 MiB RAM, 512 MiB Swap, 8 GiB Disk, DHCP.
Eine freie ID und geeignete vorhandene Speicher werden automatisch gewählt.
Debian 12 auf Proxmox 8, Debian 13 auf Proxmox 9 oder neuer.
Debian 13 erhält nesting=1 für die systemd-Basisdienste.

Optionen:
  --vmid ID                 Freie Container-ID (100 bis 999999999)
  --hostname NAME           Standard: familien-organizer
  --cores N                 Mindestens 1
  --memory MIB              Mindestens 1024
  --swap MIB                Standard: 512, auch 0 möglich
  --disk GIB                Mindestens 8
  --rootfs-storage NAME      Speicher mit Inhaltstyp rootdir
  --template-storage NAME    Speicher mit Inhaltstyp vztmpl
  --bridge NAME              Standard: vmbr0, sonst eine eindeutige Bridge
  --ip4 DHCP-ODER-CIDR       dhcp oder z.B. 192.168.178.60/24
  --gateway IP              Bei statischer IPv4 erforderlich
  --nameserver IP           Optional: erreichbarer IPv4-DNS-Server für den LXC
  --vlan ID                 Optional: 1 bis 4094
  --debian 12|13            Debian 13 setzt hier Proxmox >=9 voraus
  --source ORDNER           Vollständiger Projektordner, falls abweichend
  --dry-run                 Nur prüfen und Einstellungen anzeigen

Dieses Skript erstellt immer einen neuen Container. Bestehende IDs werden
abgewiesen; es löscht keine Container. Konsole: pct enter CONTAINER-ID.
HELP
}

number_in_range() {
  local label="$1" value="$2" lower="$3" upper="$4"
  [[ "$value" =~ ^(0|[1-9][0-9]{0,8})$ ]] || die "$label muss eine ganze Zahl sein."
  [ "$value" -ge "$lower" ] && [ "$value" -le "$upper" ] || die "$label muss zwischen $lower und $upper liegen."
}

valid_ipv4() {
  local octets octet
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  IFS=. read -r -a octets <<< "$1"
  [ "${#octets[@]}" -eq 4 ] || return 1
  for octet in "${octets[@]}"; do
    [[ "$octet" =~ ^(0|[1-9][0-9]{0,2})$ ]] && [ "$octet" -le 255 ] || return 1
  done
}

check_host_and_parameters() {
  [ "$(id -u)" -eq 0 ] || die 'Als root in der Shell des Proxmox-Hosts ausführen.'
  local command version
  for command in pveversion pct pvesh pvesm pveam ip flock tar sha256sum; do
    command -v "$command" >/dev/null 2>&1 || die "Proxmox-Werkzeug fehlt: $command. Dieses Skript läuft auf dem Host, nicht im LXC."
  done
  [ "$(uname -m)" = x86_64 ] || die 'Dieser Host-Installer unterstützt Proxmox auf x86_64.'
  version="$(pveversion)"
  [[ "$version" =~ pve-manager/([0-9]+)\. ]] || die 'Proxmox-Version nicht erkannt.'
  pve_major="${BASH_REMATCH[1]}"
  [ "$pve_major" -ge 8 ] || die 'Der Host-Installer setzt Proxmox VE >=8 voraus.'
  if [ -z "$debian" ]; then
    if [ "$pve_major" -ge 9 ]; then debian=13; else debian=12; fi
  fi
  case "$debian" in 12) ;; 13) [ "$pve_major" -ge 9 ] || die 'Für Debian 13 mit diesem Installer Proxmox VE >=9 verwenden.' ;; *) die 'Debian muss 12 oder 13 sein.' ;; esac
  number_in_range Kerne "$cores" 1 8192
  number_in_range RAM "$memory" 1024 999999999
  number_in_range Swap "$swap" 0 999999999
  number_in_range Disk "$disk" 8 999999
  [ -z "$vmid" ] || number_in_range VM-ID "$vmid" 100 999999999
  [[ "$ct_hostname" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || die 'Hostname muss ein gültiger kurzer DNS-Name sein.'
  if [ "$ip4" = dhcp ]; then
    [ -z "$gateway" ] || die 'Bei DHCP keinen statischen Gateway angeben.'
  else
    [[ "$ip4" =~ ^([^/]+)/([0-9]{1,2})$ ]] || die 'Statische IPv4 als Adresse/Präfix angeben.'
    local address="${BASH_REMATCH[1]}" prefix="${BASH_REMATCH[2]}"
    valid_ipv4 "$address" || die 'Ungültige IPv4-Adresse.'
    number_in_range Netzpräfix "$prefix" 1 32
    valid_ipv4 "$gateway" || die 'Bei statischer IPv4 einen gültigen Gateway angeben.'
  fi
  [ -z "$vlan" ] || number_in_range VLAN "$vlan" 1 4094
  if [ -n "$nameserver" ]; then
    valid_ipv4 "$nameserver" || die 'DNS-Server muss eine gültige IPv4-Adresse sein.'
    local first_octet="${nameserver%%.*}"
    [ "$first_octet" -gt 0 ] && [ "$first_octet" -lt 224 ] && [ "$first_octet" -ne 127 ] || die 'DNS-Server muss eine erreichbare Unicast-Adresse außerhalb des Container-Loopbacks sein.'
  fi
  local entry
  for entry in package.json server.mjs src public scripts/install-lxc.sh scripts/lxc-config.mjs deploy .env.example README.md LICENSE; do
    [ -e "$project_dir/$entry" ] || die "Projektdatei fehlt: $entry. Das vollständige Repository herunterladen oder --source angeben."
  done
}

choose_storage() {
  local requested="$1" content="$2" preferred="$3" result_name="$4" status candidates choice
  status="$(pvesm status --content "$content" --enabled 1)"
  candidates="$(awk 'NR>1 && $3=="active" {print $1}' <<< "$status")"
  [ -n "$candidates" ] || die "Kein aktiver Speicher für $content verfügbar."
  if [ -n "$requested" ]; then
    [[ "$requested" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]] || die 'Ungültige Speicher-ID.'
    awk -v wanted="$requested" '$0==wanted {found=1} END {exit !found}' <<< "$candidates" || die "Speicher $requested ist nicht aktiv oder unterstützt $content nicht."
    choice="$requested"
  elif awk -v wanted="$preferred" '$0==wanted {found=1} END {exit !found}' <<< "$candidates"; then
    choice="$preferred"
  elif [ "$(wc -l <<< "$candidates")" -eq 1 ]; then
    choice="$candidates"
  else
    die "Mehrere Speicher für $content gefunden ($candidates). Bitte --${result_name//_/-} angeben."
  fi
  [[ "$choice" =~ ^[A-Za-z][A-Za-z0-9_-]*$ ]] || die 'Unerwartete Speicher-ID.'
  printf -v "$result_name" '%s' "$choice"
  if [ "$content" = rootdir ]; then
    local available_kib
    available_kib="$(awk -v wanted="$choice" '$1==wanted {print $6}' <<< "$status")"
    [[ "$available_kib" =~ ^[0-9]+$ ]] || die 'Freier Plattenplatz konnte nicht geprüft werden.'
    [ "$available_kib" -ge "$((disk * 1024 * 1024))" ] || die "Speicher $choice hat weniger als $disk GiB freien Platz."
  fi
}

choose_bridge_and_id() {
  local bridges next
  bridges="$(ip -o link show type bridge | awk '{name=$2; sub(/:$/, "", name); sub(/@.*/, "", name); print name}')"
  [ -n "$bridges" ] || die 'Keine Linux-Bridge gefunden. Netzwerk in Proxmox zuerst einrichten.'
  if [ -z "$bridge" ]; then
    if awk '$0=="vmbr0" {found=1} END {exit !found}' <<< "$bridges"; then bridge=vmbr0
    elif [ "$(wc -l <<< "$bridges")" -eq 1 ]; then bridge="$bridges"
    else die "Mehrere Bridges gefunden ($bridges). Bitte --bridge angeben."; fi
  fi
  [[ "$bridge" =~ ^[A-Za-z][A-Za-z0-9_.-]{0,14}$ ]] || die 'Ungültiger Bridge-Name.'
  awk -v wanted="$bridge" '$0==wanted {found=1} END {exit !found}' <<< "$bridges" || die "Bridge $bridge ist nicht vorhanden."
  if [ -z "$vmid" ]; then
    next="$(pvesh get /cluster/nextid --output-format json)"
    vmid="$(tr -d '"[:space:]' <<< "$next")"
    number_in_range VM-ID "$vmid" 100 999999999
  fi
  # Diese Prüfung berücksichtigt auch VMs und Container auf anderen Cluster-Knoten.
  next="$(pvesh get /cluster/nextid --vmid "$vmid" --output-format json)" || die "VM-ID $vmid ist bereits belegt oder konnte nicht sicher geprüft werden."
  [ "$(tr -d '"[:space:]' <<< "$next")" = "$vmid" ] || die 'Die gewünschte VM-ID ist nicht als frei bestätigt.'
}

show_settings() {
  say "Neuer Container: $vmid ($ct_hostname), Debian $debian, unprivilegiert."
  if [ "$debian" = 13 ]; then say 'Nesting: aktiviert für die systemd-Basisdienste von Debian 13.'; fi
  say "Ressourcen: $cores Kern(e), $memory MiB RAM, $swap MiB Swap, $disk GiB Disk."
  say "Speicher: rootfs=$rootfs_storage, Template=$template_storage."
  say "Netz: Bridge=$bridge, IPv4=$ip4${gateway:+, Gateway=$gateway}${vlan:+, VLAN=$vlan}."
  if [ -n "$nameserver" ]; then say "DNS: $nameserver."; else say 'DNS: Proxmox übernimmt die Host-Einstellung; im LXC muss der Server erreichbar sein.'; fi
}

select_template() {
  local available
  say 'Offiziellen Proxmox-Template-Katalog aktualisieren …'
  pveam update
  available="$(pveam available --section system)"
  template_file="$(awk -v release="$debian" '$2 ~ ("^debian-" release "-standard_[A-Za-z0-9.+_-]+_amd64\\.tar\\.(zst|xz|gz)$") {print $2}' <<< "$available" | sort -V | tail -n 1)"
  [ -n "$template_file" ] || die "Kein offizielles Debian-$debian-Template im Katalog gefunden."
  template_volume="$template_storage:vztmpl/$template_file"
  local cached
  cached="$(pveam list "$template_storage")"
  if ! awk -v wanted="$template_volume" '$1==wanted {found=1} END {exit !found}' <<< "$cached"; then
    say "Template laden: $template_file"
    pveam download "$template_storage" "$template_file"
  fi
}

prepare_source() {
  work_dir="$(mktemp -d "$work_prefix")"
  mkdir "$work_dir/project"
  local entry
  # Authentifizierter Checkout bleibt nur auf dem Host. Kein .git/.env/data im Paket.
  for entry in package.json server.mjs src public scripts deploy docs tests .env.example .gitignore .dockerignore Dockerfile compose.yaml README.md PROJECT_STATE.md LICENSE .github; do
    if [ -e "$project_dir/$entry" ]; then cp -a "$project_dir/$entry" "$work_dir/project/"; fi
  done
  tar -czf "$work_dir/source.tar.gz" -C "$work_dir/project" .
  source_checksum="$(sha256sum "$work_dir/source.tar.gz" | awk '{print $1}')"
}

run_pct() (
  # pct/tar vererbt die umask auch beim Anlegen von /etc im Template.
  # Nur dieser Kindprozess bekommt System-Standardrechte; private Host-Dateien
  # und die Installer-Sperre behalten im übergeordneten Prozess umask 077.
  umask 022
  pct "$@" 9>&-
)

create_and_install() {
  local net="name=eth0,bridge=$bridge,ip=$ip4,firewall=1"
  local -a dns_options=() feature_options=()
  [ -z "$nameserver" ] || dns_options=(--nameserver "$nameserver")
  # Debian 13/systemd benötigt diese Freigabe auch ohne Docker im Container.
  [ "$debian" != 13 ] || feature_options=(--features nesting=1)
  [ -z "$gateway" ] || net+=",gw=$gateway"
  [ -z "$vlan" ] || net+=",tag=$vlan"
  # pct create hat zusätzlich seine eigenen Cluster-/VMID-Sperren.
  say "LXC $vmid erstellen …"
  run_pct create "$vmid" "$template_volume" --ostype debian --arch amd64 \
    --hostname "$ct_hostname" --unprivileged 1 --cores "$cores" --memory "$memory" \
    --swap "$swap" --rootfs "$rootfs_storage:$disk" --net0 "$net" "${dns_options[@]}" "${feature_options[@]}" --onboot 0 --cmode shell \
    --description 'Familien Organisierer – eigener Familienkalender; http://CONTAINER-IP:8080'
  container_created=true
  run_pct start "$vmid"
  say 'Auf systemd und Netzwerk im neuen Container warten …'
  local ready=false attempt
  for attempt in {1..60}; do
    if run_pct exec "$vmid" -- test -d /run/systemd/system && \
       run_pct exec "$vmid" -- getent ahostsv4 deb.debian.org >/dev/null; then ready=true; break; fi
    sleep 2
  done
  $ready || die "Container $vmid ist nicht bereit. DHCP/DNS und Bridge prüfen. Diagnose: pct exec $vmid -- ip -4 route; pct exec $vmid -- cat /etc/resolv.conf"
  run_pct push "$vmid" "$work_dir/source.tar.gz" "$container_archive" --perms 0600
  say 'Quellcode prüfen und Anwendung im Container installieren …'
  run_pct exec "$vmid" -- bash -c '
set -euo pipefail
archive=$1
checksum=$2
project=$3
printf "%s  %s\n" "$checksum" "$archive" | sha256sum --check --status -
install -d -m 0700 "$project"
tar -xzf "$archive" -C "$project" --no-same-owner
bash "$project/scripts/install-lxc.sh"
rm -- "$archive"
' family-deploy "$container_archive" "$source_checksum" "$container_project"
  # Erst der fertig installierte und geprüfte Container startet mit dem Host.
  run_pct set "$vmid" --onboot 1
  installed=true
  local address
  address="$(run_pct exec "$vmid" -- hostname -I | awk '{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\./) {print $i;exit}}')"
  say "Fertig: Container $vmid, Autostart aktiviert."
  if [ -n "$address" ]; then say "Im Browser: http://$address:8080"; else say "IP ermitteln: pct exec $vmid -- hostname -I"; fi
  say "Konsole: pct enter $vmid"
  say 'Beim ersten Öffnen Familie und Familienpasswort einrichten.'
}

cleanup_proxmox() {
  local status=$?
  trap - EXIT ERR INT TERM
  set +e
  if [ "$status" -ne 0 ] && $container_created && ! $installed; then
    say "Installation unvollständig. Container $vmid bleibt zur Diagnose erhalten, Autostart ist noch deaktiviert." >&2
    say "Konsole: pct enter $vmid" >&2
    if run_pct exec "$vmid" -- test -f "$container_project/scripts/install-lxc.sh" >/dev/null 2>&1; then
      say "Nach Behebung im selben LXC fortsetzen: pct exec $vmid -- bash $container_project/scripts/install-lxc.sh" >&2
      say "Nach erfolgreicher Installation Autostart aktivieren: pct set $vmid --onboot 1" >&2
    else
      say 'Quellcode wurde noch nicht vollständig bereitgestellt. Übertragung und Fortsetzung im bestehenden LXC: docs/PROXMOX.md.' >&2
    fi
  fi
  if [ -n "$work_dir" ] && [ -d "$work_dir" ]; then rm -rf -- "$work_dir"; fi
  exit "$status"
}

main_proxmox() {
  export LC_ALL=C
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run) dry_run=true ;;
      -h|--help) usage; return 0 ;;
      --vmid|--hostname|--cores|--memory|--swap|--disk|--rootfs-storage|--template-storage|--bridge|--ip4|--gateway|--nameserver|--vlan|--debian|--source)
        local option="$1"; shift; [ "$#" -gt 0 ] || die "Wert für $option fehlt."
        case "$option" in
          --vmid) vmid="$1" ;; --hostname) ct_hostname="$1" ;; --cores) cores="$1" ;; --memory) memory="$1" ;;
          --swap) swap="$1" ;; --disk) disk="$1" ;; --rootfs-storage) rootfs_storage="$1" ;;
          --template-storage) template_storage="$1" ;; --bridge) bridge="$1" ;; --ip4) ip4="$1" ;;
          --gateway) gateway="$1" ;; --vlan) vlan="$1" ;; --debian) debian="$1" ;; --source) project_dir="$1" ;;
          --nameserver) nameserver="$1" ;;
        esac ;;
      *) die "Unbekannte Option: $1" ;;
    esac
    shift
  done
  check_host_and_parameters
  if ! $dry_run; then
    umask 077
    exec 9>"$lock_file"
    flock -n 9 || die 'Ein anderer Familien-Organizer-Installer läuft bereits auf diesem Host.'
    trap cleanup_proxmox EXIT
    trap 'printf "Host-Installer bei Zeile %s fehlgeschlagen.\n" "$LINENO" >&2' ERR
    trap 'exit 130' INT
    trap 'exit 143' TERM
  fi
  choose_storage "$rootfs_storage" rootdir local-lvm rootfs_storage
  choose_storage "$template_storage" vztmpl local template_storage
  choose_bridge_and_id
  show_settings
  if $dry_run; then say 'Vorprüfung bestanden. Es wurde kein Template geladen und kein Container angelegt.'; return 0; fi
  prepare_source
  select_template
  create_and_install
}

if [[ "${BASH_SOURCE[0]}" = "$0" ]]; then configure_proxmox; main_proxmox "$@"; fi
