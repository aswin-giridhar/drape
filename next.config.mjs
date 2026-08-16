/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 uses Turbopack by default, which does its own file watching.
  // An empty config is enough; a leftover `webpack` block makes the build fail.
  //
  // Note for WSL: projects under /mnt/* get no inotify events, so if dev-server
  // HMR appears not to fire, run with CHOKIDAR_USEPOLLING=true rather than
  // assuming a cache bug.
  turbopack: {},
};

export default nextConfig;
