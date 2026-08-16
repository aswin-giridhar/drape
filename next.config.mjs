/** @type {import('next').NextConfig} */
const nextConfig = {
  // WSL /mnt has no inotify - polling is required for HMR to fire at all
  webpack: (config) => {
    config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
    return config;
  },
};
export default nextConfig;
