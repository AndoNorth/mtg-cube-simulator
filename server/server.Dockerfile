# ---------- Base deps layer ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first (cache-friendly)
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build layer ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile TypeScript
RUN npm run build

# ---------- Production layer ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy production deps only
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Copy your local txt file into the image
# (can be overridden by volume later)
COPY local/.txt /app/data/.txt

EXPOSE 3000

CMD ["node", "dist/index.js"]

