var datacubeSlicer = require('datacube-image-slicer');
window.onload = function goGoGadgetDatacubeSlicer () {
    var allReady = function () {
        jQuery("#slicer_loading").fadeOut(1000, function fadeMRIslicerIn() {
            var jqC = jQuery("canvas");
            jqC.css({"background": "#FFDDFF"}).toggle("slide");
        });
    };

    // Config
    //http://en.wikipedia.org/wiki/Magnetic_resonance_imaging
    var mriConfig = {
        canvasAttrs: {"id": "interactive_mri"},
        cb: allReady,
        data: "../../sample_data/TT1.json",
        debug: true,
        drawColor: "red",
        gap: 0,
        gauge: true,
        gaugeWidth: 50,
        gaugeDialColor: 'rgb(100,200,200)',
        idleAnimation: true,
        idleAnimationPercentage: 0.3,
        mouseout: "slide-to-center",
        mouseoutDelay: 100,
        mouseoutAnimationDur: 500,
        target: "#canvas_wrapper",
    };

    // Let's do this!
    var mri = new datacubeSlicer(mriConfig);
};
