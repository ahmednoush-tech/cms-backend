# ============================================================
# Frontend Dockerfile — multi-stage build
#
# The app calls a RELATIVE /api/v1 path by default (see
# src/api/client.ts and vite.config.ts's comment on why) — Nginx
# below reverse-proxies /api/ to the backend container so that
# stays true in production too, with zero CORS configuration
# needed on the backend, exactly mirroring Vite's own dev-server
# proxy behavior.
# ============================================================

FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
# npm install, not npm ci — see backend/Dockerfile's comment on
# why (no committed package-lock.json in this project yet).
RUN npm install

COPY . .
RUN npm run build

# ------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
# /etc/nginx/templates/*.template is the OFFICIAL nginx image's
# own built-in mechanism (envsubst on container start) — used ONLY
# when deploying with a real domain and HTTPS via
# init-letsencrypt.sh (see that script and nginx.conf.template).
# For local testing (no domain, no SSL) the plain nginx.conf below
# is used by default — a real Docker test run against localhost
# caught the previous default (the HTTPS template) refusing to
# even START without a certificate that only exists after running
# init-letsencrypt.sh, which blocked local testing entirely. To
# switch to HTTPS for a real deployment, change the COPY line
# below to:
#   COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
