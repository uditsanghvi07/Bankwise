/** @type {import('next').NextConfig} */
// API traffic is proxied by `src/app/api/[...path]/route.ts` (reads INTERNAL_API_URL at request time).
// Rewrites here were unreliable for some tunnels; the route handler matches the same paths.
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
