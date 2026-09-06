# V4.1 Monetization Boundary

KyvonOPS keeps the infrastructure control plane ad-free. Ads, tracking pixels,
and arbitrary third-party scripts must never load in the dashboard, terminal,
SSH, MCP, audit, or credential-management surfaces.

The repository includes a disabled-by-default sponsor placement for the public
website and the downloads view. Enable it only after a real sponsor agreement:

```sh
VITE_SPONSOR_BANNER_ENABLED=true
VITE_SPONSOR_URL=https://sponsor.example/
VITE_SPONSOR_LABEL="Community sponsor"
VITE_SPONSOR_COPY="Support infrastructure tooling."
```

The URL must be HTTPS. The component does not load remote JavaScript, frames,
cookies, or user credentials. It renders an explicit sponsored link and opens
it in a separate tab. No revenue is claimed until the sponsor or ad provider
has approved the domain and the resulting deployment has been verified.

For a network integration, obtain a publisher account and complete the
provider's policy, consent, and inventory requirements before enabling code.

## Provider options

| Provider | Cost to join | Suitable V4.1 use | Required before integration |
|---|---|---|---|
| [Adsterra](https://adsterra.com/publishers/) | Publisher signup is advertised as free with no entry traffic limit | Public website banner or native placement | Approved site, publisher ID, ad code, privacy/consent review, payout profile |
| [EthicalAds](https://www.ethicalads.io/publisher-guide/) | Application-based | Developer-focused public content | Accepted publisher account and publisher ID |
| [Carbon Ads](https://www.carbonads.net/placement-policy) | Application-based | Carefully controlled developer sponsorship | Account approval and compliance with placement/exclusivity rules |

Adsterra is the easiest free trial path for the public landing site, but free
signup does not guarantee approval, traffic, or income. Start with one clearly
labeled banner or native unit. Do not enable pop-under, forced redirects,
notification prompts, or deceptive click targets. Never place network code in
the Tauri operational shell.

## AdSense configuration

The public site has an AdSense component, disabled by default. After Google
approves the site and provides a real slot ID, configure the deployment with:

```sh
VITE_ADSENSE_ENABLED=true
VITE_ADSENSE_PUBLISHER_ID=ca-pub-5465760944511712
VITE_ADSENSE_SLOT_ID=<slot-id-from-adsense>
```

The public bundle also includes `ads.txt` for the supplied publisher identity.
It does not activate ads by itself; the component remains disabled until the
AdSense account has approved the domain and a real slot ID is configured.
The AdSense onboarding page currently previews `thuyakyaw.com`; verify that
Google has approved `kyvonops.sys.thuyakyaw.com` as the actual serving domain
before enabling this bundle.

The publisher ID is public. Account passwords, payment details, and reporting
API tokens must never be added to Vite variables or frontend code. Complete
Google's site ownership, privacy policy, consent messaging, and `ads.txt`
requirements before enabling production ads. If approval or consent is not
ready, leave `VITE_ADSENSE_ENABLED` unset.

Do not copy a publisher ID, `ads.txt` entry, or consent configuration from
another site. Google advertising products also require privacy disclosures and
region-appropriate consent handling; those requirements apply to a future
Google integration as well.

The desktop operational shell intentionally does not render this banner. A
future paid plan or sponsor acknowledgement should use the same boundary and
remain removable without changing infrastructure behavior.
