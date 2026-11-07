import type { NextConfig } from "next";

// Baseline security headers for every response. No Content-Security-Policy
// yet: the voice session opens a websocket to Google and Next injects inline
// scripts, so a CSP needs nonces and testing against a live interview.
const securityHeaders = [
  // Never render the app inside someone else's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Report and interview URLs carry ids - don't leak them to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The interview needs the microphone, on this site only; nothing else.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
