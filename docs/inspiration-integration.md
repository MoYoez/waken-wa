# 灵感随想录接口说明

本文档补充说明灵感随想录相关的对外接口，用于设备端、脚本端或其他自动化客户端接入。

统一 API 参考入口：

- Scalar API Reference：`/api-reference`
- OpenAPI JSON：`/api/openapi.json`

## 1. 接口范围

当前包含以下接口：

- `GET /api/inspiration/entries`：公开读取灵感列表
- `POST /api/inspiration/entries`：写入灵感条目
- `DELETE /api/inspiration/entries?id=...`：删除灵感条目（仅管理员）
- `POST /api/inspiration/assets`：上传内联图片资源
- `GET /api/inspiration/img/{publicKey}`：公开读取图片

## 2. 鉴权说明

- 公开读取：
  - `GET /api/inspiration/entries`
  - `GET /api/inspiration/img/{publicKey}`
- 写入接口：
  - 支持管理员 `session` Cookie
  - 或 `Authorization: Bearer <API_TOKEN>`

注意：

- `GET /api/inspiration/entries` 仍受整站访问锁影响；若站点已锁定，需要先完成页面解锁。
- Bearer Token 写入路径可能额外受到后台「灵感允许设备 Hash」规则限制。
- `attachCurrentStatus` 可用于管理员 `session` 和 Bearer Token 写入。
- Bearer Token 路径下，附带当前状态时必须提供当前设备身份牌（`X-Device-Key` 或 `generatedHashKey`），且只能附带当前设备自己的状态。

## 3. 常见接入流程

### 直接发文本条目

向 `POST /api/inspiration/entries` 发送：

```json
{
  "title": "Today",
  "content": "A short note from device side."
}
```

### 先上传图片，再写入条目

1. 调用 `POST /api/inspiration/assets`
2. 获取返回的 `publicKey` 与 `url`
3. 在客户端内容中引用该图片 URL，或直接保留资源地址备用

### 直接内联图片

也可以在 `POST /api/inspiration/entries` 中直接传 `imageDataUrl`，但更适合较小图片。

## 4. 建议

- 结构化字段、状态码和示例以 `/api-reference` 为准
- 若你在做设备端集成，建议同时阅读 [activity-reporting.md](./activity-reporting.md)
