// build-css.js
const fs = require('fs');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

const css = fs.readFileSync('public/css/tailwind.css', 'utf8');

postcss([tailwindcss, autoprefixer])
  .process(css, { from: 'public/css/tailwind.css', to: 'public/css/tailwind-built.css' })
  .then(result => {
    fs.writeFileSync('public/css/tailwind-built.css', result.css);
    if (result.map) {
      fs.writeFileSync('public/css/tailwind-built.css.map', result.map);
    }
  });
