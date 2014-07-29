var datacubeSlicer = require('../../dist/datacube.img.slicer.min.js');
window.onload = function goGoGadgetDatacubeSlicer () {
    var allReady = function () {
        jQuery("#slicer_loading").fadeOut(1000, function fadeMRIslicerIn() {
            var jqC = jQuery("canvas");
            jQuery("canvas").toggle("slide");
        });
    };

    // Config
    //http://en.wikipedia.org/wiki/Magnetic_resonance_imaging
    var mriConfig = {
        data: "../../sample_data/TT1.json",
        target: "#canvas_wrapper",

        cb: allReady,

        idleAnimation: true,
        idleAnimationPercentage: 0.3,

        mouseout: "slide-to-center",
        mouseoutDelay: 750,
        mouseoutAnimationDur: 500
    };

    // Let's do this!
    var mri = new datacubeSlicer(mriConfig);
};
