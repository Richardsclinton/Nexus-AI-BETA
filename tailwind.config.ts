import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "neon-pink": "#FF7BC6",
        "light-blue": "#A3D8F4",
        "deep-black": "#000000",
        "pure-white": "#FFFFFF",
      },
    },
  },
  plugins: [],
};
export default config;
