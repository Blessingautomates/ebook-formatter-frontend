/**
 * The browser talks to this app, and this app forwards /api/* to the FastAPI
 * backend. Proxying rather than calling the backend directly means the requests
 * are same-origin, so no CORS middleware is needed on the API and the
 * Content-Disposition header on a download stays readable.
 */
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
