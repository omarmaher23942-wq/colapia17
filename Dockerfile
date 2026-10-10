# Dockerfile — تشغيل منصة Colapia على أي مضيف يقبل Docker (Railway، Render، خادم خاص).
# متجر واحد لكل التجار: تطبيق Next.js واحد يحدد المتجر من النطاق (middleware.ts). القاعدة (Neon) والصور
# (UploadThing) وRedis/QStash (Upstash) خارج المضيف، فالنقل بين مضيفين = نفس الصورة ونفس المتغيرات.
#
# البناء لا يحتاج أي سر (lib/env.ts يتخطى التحقق وقت البناء). القيم العامة فقط تُثبَّت في كود المتصفح وقت البناء،
# فتُمرَّر كـ build args (Railway يمررها تلقائياً من متغيرات الخدمة بالاسم نفسه).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY \
    NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -n "$NEXT_PUBLIC_ROOT_DOMAIN" && test -n "$NEXT_PUBLIC_APP_URL" \
  || (echo "✗ ضع NEXT_PUBLIC_ROOT_DOMAIN و NEXT_PUBLIC_APP_URL في متغيرات الخدمة قبل البناء" && exit 1)
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
# الخادم المستقل يحمل الصفحات وما تستورده فقط (ومعه src/ وtemplate/ لتوليد «امتلك متجرك»: next.config.ts).
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
