/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Task configuration.
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
      }
    },
    uglify: {
      dist: {
        src: 'src/source.js',
        dest: 'dist/source.min.js'
      }
    },
    watch: {
      js: {
        files: 'src/**.js', //'<%= jshint.lib_test.src %>',
        tasks: ['uglify']
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  // Default task.
  grunt.registerTask('default', ['uglify', 'cssmin']);

};
