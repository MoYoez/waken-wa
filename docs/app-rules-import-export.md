# App Rules JSON Import and Export

This document describes the JSON import/export format and behavior for app rules and media source rules in the admin **Web Settings** page.

## 1. Scope

The rules JSON contains only the following fields:

- `appMessageRules`: grouped app message rules using `processMatch`, optional `defaultText`, and `titleRules`
- `appMessageRulesShowProcessName`: whether to show the process name when a rule matches
- `appFilterMode`: `blacklist` / `whitelist`
- `appBlacklist`: list of blocked app names
- `appWhitelist`: list of allowed app names
- `appNameOnlyList`: list of apps that should only show the app name
- `mediaPlaySourceBlocklist`: blocked media source list, matched against `metadata.play_source`; only hides `metadata.media`

It does not include:

- Tokens, avatar, title, timetable, or other web configuration fields from the Base64 integration config
- Page lock password

## 2. Export Format

Clicking **Copy Rules JSON** copies the following structure to the clipboard:

```json
{
  "version": 2,
  "exportedAt": "2026-04-01T00:00:00.000Z",
  "rules": {
    "appMessageRules": [
      {
        "processMatch": "code.exe",
        "defaultText": "Coding",
        "titleRules": [
          { "mode": "plain", "pattern": ".tsx", "text": "Writing frontend: {title}" },
          { "mode": "regex", "pattern": "\\\\.md$", "text": "Writing docs: {title}" }
        ]
      }
    ],
    "appMessageRulesShowProcessName": true,
    "appFilterMode": "blacklist",
    "appBlacklist": ["wechat.exe"],
    "appWhitelist": [],
    "appNameOnlyList": ["chrome.exe"],
    "mediaPlaySourceBlocklist": ["system_media"]
  }
}
```

## 3. Import Behavior

Clicking **Import Rules JSON** writes the imported content into the current form, but **does not save it automatically**. Click **Save Settings** at the bottom of the page to persist the changes.

Normalization rules during import:

- **String lists**: remove empty values and duplicates, case-insensitively.
- **`mediaPlaySourceBlocklist`**: values are converted to lowercase after import.
- **`appMessageRules`**:
  - `version: 1` legacy `{ match, text }` entries are converted into grouped rules with `processMatch`, `defaultText`, and empty `titleRules`
  - `version: 2` grouped rules keep only non-empty `processMatch` values and non-empty title subrules

## 4. FAQ

- **Import failed: JSON parse error**: make sure the pasted content is complete JSON, not Base64.
- **Imported rules do not seem to work**: import only writes to the form. Click **Save Settings** to write the values to the database, then refresh the home page.
