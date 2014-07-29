datacube image slicer
======

Generates an interactive, dynamic 3-paned/3-axis image 'slicer' from a 3d data array.  As the user moves the mouse over the canvas, the paired images update based on the cross-sectioned coordinates of the pointer.

![](https://raw.githubusercontent.com/MRN-Code/datacube-image-slicer/master/img/mri_animated.gif)

## Install
* Works both via `<script>` tag or commonjs `require('datacube-slicer`)`.
* Clone this repo
* run `npm install` to install the dependencies
* run `grunt` to build the js and css files
* Open index.html and enjoy!

## Configure
```javascript
var yourConfiguration = {
        data: "../../sample_data/TT1.json", // The ONLY required property
        target: "#canvas_wrapper",          // selector, to defaults to body

        cb: allReady,                   // callback (passes no data)

        idleAnimation: true,            // simulates a mouse hover to catch the user's eye
        idleAnimationPercentage: 0.3,   // % (approximate), 1.00 === 100%, 0.50 === 50%, etc.  Note, a safety time buffer is added to each async frame render, but no failsafes are put on this.  90%-100% is not recommended until further proofing is builtin/tested.

        mouseout: "slide-to-center",    // or false for "SnapBack"
        mouseoutDelay: 750,             // ms, 500 default (useless on SnapBack)
        mouseoutAnimationDur: 500       // ms, 1000 default (useless on SnapBack)
};
```

## Examples
* See `test/window/index.html` or `test/commonjs/index.html` in your browser, post-repo pull.

## Dependencies
* If using `npm`, `npm install` should install your dependencies.
* If injecting as a source script directly in your app, 'd3' must be on the window scope.
* Load excanvas for old IE canvas support.

## Gotchas
* Do *not* pad the canvas as it biases the mouse position readings.

## ToDo
* Critique.  This is my first grunt/browserify module.  I would love some constructive feedback on code structure for both the build process & general code layout
* More mouseout animations
* Toggle heat bar
* Rearrange panes and flip axis
* Testing
