/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 uses @tailwindcss/postcss, not the old tailwindcss plugin.
    "@tailwindcss/postcss": {},
  },
};

export default config;
