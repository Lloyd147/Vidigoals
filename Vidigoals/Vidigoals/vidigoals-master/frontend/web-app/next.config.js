/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  images: {
    domains: ['media.api-sports.io', 'media-3.api-sports.io', 'media-4.api-sports.io'],
  },
};

module.exports = nextConfig;
