# Stage 1: Build the Vue app
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web/ ./apps/web/

RUN pnpm --filter web build

# Stage 2: Serve with nginx
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY apps/web/nginx.conf /etc/nginx/conf.d/storyclaw.conf

COPY --from=build /app/apps/web/dist /usr/share/nginx/html/storyclaw

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
