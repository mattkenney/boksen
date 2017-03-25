const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const gutil = require('gulp-util');
const browserSync = require('browser-sync').create();

gulp.task('default', ['start']);

gulp.task('start', function() {
  browserSync.init({
    port:3002
  }, function (err) {
    nodemon({
      env: { 'BROWSER_SYNC': browserSync.getOption('snippet') },
      script: 'bin/www',
      watch: [ 'app.js', 'credentials.js', 'lib', 'routes', 'views' ],
      "verbose": true
    }).on('restart', function () {
      gutil.log('[browserSync]', 'reload');
      setTimeout(() => browserSync.reload(), 1000);
    });
  });
});
