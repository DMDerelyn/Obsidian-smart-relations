# Smart Relations — Release & Beta Testing Guide

## Beta Testing (No Submission Required)

You can test the plugin immediately in your own vault without publishing anything.

### Option A: Install from Your GitHub Repo

1. Open your vault's plugin folder in a file manager or terminal:
   ```
   /path/to/your/vault/.obsidian/plugins/
   ```
2. Create a new folder called `smart-relations`
3. Download these three files from the `main` branch of your GitHub repo (`DMDerelyn/Obsidian-smart-relations`):
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Place all three files inside the `smart-relations` folder
5. Open Obsidian, go to **Settings > Community plugins**
6. If prompted, disable **Restricted mode**
7. You should see **Smart Relations** in the plugin list — toggle it on
8. The plugin will build its indexes automatically on first load

### Option B: Use BRAT (Beta Reviewer's Auto-update Tester)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) is an Obsidian plugin that lets you install and auto-update plugins directly from GitHub repos — no community plugin submission needed.

1. Install **BRAT** from the Community plugins browser (search "BRAT")
2. Open BRAT settings
3. Click **Add Beta Plugin**
4. Enter: `DMDerelyn/Obsidian-smart-relations`
5. Click **Add Plugin**
6. BRAT will download the latest release and keep it updated

> [!tip] BRAT requires a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached. See the "Creating a GitHub Release" section below.

### Option C: Build from Source (Developer Testing)

1. Clone the repo into your vault's plugins folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins
   git clone https://github.com/DMDerelyn/Obsidian-smart-relations.git smart-relations
   cd smart-relations
   npm install
   npm run build
   ```
2. Enable the plugin in Obsidian settings
3. For live-reloading during development: `npm run dev`

---

## Creating a GitHub Release

A GitHub Release is needed for BRAT support and for future community plugin submission. The built `main.js` is already committed to the `main` branch.

### Steps

1. Go to: [github.com/DMDerelyn/Obsidian-smart-relations/releases/new](https://github.com/DMDerelyn/Obsidian-smart-relations/releases/new)

2. **Choose a tag**: Type `0.1.0` in the tag field and click **"Create new tag: 0.1.0 on publish"**

3. **Target**: Select the `main` branch

4. **Release title**: `Smart Relations v0.1.0`

5. **Description** (paste this):

```
Initial release of Smart Relations — a local RAG indexing plugin for Obsidian.

## Features
- Builds 6 local indexes (BM25, tag co-occurrence, n-gram, relation graph, document stats, UUID index)
- Related notes panel with ranked results and score breakdown
- Suggest relations command to add cross-references via frontmatter
- Incremental indexing — only re-indexes changed files
- Configurable scoring weights (BM25, Jaccard, term overlap, graph proximity)
- Zero external API calls — fully offline
- Claude Code integration via CLAUDE.md and optional CLI query tool

## Install
Download the three files below and place them in:
`.obsidian/plugins/smart-relations/`

Or install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) using repo: `DMDerelyn/Obsidian-smart-relations`
```

6. **Attach files**: You need to upload three files as release assets. Download them from the `main` branch of your repo and drag them into the "Attach binaries" area:
   - `main.js` (the compiled plugin bundle)
   - `manifest.json` (plugin metadata)
   - `styles.css` (plugin styles)

7. Ensure **"Set as the latest release"** is checked

8. Click **"Publish release"**

---

## Submitting to Community Plugins (When Ready)

> [!note] Only do this when you're confident the plugin is stable and ready for public use. The Obsidian team reviews submissions manually.

### Prerequisites

- [ ] GitHub Release exists with `main.js`, `manifest.json`, and `styles.css`
- [ ] `manifest.json` has all required fields (`id`, `name`, `version`, `minAppVersion`, `description`, `author`)
- [ ] `versions.json` exists in the repo root
- [ ] `LICENSE` file exists in the repo root
- [ ] `README.md` describes what the plugin does and how to use it
- [ ] Plugin has been tested in your own vault

> [!tip] All of these prerequisites are already complete in your repo.

### Steps

1. Fork [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases)

2. Edit `community-plugins.json` in your fork — add this entry at the end of the array (maintain alphabetical order by `id`):
   ```json
   {
     "id": "smart-relations",
     "name": "Smart Relations",
     "author": "Smart Relations",
     "description": "Build local vectorization indexes for RAG-style retrieval and relation discovery",
     "repo": "DMDerelyn/Obsidian-smart-relations"
   }
   ```

3. Create a Pull Request from your fork to `obsidianmd/obsidian-releases`

4. Wait for the Obsidian team to review (typically 1-2 weeks)

5. Once merged, the plugin will appear in **Settings > Community plugins > Browse** for all Obsidian users

### Review Checklist (What Obsidian Looks For)

The Obsidian team checks:
- [ ] Plugin doesn't make network requests without user consent
- [ ] Plugin doesn't access files outside the vault without user consent
- [ ] `manifest.json` fields are accurate
- [ ] Plugin has a clear description and README
- [ ] License file is present
- [ ] No obfuscated code in `main.js`
- [ ] Plugin follows Obsidian's plugin guidelines

Smart Relations passes all of these — it's fully offline with zero external API calls.

---

## Updating the Plugin (Future Releases)

When you're ready to release a new version:

1. Update the `version` field in both `manifest.json` and `package.json`
2. Add the new version mapping to `versions.json`:
   ```json
   {
     "0.1.0": "1.4.0",
     "0.2.0": "1.4.0"
   }
   ```
3. Rebuild: `npm run build`
4. Commit the updated `manifest.json`, `versions.json`, and `main.js` to `main`
5. Create a new GitHub Release with tag matching the version (e.g., `0.2.0`)
6. Attach the updated `main.js`, `manifest.json`, and `styles.css`

Obsidian automatically checks for updates and notifies users if they installed via the community browser or BRAT.
