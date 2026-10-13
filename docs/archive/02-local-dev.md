
`docs/02-local-dev.md`

```md
# التشغيل محليًا

## المتطلبات
Node.js 20+، npm 10+، حساب GitHub.

## الخطوات
```bash
git clone https://github.com/<you>/colapia.git && cd colapia
npm install
npx shadcn@latest init -d
npx shadcn@latest add button input label textarea select switch tabs badge card dialog sheet dropdown-menu accordion tooltip separator scroll-area checkbox radio-group slider table sonner
cp .env.example .env.local     # وأدخل المفاتيح
