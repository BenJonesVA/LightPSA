/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces .next/standalone — a self-contained server bundle with only the
  // node_modules actually traced from the build, so the runtime Docker image
  // (see Dockerfile) doesn't need the full node_modules tree copied in.
  output: "standalone",
};

export default nextConfig;
