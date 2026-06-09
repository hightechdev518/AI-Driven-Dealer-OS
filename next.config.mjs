/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "playwright",
      "playwright-core",
      "playwright-extra",
      "puppeteer-extra-plugin-stealth",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "playwright-extra": "commonjs playwright-extra",
        "puppeteer-extra-plugin-stealth":
          "commonjs puppeteer-extra-plugin-stealth",
        playwright: "commonjs playwright",
        "playwright-core": "commonjs playwright-core",
      });
    }
    return config;
  },
};

export default nextConfig;
