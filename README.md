<div align="center">

# ⚡ Syntiox Ideas

### A premium feedback & ideas portal for the Syntiox team

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=for-the-badge)
![Vercel](https://img.shields.io/badge/hosted_on-Vercel-black?style=for-the-badge&logo=vercel)
![Security](https://img.shields.io/badge/encryption-AES--256--GCM-10b981?style=for-the-badge)
![License](https://img.shields.io/badge/license-Private-ef4444?style=for-the-badge)

</div>

---

## 📖 Overview

**Syntiox Ideas** is a secure, full-stack feedback collection portal where users can submit ideas, bug reports, feedback, Q&A and general messages to the Syntiox team.

- 🌐 **Frontend** — Pure HTML, CSS, JavaScript (no frameworks)
- ⚡ **Backend** — Vercel Serverless Functions (Node.js)
- 🗄️ **Database** — MongoDB Atlas (with local file fallback for development)
- 🔐 **Security** — AES-256-GCM field encryption + JWT authentication

---

## ✨ Features

### Public Portal (`/`)
| Feature | Details |
|---|---|
| 💡 Idea Submission | Share feature ideas with the team |
| 🐛 Bug Reports | Report bugs with optional screenshots |
| 💬 Feedback | General product feedback |
| ❓ Q&A | Ask questions |
| 📌 General | Anything else |
| ✈️ Telegram | Submit with Telegram username |
| 💬 WhatsApp | Submit with WhatsApp number |
| 📞 Phone | Submit with phone number |
| 🙈 Anonymous | Submit without any contact info |
| 🖼️ Photo Upload | Drag & drop screenshots (up to 5MB) |

### Admin Dashboard (`/login.html`)
| Feature | Details |
|---|---|
| 🔐 Secure Login | JWT-based session (8h expiry) |
| 📊 Stats Cards | Count by category at a glance |
| 🔍 Search | Search by name, message, or contact |
| 🗂️ Filter | Filter by category |
| 🕐 Live Clock | Real-time date & time display |
| 🖼️ Photo Lightbox | Click photos for full-screen view |
| 🗑️ Delete | Remove submissions with confirmation |
| 🔑 Decryption | Contact details shown decrypted (admins only) |
| ⏱️ Auto Logout | Automatically logs out after 8 hours |

---

## 🗂️ Project Structure

```
syntiox idias/
├── 📄 index.html          # Public feedback portal
├── 📄 login.html          # Admin login page
├── 📄 admin.html          # Admin dashboard
├── 🎨 style.css           # Premium dark glassmorphism CSS
├── ⚙️ app.js              # Public portal JavaScript
├── ⚙️ admin-app.js        # Admin dashboard JavaScript
├── 📦 package.json        # Node.js dependencies
├── ▲  vercel.json         # Vercel routing & build config
├── 🔒 .env.example        # Environment variables template
├── 🚫 .gitignore          # Git ignore rules
└── api/
    ├── 🗄️ db.js           # MongoDB + local file fallback
    ├── 🔐 crypto.js       # AES-256-GCM encrypt/decrypt
    ├── 📨 submit.js        # POST /api/submit
    ├── 🔑 login.js         # POST /api/login
    └── 📋 submissions.js   # GET + DELETE /api/submissions
```

---

## 🚀 Deployment (Vercel)

### Option A — Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Upload the `syntiox idias` folder
3. Set **Framework Preset** to `Other`
4. Add Environment Variables (see below)
5. Click **Deploy** 🎉

### Option B — Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to project folder and deploy
vercel

# For production deployment
vercel --prod
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
# MongoDB Atlas connection string (optional — falls back to local file if missing)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/syntiox

# Admin panel password
ADMIN_PASSWORD=YourStrongPasswordHere!

# JWT signing secret (any long random string, min 32 chars)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# AES-256 encryption key (MUST be exactly 64 hex characters)
ENCRYPTION_KEY=generate_with_command_below
```

**Generate `ENCRYPTION_KEY`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate `JWT_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

> ⚠️ **Never commit `.env.local` to Git!** It's already in `.gitignore`.

---

## 🗄️ Database Setup

### MongoDB Atlas (Recommended for Production)

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas) → Create a **Free Cluster**
2. Create a database user with a strong password
3. Whitelist IP `0.0.0.0/0` (for Vercel serverless)
4. Click **Connect** → **Drivers** → copy the connection string
5. Replace `<password>` with your password and paste into `MONGODB_URI`

### Local Development (No Setup Needed)
If `MONGODB_URI` is not set, the app automatically uses a **local JSON file** (`.local-db.json`) for storage. Perfect for testing without any cloud setup.

---

## 🔐 Security Architecture

```
User submits form
       │
       ▼
[api/submit.js]
  ├── Validates input (server-side)
  ├── Encrypts contact info → AES-256-GCM ciphertext
  └── Saves to MongoDB/LocalDB
            │
            ▼
      📦 Database
      {
        name: "John",
        contactEncrypted: { iv: "...", authTag: "...", data: "..." },  ← 🔐
        category: "bug",
        message: "...",
        photo: "data:image/png;base64,..."
      }
            │
            ▼
[api/submissions.js] (Admin only — JWT required)
  ├── Verifies JWT token
  ├── Decrypts contactEncrypted → plaintext
  └── Returns decrypted data to admin only
```

| Layer | Protection |
|---|---|
| Contact Data | AES-256-GCM encryption at rest |
| Admin Session | JWT (HS256, 8h expiry) |
| Password | Direct comparison (serverless-safe) |
| XSS | `escapeHtml()` on all admin-rendered content |
| CSRF | Stateless JWT — no cookies |
| Photo | 5MB limit, `image/*` type validation |

---

## 🛠️ Local Development

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Install project dependencies
npm install

# 3. Set up environment variables
copy .env.example .env.local
# Edit .env.local with your values

# 4. Start local dev server (supports Serverless Functions)
vercel dev
```

Open `http://localhost:3000` in your browser.

> **Default dev credentials** (when env vars not set):
> - Admin Password: `admin123`
> - Encryption: Dev fallback key (not secure — set `ENCRYPTION_KEY` for production!)

---

## 📡 API Reference

### `POST /api/submit`
Submit user feedback.

**Request Body:**
```json
{
  "name": "John Doe",
  "contactType": "telegram",
  "contactValue": "@johndoe",
  "category": "idea",
  "message": "It would be great if...",
  "photo": "data:image/png;base64,..." 
}
```

**Categories:** `idea` | `bug` | `feedback` | `qa` | `general`  
**Contact Types:** `telegram` | `whatsapp` | `number` | `none`

---

### `POST /api/login`
Admin login.

**Request Body:**
```json
{ "password": "your_admin_password" }
```

**Response:**
```json
{ "success": true, "token": "eyJ...", "expiresIn": "8h" }
```

---

### `GET /api/submissions`
Get all submissions. **Requires `Authorization: Bearer <token>` header.**

**Query Params:** `?category=bug&search=crash&page=1&limit=50`

---

### `DELETE /api/submissions?id=<id>`
Delete a submission. **Requires auth header.**

---

## 🎨 Design System

- **Theme:** Dark Glassmorphism
- **Fonts:** Inter + Space Grotesk (Google Fonts)
- **Colors:** Purple → Blue → Cyan gradient
- **Animations:** Floating orbs, fade-in-up, spring transitions
- **Responsive:** Mobile-first, works on all screen sizes

---

## 📝 License

Private — Syntiox Team use only.

---

<div align="center">
  Made with ❤️ by the <strong>Syntiox Team</strong>
  <br>
  <sub>All submissions are encrypted and stored securely.</sub>
</div>
