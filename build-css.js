// build-css.js
const fs = require('fs');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

const inputFile = 'public/css/tailwind.css';
const outputFile = 'public/css/tailwind-built.css';

const css = fs.readFileSync(inputFile, 'utf8');

postcss([tailwindcss, autoprefixer])
  .process(css, { from: inputFile, to: outputFile })
  .then(result => {
    fs.writeFileSync(outputFile, result.css);
    if (result.map) {
      fs.writeFileSync(`${outputFile}.map`, result.map.toString());
    }
  })
  .catch(err => {
    console.error('Error during CSS build:', err);
  });
