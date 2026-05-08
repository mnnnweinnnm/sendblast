# SendBlast — Email Marketing Platform

自架的 Email 行銷平台，支援 USDT 額度購買、多客戶、多域名。

## 快速開始

### 1. 複製環境變數
```bash
cp backend/.env.example backend/.env
# 編輯 backend/.env，填入真實值
```

### 2. 啟動服務
```bash
docker compose up -d
```

### 3. 初始化資料庫
```bash
docker compose exec backend npm run db:migrate
```

### 4. 建立 Admin 帳號
```bash
docker compose exec backend node src/scripts/createAdmin.js
```

## 架構

- **Backend**: Node.js + Express
- **Database**: PostgreSQL 16
- **Queue**: BullMQ + Redis
- **Email API**: Resend
- **Frontend**: React (待實作)

## 環境變數

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `REDIS_URL` | Redis 連線字串 |
| `RESEND_API_KEY` | Resend API Key |
| `RESEND_WEBHOOK_SECRET` | Resend Webhook 驗證密鑰 |
| `JWT_SECRET` | JWT 簽名密鑰 |
| `PLATFORM_USDT_ADDRESS` | 收 USDT 的 TRC-20 地址 |
| `TRONGRID_API_KEY` | TronGrid API（用於監控 USDT 到帳）|

## 部署流程

```
本地改 → git commit → git push
       ↓
VPS pull → docker compose build && up -d
```

詳見 `DEPLOYMENT.md`
