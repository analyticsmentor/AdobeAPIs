const { exec } = require('child_process');
const chokidar = require('chokidar');
const browserSync = require('browser-sync').create();

// Initialize Browser-Sync
browserSync.init({
  proxy: 'http://localhost:3000',
  files: ['views/*.ejs', 'public/css/*.css'],
  port: 3001,
  notify: false,
  open: false,
});

// Watch for changes in EJS and CSS files
const watcher = chokidar.watch(['views/*.ejs', 'public/css/*.css'], {
  persistent: true,
});

watcher.on('change', path => {
  console.log(`File ${path} has been changed`);
  exec('npm run build:css', (err, stdout, stderr) => {
      if (err) {
          console.error(`Error executing build:css: ${stderr}`);
          return;
      }
      console.log(`build:css output: ${stdout}`);
      browserSync.reload(); // Trigger a reload
  });
});
