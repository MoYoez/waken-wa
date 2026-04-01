# 应用规则 JSON 导入导出

本文档说明后台「Web 配置」中的应用规则与媒体来源规则的 JSON 导入/导出格式与行为。

## 1. 覆盖范围

规则 JSON 仅包含以下字段：

- `appMessageRules`：应用匹配文案规则（match/text）
- `appMessageRulesShowProcessName`：命中规则时是否显示进程名
- `appFilterMode`：`blacklist` / `whitelist`
- `appBlacklist`：黑名单应用名列表
- `appWhitelist`：白名单应用名列表
- `appNameOnlyList`：仅显示应用名列表
- `mediaPlaySourceBlocklist`：媒体来源屏蔽列表（按 `metadata.play_source` 匹配；仅隐藏 `metadata.media`）

不包含：

- Base64「接入配置」里的 Token、头像、标题、课表等网页配置项
- 页面锁密码

## 2. 导出格式

点击「复制规则 JSON」会将以下结构复制到剪贴板：

```json
{
  "version": 1,
  "exportedAt": "2026-04-01T00:00:00.000Z",
  "rules": {
    "appMessageRules": [{ "match": "code.exe", "text": "正在编码：{title}" }],
    "appMessageRulesShowProcessName": true,
    "appFilterMode": "blacklist",
    "appBlacklist": ["wechat.exe"],
    "appWhitelist": [],
    "appNameOnlyList": ["chrome.exe"],
    "mediaPlaySourceBlocklist": ["system_media"]
  }
}
```

## 3. 导入行为（重要）

点击「导入规则 JSON」会将导入内容写入当前表单，但**不会自动保存**；请点击页面底部的「保存配置」。

导入时的归一化策略：

- **字符串列表**：去空、去重（不区分大小写）。
- **`mediaPlaySourceBlocklist`**：导入后会统一转换为小写。
- **`appMessageRules`**：仅保留 `match` 与 `text` 都为非空字符串的项。

## 4. 常见问题

- **导入失败：JSON 解析失败**：请确认粘贴的是完整 JSON（不是 Base64）。
- **导入后看起来没生效**：导入只写入表单，需点击「保存配置」后才会写入数据库并在主页刷新后生效。

