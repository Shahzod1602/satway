# Test Share Links

Premium foydalanuvchi bitta premium testni **link** orqali boshqalarga ochib beradi.
Ikki tur: **Friend** (maks 3 kishi) va **Class** (cheksiz, o'qituvchi uslubi).
Link ochgan odam **faqat o'sha bitta testga** kirish oladi — to'liq Premium emas.

> Faza 1 (bu hujjat): async share linklar.
> Faza 2 (hali yo'q): o'qituvchi boshqaradigan **Live** sinxron sessiya.

---

## 1. Ma'lumotlar modeli — `prisma/schema.prisma`

```prisma
enum ShareKind { FRIEND  CLASS }

model ShareLink {
  id          String    @id @default(cuid())
  token       String    @unique          // /s/<token> dagi qism
  testId      String
  createdById String
  kind        ShareKind @default(FRIEND)
  maxUses     Int?                        // FRIEND=3, CLASS=null (cheksiz)
  active      Boolean   @default(true)    // revoke = false
  createdAt   DateTime  @default(now())
  test        Test           @relation(...)
  createdBy   User           @relation("ShareCreator", ...)
  uses        ShareLinkUse[]
}

model ShareLinkUse {
  id          String   @id @default(cuid())
  shareLinkId String
  userId      String
  createdAt   DateTime @default(now())
  @@unique([shareLinkId, userId])         // 1 xil odam = 1 slot (idempotent)
}
```

Migration: `prisma/migrations/20260704010000_share_links/`.

---

## 2. Kirish ruxsati (access grant) — `src/lib/share.ts`

```ts
export const FRIEND_CAP = 3;
export function newShareToken()  // randomBytes(9).toString("base64url")

// Foydalanuvchi shu test uchun TIRIK linkni redeem qilganmi?
export async function hasShareGrant(userId, testId): Promise<boolean>
```

`hasShareGrant` ikki joyga ulangan — oddiy premium tekshiruvidan keyin **OR** sifatida:

| Fayl | Qator |
|---|---|
| `src/app/test/[slug]/page.tsx` | `canAccessTest(...) \|\| await hasShareGrant(user.id, test.id)` |
| `src/app/api/attempts/start/route.ts` | xuddi shu OR |

Ya'ni: premium bo'lmagan odam ham, agar shu test uchun tirik link-slot'i bo'lsa, testni ochadi va topshiradi.

---

## 3. Egasi oqimi — link yaratish

**Sahifa:** `/shares` (Sidebar → "Share"), faqat premium.
- `src/app/shares/page.tsx` (server) — testlar ro'yxati + egasining linklari + **natijalar** (kim redeem qilgan + balli).
- `src/app/shares/SharesClient.tsx` (client) — test tanlash, Friend/Class toggle, Generate, Copy, Revoke, natijalarni ochish.

**API:**
- `POST /api/share` — link yaratadi. Premium-gate + rate-limit (30/10min). `kind=FRIEND` → `maxUses=3`, `CLASS` → `null`.
- `DELETE /api/share/[id]` — revoke (`active=false`). Faqat egasi.

Link URL client'da yasaladi: `${window.location.origin}/s/${token}`.

---

## 4. Do'st oqimi — link ochish (redeem)

**Sahifa:** `src/app/s/[token]/page.tsx` (server component). Logika:

1. Token bo'yicha `ShareLink` topiladi (test + egasi + use soni bilan).
2. Yaroqsiz/`active=false` → "Link not available".
3. **Kirmagan** → invite sahifasi ("Falonchi test ulashdi") + `/register?next=/s/<token>` va `/login?next=/s/<token>` tugmalari.
4. **Egasi** o'zi ochsa → to'g'ridan-to'g'ri `/test/<slug>`.
5. **Boshqa user** → **transaction** ichida slot band qilinadi:
   ```
   existing use bormi? → bor bo'lsa ok (idempotent)
   maxUses != null va count >= maxUses → "full"  (Friend 3/3)
   aks holda ShareLinkUse create → ok
   ```
6. `ok` → `/test/<slug>` (testni topshiradi, o'z scaled balli + review oladi).
7. `full` → "This link is full" + upgrade.

**`?next=` qo'llab-quvvatlash** (auth'dan keyin qaytish): `src/lib/nextParam.ts` `safeNext()`
(faqat `/`-bilan boshlanadigan same-origin yo'l, open-redirect'siz). Login va register
sahifalari muvaffaqiyatdan so'ng `router.push(safeNext())` qiladi.

---

## 5. Xavfsizlik / integrity

- **Premium-gate**: faqat premium user link yaratadi (`POST /api/share`).
- **Rate-limit**: `rateLimit("share:<userId>", 30, 10min)`.
- **Cap enforcement**: `$transaction` + `@@unique([shareLinkId,userId])` — bir odam bir slot; Friend'da 3 dan oshmaydi (race'da maksimum 1-2 over-allocation, qabul qilinadi).
- **Revoke**: `active=false` → `hasShareGrant` faqat `active` linklarni sanaydi, shuning uchun kirish darhol to'xtaydi.
- **Maxfiylik**: natijalar panelida ismlar "Ism F." ko'rinishida.
- ⚠️ **Revenue leak**: cheksiz Class link premium kontentni sizdirishi mumkin (bitta obuna → ko'p bepul kirish). Hozircha revoke bor; keyin cheklov qo'shsa bo'ladi (masalan har userga N ta faol Class link, yoki auto-expiry).

---

## 6. Fayllar ro'yxati

```
prisma/schema.prisma                         + ShareKind, ShareLink, ShareLinkUse
prisma/migrations/20260704010000_share_links/
src/lib/share.ts                             hasShareGrant, newShareToken, FRIEND_CAP
src/lib/nextParam.ts                         safeNext()
src/app/s/[token]/page.tsx                   redeem oqimi
src/app/shares/page.tsx                      boshqaruv (server)
src/app/shares/SharesClient.tsx              boshqaruv (client)
src/app/api/share/route.ts                   POST yaratish
src/app/api/share/[id]/route.ts              DELETE revoke
src/app/test/[slug]/page.tsx                 access OR hasShareGrant
src/app/api/attempts/start/route.ts          access OR hasShareGrant
src/components/Sidebar.tsx                    "Share" nav
src/app/login|register/page.tsx              ?next= qo'llab-quvvatlash
```

## 7. Faza 2 — Live sessiya (hali qurilmagan)
O'qituvchi sessiya boshlaydi → o'quvchilar kod bilan qo'shiladi → sinxron start,
jonli monitoring/leaderboard (real-time polling/SSE). Alohida katta ish.
