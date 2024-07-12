/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.{html,js,jsx,ts,tsx,ejs}',
    './public/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

