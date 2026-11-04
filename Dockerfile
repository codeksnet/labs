# One image recipe for every Next.js app. In Coolify set build arg APP=<dir under apps/>.
FROM node:22-alpine AS build
ARG APP
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter "./apps/${APP}..." build

FROM node:22-alpine
ARG APP
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 APP=${APP}
WORKDIR /srv
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
EXPOSE 3000
CMD node apps/${APP}/server.js
