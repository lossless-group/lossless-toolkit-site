---
title: "Content Anomalies"
lede: "Everything a hard validator would have rejected, recorded instead of thrown. 147 findings across 172 tools."
date_generated: 2026-08-23
generated_by: "lossless-toolkit-site build"
publish: false
---

# Content Anomalies

The build is deliberately lenient: a nonconforming file drops the bad key and keeps the document. This report is the other half of that bargain — what would have failed, and what was assumed instead.

| Anomaly | Count |
|---|---:|
| Derived slug | 110 |
| No tags | 12 |
| Unusable og_image | 11 |
| No vendor URL | 5 |
| Missing title (fell back to filename) | 5 |
| No description of any kind | 4 |
| **Total** | **147** |

## Derived slug — 110

- `tooling/AI Agent Store.md` — `slug` absent; used /tools/ai-agent-store/
- `tooling/AI-Toolkit/AI Interfaces/AI Workspaces/Vertical Wrappers/Catio.md` — `slug` absent; used /tools/catio/
- `tooling/AI-Toolkit/Agentic AI/Agentic Workspaces/n8n.md` — `slug` absent; used /tools/n8n/
- `tooling/AI-Toolkit/Agentic AI/AutoGen.md` — `slug` absent; used /tools/autogen/
- `tooling/AI-Toolkit/Generative AI/Code Generators/Augment Code.md` — `slug` absent; used /tools/augment-code/
- `tooling/AI-Toolkit/Generative AI/Code Generators/Cursor.md` — `slug` absent; used /tools/cursor/
- `tooling/AI-Toolkit/Generative AI/Recraft.md` — `slug` absent; used /tools/recraft/
- `tooling/AI-Toolkit/Models/Claude.md` — `slug` absent; used /tools/claude/
- `tooling/Apprentice.io.md` — `slug` absent; used /tools/apprenticeio/
- `tooling/Creative/Affinity Design Suite.md` — `slug` absent; used /tools/affinity-design-suite/
- `tooling/Creative/Designrr.md` — `slug` absent; used /tools/designrr/
- `tooling/Creative/Linearity.md` — `slug` absent; used /tools/linearity/
- `tooling/Data Utilities/Apache Beam.md` — `slug` absent; used /tools/apache-beam/
- `tooling/Data Utilities/Bruin.md` — `slug` absent; used /tools/bruin/
- `tooling/Data Utilities/Fivetran.md` — `slug` absent; used /tools/fivetran/
- `tooling/Data Utilities/Hevo Data.md` — `slug` absent; used /tools/hevo-data/
- `tooling/Data Utilities/Linkurious.md` — `slug` absent; used /tools/linkurious/
- `tooling/Data Utilities/ObservableHQ.md` — `slug` absent; used /tools/observablehq/
- `tooling/Data Utilities/Posit.md` — `slug` absent; used /tools/posit/
- `tooling/Empty Tool Test.md` — `slug` absent; used /tools/empty-tool-test/
- `tooling/Enterprise Jobs-to-be-Done/Adyen.md` — `slug` absent; used /tools/adyen/
- `tooling/Enterprise Jobs-to-be-Done/Content Management Systems/FrontmatterCMS.md` — `slug` absent; used /tools/frontmattercms/
- `tooling/Enterprise Jobs-to-be-Done/Integration Platforms/Boomi.md` — `slug` absent; used /tools/boomi/
- `tooling/Enterprise Jobs-to-be-Done/Medallia.md` — `slug` absent; used /tools/medallia/
- `tooling/Enterprise Jobs-to-be-Done/Plotly.md` — `slug` absent; used /tools/plotly/
- `tooling/Enterprise Jobs-to-be-Done/Plunk.md` — `slug` absent; used /tools/plunk/
- `tooling/Enterprise Jobs-to-be-Done/Ravel.md` — `slug` absent; used /tools/ravel/
- `tooling/Enterprise Jobs-to-be-Done/Warmy.md` — `slug` absent; used /tools/warmy/
- `tooling/Hardware/Aqara Camera G5 Hub.md` — `slug` absent; used /tools/aqara-camera-g5-hub/
- `tooling/Hardware/Arc Series.md` — `slug` absent; used /tools/arc-series/
- `tooling/Hardware/Aria.md` — `slug` absent; used /tools/aria/
- `tooling/Hardware/Armsom.md` — `slug` absent; used /tools/armsom/
- `tooling/Hardware/Bambu Lab.md` — `slug` absent; used /tools/bambu-lab/
- `tooling/Hardware/DGX Systems.md` — `slug` absent; used /tools/dgx-systems/
- `tooling/Hardware/Even Realities.md` — `slug` absent; used /tools/even-realities/
- `tooling/Hardware/Framework Desktop.md` — `slug` absent; used /tools/framework-desktop/
- `tooling/Hardware/MacBook Air.md` — `slug` absent; used /tools/macbook-air/
- `tooling/Hardware/RTX Series.md` — `slug` absent; used /tools/rtx-series/
- `tooling/Hardware/Radaxa.md` — `slug` absent; used /tools/radaxa/
- `tooling/Hardware/Synology.md` — `slug` absent; used /tools/synology/
- `tooling/Hardware/ZimaCube.md` — `slug` absent; used /tools/zimacube/
- `tooling/Hyperagent.md` — `slug` absent; used /tools/hyperagent/
- `tooling/Ionos.md` — `slug` absent; used /tools/ionos/
- `tooling/Portfolio/Allocate.md` — `slug` absent; used /tools/allocate/
- `tooling/Portfolio/Avalanche VC.md` — `slug` absent; used /tools/avalanche-vc/
- `tooling/Portfolio/Carbon.md` — `slug` absent; used /tools/carbon/
- `tooling/Portfolio/Chime.md` — `slug` absent; used /tools/chime/
- `tooling/Portfolio/Learn Capital.md` — `slug` absent; used /tools/learn-capital/
- `tooling/Portfolio/Neol.md` — `slug` absent; used /tools/neol/
- `tooling/Portfolio/PhotoMath.md` — `slug` absent; used /tools/photomath/
- `tooling/Portfolio/Sana Labs.md` — `slug` absent; used /tools/sana-labs/
- `tooling/Portfolio/Seabound.md` — `slug` absent; used /tools/seabound/
- `tooling/Portfolio/Vana.md` — `slug` absent; used /tools/vana/
- `tooling/Precedence Test.md` — `slug` absent; used /tools/precedence-test/
- `tooling/Productivity/Advanced Documents/CraftDocs.md` — `slug` absent; used /tools/craftdocs/
- `tooling/Productivity/Advanced Documents/Obsidian.md` — `slug` absent; used /tools/obsidian/
- `tooling/Productivity/Advanced Spreadsheets/Bricks.md` — `slug` absent; used /tools/bricks/
- `tooling/Productivity/Advanced Spreadsheets/Parabola.md` — `slug` absent; used /tools/parabola/
- `tooling/Productivity/Async Communication/Slack.md` — `slug` absent; used /tools/slack/
- `tooling/Productivity/Personal Cloud/CasaOS.md` — `slug` absent; used /tools/casaos/
- `tooling/Productivity/Personal Cloud/UTM.md` — `slug` absent; used /tools/utm/
- `tooling/Products/AI Studios.md` — `slug` absent; used /tools/ai-studios/
- `tooling/Products/Cobalt.md` — `slug` absent; used /tools/cobalt/
- `tooling/Products/Discord.md` — `slug` absent; used /tools/discord/
- `tooling/Products/Educative.md` — `slug` absent; used /tools/educative/
- `tooling/Products/Fastly.md` — `slug` absent; used /tools/fastly/
- `tooling/Products/Git.md` — `slug` absent; used /tools/git/
- `tooling/Products/Graphene OS.md` — `slug` absent; used /tools/graphene-os/
- `tooling/Products/Husky.md` — `slug` absent; used /tools/husky/
- `tooling/Products/Luma.md` — `slug` absent; used /tools/luma/
- `tooling/Products/Salesforce.md` — `slug` absent; used /tools/salesforce/
- `tooling/Products/Treety.md` — `slug` absent; used /tools/treety/
- `tooling/Regent Craft.md` — `slug` absent; used /tools/regent-craft/
- `tooling/Scouting/Harmonic AI.md` — `slug` absent; used /tools/harmonic-ai/
- `tooling/Software Development/Developer Experience/DevOps/Ansible.md` — `slug` absent; used /tools/ansible/
- `tooling/Software Development/Developer Experience/DevTools/Bazel.md` — `slug` absent; used /tools/bazel/
- `tooling/Software Development/Developer Experience/JetBrains.md` — `slug` absent; used /tools/jetbrains/
- `tooling/Software Development/Developer Experience/Neovim.md` — `slug` absent; used /tools/neovim/
- `tooling/Software Development/Lego-Kit Engineering Tools/Backend-as-a-Service/Xano.md` — `slug` absent; used /tools/xano/
- `tooling/Software Development/Lego-Kit Engineering Tools/Mailgun.md` — `slug` absent; used /tools/mailgun/
- `tooling/Training/Coursera.md` — `slug` absent; used /tools/coursera/
- `tooling/Training/Degreed.md` — `slug` absent; used /tools/degreed/
- `tooling/Training/Frontend Masters.md` — `slug` absent; used /tools/frontend-masters/
- `tooling/Training/Indently.md` — `slug` absent; used /tools/indently/
- `tooling/Training/JS Mastery.md` — `slug` absent; used /tools/js-mastery/
- `tooling/Training/Manning Press.md` — `slug` absent; used /tools/manning-press/
- `tooling/Training/Parta IO.md` — `slug` absent; used /tools/parta-io/
- `tooling/Training/Patterns.dev.md` — `slug` absent; used /tools/patternsdev/
- `tooling/Training/Pluralsight.md` — `slug` absent; used /tools/pluralsight/
- `tooling/Training/Pursuit.md` — `slug` absent; used /tools/pursuit/
- `tooling/Training/SkillShare.md` — `slug` absent; used /tools/skillshare/
- `tooling/Training/Teamlift.md` — `slug` absent; used /tools/teamlift/
- `tooling/Web Browsers/Arc Browser.md` — `slug` absent; used /tools/arc-browser/
- `tooling/Web Browsers/Brave Browser.md` — `slug` absent; used /tools/brave-browser/
- `tooling/Web Browsers/Chrome.md` — `slug` absent; used /tools/chrome/
- `tooling/Web Browsers/Clonbrowser.md` — `slug` absent; used /tools/clonbrowser/
- `tooling/Web Browsers/Dia.md` — `slug` absent; used /tools/dia/
- `tooling/Web Browsers/Edge Browser.md` — `slug` absent; used /tools/edge-browser/
- `tooling/Web Browsers/Firefox.md` — `slug` absent; used /tools/firefox/
- `tooling/Web Browsers/Floorp.md` — `slug` absent; used /tools/floorp/
- `tooling/Web Browsers/Glarity.md` — `slug` absent; used /tools/glarity/
- `tooling/Web Browsers/Ladybird.md` — `slug` absent; used /tools/ladybird/
- `tooling/Web Browsers/Opera.md` — `slug` absent; used /tools/opera/
- `tooling/Web Browsers/Vivaldi.md` — `slug` absent; used /tools/vivaldi/
- `vertical-toolkits/CleanTech/Amogy.md` — `slug` absent; used /tools/amogy/
- `vertical-toolkits/CleanTech/Terrafirma.md` — `slug` absent; used /tools/terrafirma/
- `vertical-toolkits/Growth-Equity-Firms/TSG Consumer.md` — `slug` absent; used /tools/tsg-consumer/
- `vertical-toolkits/Impulse Space.md` — `slug` absent; used /tools/impulse-space/
- `vertical-toolkits/Sava HQ.md` — `slug` absent; used /tools/sava-hq/
- `vertical-toolkits/Venture-Capital-Firms/Greycroft.md` — `slug` absent; used /tools/greycroft/

