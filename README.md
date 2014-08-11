datacube image slicer
======

Generates an interactive 3-paned image 'slicer' from a three dimensional data array.  As the user moves the mouse over the canvas, the paired images update based on the cross-sectioned coordinates of the pointer.

![](https://raw.githubusercontent.com/MRN-Code/datacube-image-slicer/master/img/mri_animated.gif)

## Install
* Works both via `<script src="dist/datacube.img.slicer.min.js">` tag or commonjs `var datacubeSlicer = require('datacube-image-slicer');`.
* Clone this repo, `git clone https://github.com/MRN-Code/datacube-image-slicer.git` then `cd` into the cloned directory
* `npm install` to install the dependencies
* `grunt` to build the js

## Usage
* Prepare your datacube array.  If values are not normalized from 0-255, you must normalize them.  See normalization example below.
* Build a config object.  See config example below.
* Build the pane: `var slicedImagePane = new datacubeSlicer(config);`
* Test in the browser!  Sample .json data is included in the sample_data/ directory.  Additionally, ./test/commonjs/index.html has a functional example ready to play with.

## Configure
```javascript
var config = {
        canvasAttrs: {"id": "interactive_mri"},
        cb: allReady,                       // callback (passes no data)
        data: "../../sample_data/TT1.json", // The **ONLY** required property
        drawColor: "red",                   // "hex", "keyword", or "rgb(...)" accepted.  default: "black"
        gap: 5,                         // px, gap between panes/gauge. default 5px;
        gauge: true,                    // displays a gauge that indicates the cube value
        gaugeWidth: 50,                 // px, default 20
        gaugeDialColor: "#123456",      // "hex", "keyword", or "rgb(...)" accepted.  default: "black"
        idleAnimation: true,            // simulates a mouse hover to catch the user's eye
        idleAnimationPercentage: 0.3,   // % (**approximate**), 1.00 === 100%, 0.50 === 50%, etc. Note, a safety time buffer is added to each async frame render, but no failsafes are put on this.  90%-100% is not recommended until further proofing is builtin/tested.
        invertTransparency: true,       // default: false.  True points values 255 to fully opaque (alpha of 1.0) and 0 => fully transparent
        mouseout: "slide-to-center",    // or false/undefined for "SnapBack"
        mouseoutDelay: 750,             // ms, default 500 (useless on SnapBack)
        mouseoutAnimationDur: 500,      // ms, default 1000 (useless on SnapBack)
        target: "#canvas_wrapper",      // selector, to defaults to body
        transparentExtremes: false      // default: false.  0 & 255 values are transparent
};
```

## Examples
* See `test/window/index.html` or `test/commonjs/index.html` in your browser, post-repo pull.
* I enjoy using [httpster](https://www.npmjs.org/package/httpster) to serve up static files quickly, especially just to see quick demo!

## Dependencies
* If using `npm`, `npm install` should install your dependencies.
* If injecting as a source script directly in your app,
  * [d3](http://d3js.org/) must be on the window scope,
  * [color-string](https://github.com/cdaringe/color-string) `colorStringStandalone.js` must be loaded on the window scope
* Load excanvas for old IE canvas support.

## Normalization
```js
// Normalization process

// Small 2x2x2 datacube for demonstration
// Suppose your data ranges from 5 - 75
var myDataCube = [ // x
    [ // x[0]
        [ // (y) x[0][0]
            5,
            45 // (z) x[0][0][1]
        ], [
            38,
            6
        ]
    ], [
        [
            20,
            50
        ],
        [
            75,
            60
        ],
    ]
];

function scale0_255 (val, oldMin, oldMax) {
    if (val === undefined || val === null) return 0;
    if (val < oldMin || val > oldMax) {
        throw new Error("Input value " + val + " is not within expected data range");
    }
    return Math.floor((255 * (val-oldMin))/(oldMax-oldMin));
}

for (var x in myDataCube) {
    for (var y in myDataCube[x]) {
        for (var z in myDataCube[x][y]) {
            myDataCube[x][y][z] = scale0_255(myDataCube[x][y][z], 5, 75);
        }
    }
}
```
## Gotchas
* Set a background color explicitly on the canvas to produce predectable transparency from each draw

* Do *not* pad the canvas as it biases the mouse position readings.

## ToDo
* Critique.  This is my first grunt/browserify module.  I would love some constructive feedback on code structure for both the build process & general code layout
* Rearrange panes and flip axis
* Testing

### Maybe, maybe not
* Consider permitting invalid JSON "[,,,,]" to reduce filesize
```bash
sed -i .bak 's/ 0\,/\,/g' yourFile.json
sed -i .bak 's/ //g' yourFile.json
```