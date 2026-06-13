/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "recaptcha-solver",
      "vosk-koffi",
      "koffi",
      "playwright",
      "playwright-core",
      "playwright-extra",
      "puppeteer-extra-plugin-stealth",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "recaptcha-solver",
        "vosk-koffi",
        "koffi",
        {
          "playwright-extra": "commonjs playwright-extra",
          "puppeteer-extra-plugin-stealth":
            "commonjs puppeteer-extra-plugin-stealth",
          playwright: "commonjs playwright",
          "playwright-core": "commonjs playwright-core",
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
