const { exec } = require('child_process');
const nodemon = require('nodemon');

nodemon({
  script: 'app.js',
  ext: 'js ejs css',
  ignore: ['public/css/tailwind-built.css'],
}).on('restart', files => {
  if (files) {
    files.forEach(file => {
      if (file.endsWith('.ejs') || file.endsWith('.css')) {
        exec('npm run build:css', (err, stdout, stderr) => {
          if (err) {
            console.error(`Error rebuilding CSS: ${stderr}`);
          } else {
            console.log(stdout);
          }
        });
      }
    });
  }
});
