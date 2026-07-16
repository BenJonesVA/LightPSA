/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone — a self-contained server bundle with only the
  // node_modules actually traced from the build, so the runtime Docker image
  // (see Dockerfile) doesn't need the full node_modules tree copied in.
  output: "standalone",
  // Server Actions default to a 1MB request body, too small for file
  // attachments. Matches lib/storage.ts's MAX_ATTACHMENT_BYTES — this is the
  // transport-level ceiling, that's the app-level one; keep them in sync.
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