## No tags — 12

- `tooling/AI Agent Store.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/BabyAGI.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Empty Tool Test.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Hardware/Radaxa.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Ionos.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Mercury Bank.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Portfolio/Carbon.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Portfolio/Chime.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Portfolio/Learn Capital.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Portfolio/Sana Labs.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Portfolio/Vana.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter
- `tooling/Products/Whoop.md` — `tags` absent or empty; used entry is reachable by search and category, but never by a tag filter

## Unusable og_image — 11

- `tooling/AI-Toolkit/Agentic AI/AutoGen.md` — `og_image` absent; used the generated house share card
- `tooling/BabyAGI.md` — `og_image` []; used the generated house share card
- `tooling/Empty Tool Test.md` — `og_image` absent; used the generated house share card
- `tooling/Enterprise Jobs-to-be-Done/JuiceFS.md` — `og_image` []; used the generated house share card
- `tooling/Portfolio/Carbon.md` — `og_image` absent; used the generated house share card
- `tooling/Precedence Test.md` — `og_image` []; used the generated house share card
- `tooling/Products/Educative.md` — `og_image` ["https://www.educative.io/static/imgs/logos/LinkImageV3.png"]; used the generated house share card
- `tooling/Regent Craft.md` — `og_image` absent; used the generated house share card
- `tooling/Web Browsers/Dia.md` — `og_image` absent; used the generated house share card
- `vertical-toolkits/Growth-Equity-Firms/TSG Consumer.md` — `og_image` absent; used the generated house share card
- `vertical-toolkits/Venture-Capital-Firms/Bloomberg Beta.md` — `og_image` absent; used the generated house share card

## No vendor URL — 5

- `tooling/AI-Toolkit/Agentic AI/AutoGen.md` — `url` absent; used the entry renders without an outbound link
- `tooling/Empty Tool Test.md` — `url` absent; used the entry renders without an outbound link
- `tooling/Portfolio/Carbon.md` — `url` absent; used the entry renders without an outbound link
- `tooling/Precedence Test.md` — `url` absent; used the entry renders without an outbound link
- `vertical-toolkits/Venture-Capital-Firms/Bloomberg Beta.md` — `url` absent; used the entry renders without an outbound link

## Missing title (fell back to filename) — 5

- `tooling/Empty Tool Test.md` — `title` no `title`, `og_title`, `site_name`, or `og_site_name`; used "Empty Tool Test"
- `tooling/Portfolio/Carbon.md` — `title` no `title`, `og_title`, `site_name`, or `og_site_name`; used "Carbon"
- `tooling/Regent Craft.md` — `title` no `title`, `og_title`, `site_name`, or `og_site_name`; used "Regent Craft"
- `tooling/Web Browsers/Dia.md` — `title` no `title`, `og_title`, `site_name`, or `og_site_name`; used "Dia"
- `vertical-toolkits/Growth-Equity-Firms/TSG Consumer.md` — `title` no `title`, `og_title`, `site_name`, or `og_site_name`; used "TSG Consumer"

## No description of any kind — 4

- `tooling/Empty Tool Test.md` — `zinger / og_description / description` absent, and the body yielded no usable first paragraph; used an empty summary — the share card will carry the page title only
- `tooling/Portfolio/Carbon.md` — `zinger / og_description / description` absent, and the body yielded no usable first paragraph; used an empty summary — the share card will carry the page title only
- `tooling/Web Browsers/Dia.md` — `zinger / og_description / description` absent, and the body yielded no usable first paragraph; used an empty summary — the share card will carry the page title only
- `vertical-toolkits/Growth-Equity-Firms/TSG Consumer.md` — `zinger / og_description / description` absent, and the body yielded no usable first paragraph; used an empty summary — the share card will carry the page title only
