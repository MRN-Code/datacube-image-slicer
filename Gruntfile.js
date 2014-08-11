/*global module:false*/
module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        browserify: {
            test: {
                bundleOptions: {
                    debug: true
                },
                options: {
                    alias: ["./src/source.js:datacube-image-slicer"]
                },
                src: ['test/commonjs/module.js'],
                dest: 'test/commonjs/bundle.js',
            }
        },
        concat: {
          options: {
            banner: '<%= banner %>',
            stripBanners: false
          },
          dist: {
            src: ['lib/<%= pkg.name %>.js'],
            dest: 'dist/<%= pkg.name %>.js'
          }
        },
        cssmin: {
          combine: {
            files: {
              'dist/styles.min.css': ['src/styles.css']
            }
          },
          combineAlt: {
            files: {
              'dist/stylesAlt.min.css': ['src/stylesAlt.css']
            }
          }
        },
        uglify: {
            options: {
                sourceMap: true
            },
          dist: {
            src: 'src/source.js',
            dest: 'dist/datacube.img.slicer.min.js'
          }
        },
        watch: {
          js: {
            files: ['src/**.js', 'test/**.js'], //'<%= jshint.lib_test.src %>',
            tasks: ['browserify','uglify']
          }
        }
});

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-browserify');

  // Default task.
  grunt.registerTask('default', ['browserify', 'uglify', 'cssmin']);

};

/*https://github.com/amitayd/grunt-browserify-jasmine-node-example/blob/master/Gruntfile.js*/
/*
,
          commonjs: {
            src: ['test/commonjs/bundle.js'],
            dest: 'test/commonjs/bundle.min.js'
          }
 */
