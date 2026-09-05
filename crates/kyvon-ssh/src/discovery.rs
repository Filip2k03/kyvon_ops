//! Learning what a host is and what it can do.
//!
//! Onboarding runs [`PROBE_SCRIPT`] once — a single channel, one round trip —
//! rather than twenty separate `command -v` calls, and parses the result into
//! [`HostFacts`]. Every check is a read; nothing is installed and nothing is
//! configured.

use kyvon_core::{caps, Capabilities, CapabilityProbe, CloudHint, Confidence, HostFacts, Result};

use crate::session::SshSession;

/// A single read-only interrogation of the host.
///
/// `/etc/os-release` is parsed rather than sourced: sourcing it would execute
/// whatever it contains, and a file on a host we are still assessing is not
/// something to execute.
pub const PROBE_SCRIPT: &str = r#"set -u
p() { printf '%s=%s\n' "$1" "$2"; }
osr() { sed -n "s/^$1=//p" /etc/os-release 2>/dev/null | tr -d '"'"'"' | head -1; }
have() { if command -v "$1" >/dev/null 2>&1; then p "cap.$1" 1; else p "cap.$1" 0; fi; }

p os.id "$(osr ID)"
p os.name "$(osr PRETTY_NAME)"
p os.version "$(osr VERSION_ID)"
p uname.m "$(uname -m 2>/dev/null)"
p uname.r "$(uname -r 2>/dev/null)"
p uname.n "$(uname -n 2>/dev/null)"
p cpu.cores "$(grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo 0)"
p mem.total_kb "$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
p uptime.secs "$(cut -d. -f1 /proc/uptime 2>/dev/null || echo 0)"

for c in apt-get dnf yum apk pacman zypper; do
  if command -v "$c" >/dev/null 2>&1; then p pkg.manager "$c"; break; fi
done

for c in systemctl journalctl docker ss ip ufw firewall-cmd nft iptables nginx httpd apache2 psql mysql mariadb redis-cli node php python3; do
  have "$c"
done

if [ -d /proc/1 ]; then p cap.proc 1; else p cap.proc 0; fi
if [ -r /sys/kernel/btf/vmlinux ]; then p cap.ebpf 1; else p cap.ebpf 0; fi
if sudo -n true >/dev/null 2>&1; then p cap.sudo_nopasswd 1; else p cap.sudo_nopasswd 0; fi

command -v docker >/dev/null 2>&1 && p ver.docker "$(docker --version 2>/dev/null | head -1)"
command -v nginx  >/dev/null 2>&1 && p ver.nginx  "$(nginx -v 2>&1 | head -1)"
command -v node   >/dev/null 2>&1 && p ver.node   "$(node --version 2>/dev/null | head -1)"
command -v php    >/dev/null 2>&1 && p ver.php    "$(php --version 2>/dev/null | head -1)"
command -v psql   >/dev/null 2>&1 && p ver.psql   "$(psql --version 2>/dev/null | head -1)"

p dmi.vendor  "$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null)"
p dmi.product "$(cat /sys/class/dmi/id/product_name 2>/dev/null)"
"#;

/// Run the probe and interpret it.
pub async fn probe(session: &SshSession) -> Result<HostFacts> {
    let out = session.exec_raw(PROBE_SCRIPT).await?;
    // A non-zero status is not fatal: `set -u` plus a missing `/proc` can trip
    // one command while the rest still reported usable facts.
    Ok(parse_probe(&out.stdout))
}

/// Interpret the probe's `key=value` output.
pub fn parse_probe(output: &str) -> HostFacts {
    let mut kv = std::collections::BTreeMap::new();
    for line in output.lines() {
        if let Some((k, v)) = line.split_once('=') {
            kv.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    let get = |k: &str| kv.get(k).cloned().unwrap_or_default();
    let num = |k: &str| kv.get(k).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
    let flag = |k: &str| kv.get(k).map(|v| v == "1").unwrap_or(false);

    let mut capabilities = Capabilities::new();
    for (key, probe_name) in CAPABILITY_MAP {
        capabilities.set(key, flag(&format!("cap.{probe_name}")));
    }
    // Apache ships as `httpd` on Red Hat family and `apache2` on Debian.
    capabilities.set(caps::APACHE, flag("cap.httpd") || flag("cap.apache2"));
    capabilities.set(caps::MYSQL, flag("cap.mysql") || flag("cap.mariadb"));
    capabilities.set(caps::PROC, flag("cap.proc"));
    capabilities.set(caps::EBPF, flag("cap.ebpf"));
    capabilities.set(caps::SUDO_NOPASSWD, flag("cap.sudo_nopasswd"));

    HostFacts {
        os_id: get("os.id"),
        os_name: get("os.name"),
        os_version: get("os.version"),
        arch: get("uname.m"),
        kernel: get("uname.r"),
        hostname: get("uname.n"),
        package_manager: normalise_package_manager(&get("pkg.manager")),
        cpu_cores: num("cpu.cores") as u32,
        memory_total_bytes: num("mem.total_kb") * 1024,
        uptime_secs: num("uptime.secs"),
        cloud: detect_cloud(&get("dmi.vendor"), &get("dmi.product")),
        capabilities,
        probed_at: kyvon_core::now_ms(),
    }
}

/// Capability key paired with the command whose presence implies it.
const CAPABILITY_MAP: &[(&str, &str)] = &[
    (caps::SYSTEMD, "systemctl"),
    (caps::JOURNALCTL, "journalctl"),
    (caps::DOCKER, "docker"),
    (caps::SS, "ss"),
    (caps::IP, "ip"),
    (caps::UFW, "ufw"),
    (caps::FIREWALLD, "firewall-cmd"),
    (caps::NFTABLES, "nft"),
    (caps::IPTABLES, "iptables"),
    (caps::NGINX, "nginx"),
    (caps::POSTGRES, "psql"),
    (caps::REDIS, "redis-cli"),
    (caps::NODE, "node"),
    (caps::PHP, "php"),
    (caps::PYTHON, "python3"),
];

fn normalise_package_manager(raw: &str) -> String {
    match raw {
        "apt-get" => "apt".into(),
        other => other.to_string(),
    }
}

/// Guess the hosting provider from DMI, with the evidence attached.
///
/// Returns `None` for a generic hypervisor string like `QEMU` or `VMware`:
/// those say the host is virtualised, not who runs it, and claiming a provider
/// on that basis would be a guess dressed as a fact (specification §72).
pub fn detect_cloud(vendor: &str, product: &str) -> Option<CloudHint> {
    let v = vendor.trim();
    let p = product.trim();
    if v.is_empty() && p.is_empty() {
        return None;
    }
    let evidence = format!("DMI sys_vendor={v:?}, product_name={p:?}");
    let hint = |provider: &str, confidence: Confidence| {
        Some(CloudHint {
            provider: provider.to_string(),
            confidence,
            evidence: evidence.clone(),
        })
    };

    let vl = v.to_ascii_lowercase();
    let pl = p.to_ascii_lowercase();

    if vl.contains("digitalocean") {
        return hint("DigitalOcean", Confidence::High);
    }
    if vl.contains("amazon") || pl.contains("amazon ec2") {
        return hint("AWS", Confidence::High);
    }
    if vl.contains("google") {
        return hint("Google Cloud", Confidence::High);
    }
    if vl.contains("hetzner") {
        return hint("Hetzner", Confidence::High);
    }
    if vl.contains("vultr") {
        return hint("Vultr", Confidence::High);
    }
    if vl.contains("oracle") {
        return hint("Oracle Cloud", Confidence::High);
    }
    if vl.contains("alibaba") {
        return hint("Alibaba Cloud", Confidence::High);
    }
    if vl.contains("microsoft") && pl.contains("virtual machine") {
        return hint("Azure", Confidence::Medium);
    }
    if vl.contains("openstack") || pl.contains("openstack") {
        // Several providers, OVH among them, expose only OpenStack.
        return hint("an OpenStack-based provider", Confidence::Low);
    }
    // QEMU, KVM, VMware, Xen, Bochs: virtualised, but that says nothing about
    // who operates the hypervisor.
    None
}

/// Render the facts as the ordered list of checks the onboarding screen shows.
pub fn to_probe_log(facts: &HostFacts) -> Vec<CapabilityProbe> {
    let mut out = vec![
        CapabilityProbe {
            key: "os".into(),
            label: if facts.os_name.is_empty() {
                "operating system could not be identified".into()
            } else {
                format!("{} detected", facts.os_name)
            },
            present: !facts.os_name.is_empty(),
            version: Some(facts.os_version.clone()),
        },
        CapabilityProbe {
            key: "arch".into(),
            label: format!("{} architecture", facts.arch),
            present: !facts.arch.is_empty(),
            version: None,
        },
        CapabilityProbe {
            key: "kernel".into(),
            label: format!("kernel {}", facts.kernel),
            present: !facts.kernel.is_empty(),
            version: Some(facts.kernel.clone()),
        },
    ];

    for (key, label) in [
        (caps::SYSTEMD, "systemd"),
        (caps::DOCKER, "Docker"),
        (caps::NGINX, "Nginx"),
        (caps::APACHE, "Apache"),
        (caps::POSTGRES, "PostgreSQL client"),
        (caps::MYSQL, "MySQL/MariaDB client"),
        (caps::REDIS, "Redis client"),
        (caps::SS, "ss (socket statistics)"),
        (caps::UFW, "ufw"),
        (caps::FIREWALLD, "firewalld"),
        (caps::NFTABLES, "nftables"),
        (caps::SUDO_NOPASSWD, "passwordless sudo"),
        (caps::EBPF, "eBPF (BTF present)"),
    ] {
        let present = facts.capabilities.has(key);
        out.push(CapabilityProbe {
            key: key.to_string(),
            label: if present {
                format!("{label} available")
            } else {
                format!("{label} not present")
            },
            present,
            version: None,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const UBUNTU_DOCKER: &str = "\
os.id=ubuntu
os.name=Ubuntu 24.04.1 LTS
os.version=24.04
uname.m=x86_64
uname.r=6.8.0-51-generic
uname.n=web-01
cpu.cores=4
mem.total_kb=8125464
uptime.secs=1468800
pkg.manager=apt-get
cap.systemctl=1
cap.journalctl=1
cap.docker=1
cap.ss=1
cap.ip=1
cap.ufw=1
cap.firewall-cmd=0
cap.nft=1
cap.iptables=1
cap.nginx=1
cap.httpd=0
cap.apache2=0
cap.psql=0
cap.mysql=0
cap.mariadb=0
cap.redis-cli=0
cap.node=1
cap.php=0
cap.python3=1
cap.proc=1
cap.ebpf=1
cap.sudo_nopasswd=0
ver.docker=Docker version 27.3.1, build ce12230
dmi.vendor=DigitalOcean
dmi.product=Droplet
";

    #[test]
    fn reads_host_identity() {
        let f = parse_probe(UBUNTU_DOCKER);
        assert_eq!(f.os_id, "ubuntu");
        assert_eq!(f.os_name, "Ubuntu 24.04.1 LTS");
        assert_eq!(f.arch, "x86_64");
        assert_eq!(f.hostname, "web-01");
        assert_eq!(f.cpu_cores, 4);
        assert_eq!(f.memory_total_bytes, 8_125_464 * 1024);
    }

    #[test]
    fn normalises_apt_get_to_apt() {
        assert_eq!(parse_probe(UBUNTU_DOCKER).package_manager, "apt");
    }

    #[test]
    fn absent_components_read_as_absent_not_unknown() {
        let f = parse_probe(UBUNTU_DOCKER);
        assert!(f.capabilities.has(caps::DOCKER));
        assert!(f.capabilities.has(caps::NGINX));
        assert!(!f.capabilities.has(caps::POSTGRES));
        assert!(!f.capabilities.has(caps::APACHE));
        assert!(!f.capabilities.has(caps::SUDO_NOPASSWD));
    }

    #[test]
    fn apache_is_found_under_either_of_its_names() {
        let redhat = "cap.httpd=1\ncap.apache2=0\n";
        assert!(parse_probe(redhat).capabilities.has(caps::APACHE));
        let debian = "cap.httpd=0\ncap.apache2=1\n";
        assert!(parse_probe(debian).capabilities.has(caps::APACHE));
    }

    #[test]
    fn mariadb_counts_as_a_mysql_client() {
        assert!(parse_probe("cap.mysql=0\ncap.mariadb=1\n")
            .capabilities
            .has(caps::MYSQL));
    }

    #[test]
    fn identifies_providers_that_name_themselves() {
        let c = detect_cloud("DigitalOcean", "Droplet").unwrap();
        assert_eq!(c.provider, "DigitalOcean");
        assert_eq!(c.confidence, Confidence::High);
        assert!(c.evidence.contains("DigitalOcean"));

        assert_eq!(
            detect_cloud("Amazon EC2", "t3.medium").unwrap().provider,
            "AWS"
        );
        assert_eq!(
            detect_cloud("Hetzner", "vServer").unwrap().provider,
            "Hetzner"
        );
    }

    #[test]
    fn a_bare_hypervisor_is_not_claimed_as_a_provider() {
        // These say "virtualised", not "who runs it".
        assert!(detect_cloud("QEMU", "Standard PC (i440FX + PIIX, 1996)").is_none());
        assert!(detect_cloud("VMware, Inc.", "VMware Virtual Platform").is_none());
        assert!(detect_cloud("Xen", "HVM domU").is_none());
        assert!(detect_cloud("", "").is_none());
    }

    #[test]
    fn openstack_is_reported_with_low_confidence() {
        let c = detect_cloud("OpenStack Foundation", "OpenStack Nova").unwrap();
        assert_eq!(c.confidence, Confidence::Low);
    }

    #[test]
    fn probe_log_names_both_present_and_absent_components() {
        let log = to_probe_log(&parse_probe(UBUNTU_DOCKER));
        let docker = log.iter().find(|p| p.key == caps::DOCKER).unwrap();
        assert!(docker.present && docker.label.contains("available"));
        let pg = log.iter().find(|p| p.key == caps::POSTGRES).unwrap();
        assert!(!pg.present && pg.label.contains("not present"));
    }

    #[test]
    fn probe_script_does_not_source_untrusted_files() {
        // Sourcing /etc/os-release would execute its contents.
        assert!(!PROBE_SCRIPT.contains(". /etc/os-release"));
        assert!(!PROBE_SCRIPT.contains("source /etc/os-release"));
    }

    #[test]
    fn a_probe_from_a_minimal_host_still_parses() {
        // Busybox with no /etc/os-release and no optional tooling.
        let minimal = "uname.m=aarch64\nuname.r=5.15.0\ncpu.cores=1\n";
        let f = parse_probe(minimal);
        assert_eq!(f.arch, "aarch64");
        assert!(f.os_name.is_empty());
        assert!(!f.capabilities.has(caps::SYSTEMD));
    }
}
