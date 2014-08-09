// inspired by http://jsfiddle.net/splis/VwPL9/
//             http://bl.ocks.org/mbostock/3074470#heatmap.json
/* jshint -W040, unused:true */
(function datacubeSlicerLoader (undefined) {
    "use strict";

    var pos = {                 // current view position
            x: null,
            y: null,
            z: null
        },
        canvasAttrs,
        colors,     // array, d3.scale for two colors to draw with
        colorString,
        colorDrawRGB,          // array, [red, green, blue] of requested colors
        clr0R, clr0G, clr0B,    // exploded colorsDrawRGB for fast reference
        debug,
        d3, d3Canv,
        gap,                    // px, width between imgs
        gaugeWidth,             // px, gauge width
        gaugeDialRadius,    // px, dial raidus
        cb,                     // callback, onload
        ctx,                    // canvas context
        dx, dy, dz,             // px, cube width, height, depth
        defX, defY, defZ,       // int, default view positions
        drawPenalty,            // boolean, flags that datacube is not granted to respond to mousemove events
        drawLock, drawLockPings,// bool, prevents draw events from queueing, number, draw requests while another request is still actively drawn
        gaugeDialColor,
        heatmap,                // Array, 3d data to render
        idleAnimationPercentage,// % (approximate), 1.00 === 100%, 0.50 === 50%, etc
        idleEnabled,            // Boolean, permit idle animation
        idleIntvl, idleAniIntvl,// defines time-based idle activity
        minFrameRenderTime,     // ms, permit at least this time between redraw-calls during animation
        mo_f, mo_dt, mo_at,     // mouseout function, set once by config init.  ms, delay time, ms, animation time
        height, width,          // int, canvas dimensions
        reset, resetInterval,   // Timeout, function to reset panes
        SS, xS, yS, yS2, zS, hS,// d3 scalars
        target,                 // Selector, where to place the canvas
        tmrStart, tmrStop;      // ms, timer markers for measuring browser performance

    if (typeof module !== "undefined" && typeof require !== "undefined") {
        d3 = require('d3');
        colorString = require("color-string");
    } else {
        if (!window.d3 || !window.colorString) throw new Error("datacube slicer dependencies not met");
        d3 = window.d3;
        colorString = window.colorString;
    }

    /**
     * Generates a new 3-pane slicer
     * @param  {Object} config {
     *     data: 'string' filepath to json/3d data array
     * }
     */
    function datacubeSlicer (config) {
        var configValue;
        if (!config || !config.data) {
            throw new Error("Attempted to build 3d slicer with insufficient config data!");
        }

        // Default initialization
        colors = ["black", "white"];
        drawLock = false;
        drawLockPings = 0;
        drawPenalty = false;
        gap = 5;
        gaugeWidth = 0;
        gaugeDialColor = '#000000';
        gaugeDialRadius = 5;
        idleAnimationPercentage = 0.25;
        mo_at = 1000;
        mo_dt = 500;
        mo_f = 1;  // 1 => animate mouseout
        target = "body";

        // User initialization
        for (var prop in config) {
            if (config.hasOwnProperty(prop)) {
                configValue = config[prop];
                switch(prop) {
                    case 'canvasAttrs':
                        canvasAttrs = configValue;
                        break;
                    case 'cb':
                        cb = configValue;
                        break;
                    case 'data':
                        break;
                    case 'debug':
                        debug = configValue;
                        break;
                    case 'drawColor':
                        colors[0] = configValue;
                        break;
                    case 'gap':
                        gap = configValue;
                        break;
                    case 'gauge':
                        gaugeWidth = config.gaugeWidth || 20;
                        break;
                    case 'gaugeWidth':
                        gaugeWidth = configValue;
                        break;
                    case 'gaugeDialColor':
                        gaugeDialColor = configValue;
                        break;
                    case 'idleAnimation':
                        idleEnabled = true;
                        break;
                    case 'idleAnimationPercentage':
                        idleAnimationPercentage = configValue;
                        break;
                    case 'mouseout':
                        if (configValue === "slide-to-center") break;
                        mo_f = 0; // 0 => snapback mouseout
                        break;
                    case 'mouseoutAnimationDur':
                        mo_at = configValue;
                        break;
                    case 'mouseoutDelay':
                        mo_dt = configValue;
                        break;
                    case 'target':
                        target = configValue;
                        break;
                    default:
                        throw new Error("Invalid configuration parameter passed (" +
                            prop + ")");
                }
            }
        }

        // Post-user init processing
        colorDrawRGB = colorString.getRgb(colors[0]);
        clr0R = colorDrawRGB[0];
        clr0G = colorDrawRGB[1];
        clr0B = colorDrawRGB[2];

        d3.json(config.data, bootstrap);
    }



    /**
     * Initializes canvas data, environment, and event hanlders
     * @param  {Error} error - from parsing input JSON
     * @param  {Array} heatmap - 3d array of 'heat' integers
     */
    function bootstrap (error, hm) {
        if (error) {
            console.error("Unable to fetch heatmap data");
            // draw some fail image on the canvas, perhaps reloader button
            throw error;
        }

        if (!document.createElement('canvas').getContext) {
            throw new Error("Your browser is unsupported");
            // IE polyfill should have been loaded to added canvas API to
            // old browsers (excanvas.js)
        }

        // init heatmap vals
        heatmap = hm;
        dx = heatmap.length - 1;
        dy = heatmap[0].length - 1;
        dz = heatmap[0][0].length - 1;
        defX = Math.floor(dx/2);
        defY = Math.floor(dy/2);
        defZ = Math.floor(dz/2);
        pos = {
            x: defX,
            y: defY,
            z: defZ
        };
        height = d3.max([dx, dz]);
        width = dy + gap + dy + gap + dx + gap + gaugeWidth + gaugeDialRadius;

        // init scales
        SS = d3.scale.linear()
            .range([0, 1, 2, 3, 4, 5, 6, 7, 8])
            .domain([0, dy, dy+gap, 2*dy+gap, 2*dy+2*gap, 2*dy+2*gap+dx, 2*dy+3*gap+dx, 2*dy+3*gap+dx+gaugeWidth, width]);
        xS = d3.scale.linear()
            .domain([0, dx])
            .range([0, dx]);
        yS = d3.scale.linear()
            .domain([0, dy])
            .range([dy, 0]);
        yS2 = d3.scale.linear()
            .domain([0, dy])
            .range([0, dy]);
        zS = d3.scale.linear()
            .domain([0, dz])
            .range([0, dz]);
        hS = d3.scale.linear()
            .domain([0, 255])
            .range([0, height]);
        // if (debug) {
        //     console.log('x, y, z: ', dx, dy, dz);
        //     console.dir({zones:
        //         [
        //             {Z_START: SS.invert(0)},
        //             {Z_END: SS.invert(1)},
        //             {GAP_1_START: SS.invert(1)},
        //             {GAP_1_STOP: SS.invert(2)},
        //             {Y_START: SS.invert(2)},
        //             {Y_STOP: SS.invert(3)},
        //             {GAP_2_START: SS.invert(3)},
        //             {GAP_2_STOP: SS.invert(4)},
        //             {X_START: SS.invert(4)},
        //             {X_STOP: SS.invert(5)},
        //             {GAP_3_START: SS.invert(5)},
        //             {GAP_3_STOP: SS.invert(6)},
        //             {GAUGE_START: SS.invert(6)},
        //             {GAUGE_STOP: SS.invert(7)},
        //             {GAUGE_DIAL_START: SS.invert(7)},
        //             {GAUGE_DIAL_STOP: SS.invert(8)}
        //         ]
        //     });
        // }

        d3Canv = d3.select(target).append("canvas")
            .attr({
                "width": width,
                "height": height,
                "class": "datacube-slicer"
            });
        if (canvasAttrs) {
            d3Canv.attr(canvasAttrs);
        }
        ctx = d3Canv.node().getContext("2d");

        d3Canv.call(timerStart)
            .call(drawImage, heatmap, 0, 0, dy, height, defZ, 2)
            .call(drawImage, heatmap, dy+gap, 0, dy, height, defX, 0)
            .call(drawImage, heatmap, 2*dy+2*gap, 0, dx, height, defY, 1)
            .call(timerStop)
            .call(setMinFrameRenderTime)
            .on('mousemove', mmv)
            .on('mouseout', mo);
        if (gaugeWidth) {
            d3Canv.call(drawGaugeBar, 2*dy+3*gap+dx, 0);
        }

        idleAnimation(idleEnabled);
        if (cb) cb();
    }



    /**
     * Removes current value indicator from gauge
     * @param  {Number=} x - gauge index
     * @param  {Object} canvas contact
     */
    function clearGauge (x) {
        if (!x) x = Math.floor(SS.invert(7));
        ctx.clearRect(x,0, gaugeDialRadius, height);
    }



    /**
     * Contrains a value between two bounds
     * @param  {Number} val
     * @param  {Number} lowerLimit
     * @param  {Number} upperLimit
     * @return {Number}
     */
    function constrain (val, lowerLimit, upperLimit) {
        if (val >= lowerLimit && val <= upperLimit) return val;
        return Math.max(Math.min(val, upperLimit), lowerLimit);
    }



    /**
     * Paints a gradient gauge to right right of the slice panes
     * @param  {Canvas} canvas
     * @param  {Number} sx - shift/x
     * @param  {Number} sy - shift/y
     */
    function drawGaugeBar (canvas, sx) { //,sy
        var grd=ctx.createLinearGradient(sx, 0, sx, height);
        grd.addColorStop(0,colors[0]);
        grd.addColorStop(1,"rgba(" + clr0R + "," + clr0G + "," + clr0B + ",0)");
        ctx.fillStyle=grd;
        ctx.fillRect(sx, 0, gaugeWidth, height);
    }



    /**
     * Draws passed data onto the canvas
     * @param  {Canvas} canvas
     * @param  {Object} hm - data object
     * @param  {Number} sx - shift/x
     * @param  {Number} sy - shift/y
     * @param  {Number} w  - width
     * @param  {Number} h  - height
     * @param  {Number} cc - slice index
     * @param  {Number} type - chart index.  Key == {x:0, y:1, z:2}
     */
    function drawImage(canvas, hm, sx, sy, w, h, cc, type) {
        var cVal; // variables to store color value
        cc = Math.floor(cc); // force integer values
        // array of slicing functions 3D to 2D
        var fnx = [function(x,y) {return hm[cc][dy-1-y][x];},
                   function(x,y) {return hm[y][cc][x];},
                   function(x,y) {return hm[x][dy-1-y][cc];}],
            // array of ranges for a slice
            mxs = [[dz,dy],[dz,dx],[dz,dy]],

            sub = fnx[type],
            maxX= mxs[type][0],
            maxY= mxs[type][1],

            image = ctx.createImageData(w, h);

        for (var x = 0, p = -1; x < maxX; ++x) {
            for (var y = 0; y < maxY; ++y) {
                cVal = sub(x,y) || 0;
                image.data[++p] = clr0R;
                image.data[++p] = clr0G ;
                image.data[++p] = clr0B;
                image.data[++p] = 255-cVal; //sign(cVal % 255) * 255;
            }
        }
        ctx.putImageData(image, sx, sy);
    }



    /**
     * Enables a periodic sway motion in the mri slicer
     * canvas to demonstrate it's ability without user
     * interaction
     * @param  {Boolean} enable - turn the feature on or off
     */
    function idleAnimation (enable) {
        if (!enable) {
            if (idleIntvl) clearInterval(idleIntvl);
            idleIntvl = null;
            if (idleAniIntvl) clearInterval(idleAniIntvl);
            idleAniIntvl = null;
            return;
        }
        var smallestAniAxis = d3.min([dx, dy, dz]),
            defAni, aniPos;
        // Find smallest axis, learn animation's constraint
        if (smallestAniAxis === dx) {
            defAni = defX;
            aniPos = 'x';
        } else if (smallestAniAxis === dy) {
            defAni = defY;
            aniPos = 'y';
        } else {
            defAni = defZ;
            aniPos = 'z';
        }

        idleIntvl = setInterval(function scheduleIdleAnimation () {
            if (idleAniIntvl) return;
            var moveCount = 0;
            idleAniIntvl = setInterval(function animateLateralScroll () {
                if (moveCount < defAni/2) --pos[aniPos];
                else if (moveCount < defAni*1.5) ++pos[aniPos];
                else if (moveCount < defAni*2) --pos[aniPos];
                else {
                    clearInterval(idleAniIntvl);
                    idleAniIntvl = null;
                }
                drawImage(ctx, heatmap, dy+gap, 0, dy, height, pos[aniPos], 0);
                drawImage(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos[aniPos], 1);
                drawImage(ctx, heatmap, 0, 0, dy, height, pos[aniPos], 2);
                ++moveCount;
            }, minFrameRenderTime);
        }, Math.floor(minFrameRenderTime*defAni*2*(1/idleAnimationPercentage)));
    }



    /**
     * Respond to mouse movement over the canvas
     */
    function mmv() {
        if (drawPenalty) {
            return;
        }
        if (drawLock) {
            ++drawLockPings;
            return;
        }
        drawLock = true;
        var self = this,
            lockDurPenalty = 0,
            x = constrain(d3.mouse(self)[0], 0, width),
            y = constrain(d3.mouse(self)[1], 0, height);

        idleAnimation(false);

        // Reset to int values as animations permit non-int positions
        // Floor per animations and browser zoom permitting decimal values
        pos.x = Math.floor(pos.x);
        pos.y = Math.floor(pos.y);
        pos.z = Math.floor(pos.z);
        clearInterval(resetInterval);
        clearTimeout(reset);
        reset = null;

        switch (Math.ceil(SS(x))) {
        case 1: // Z
            pos.x = dx - Math.floor(xS.invert(y));
            pos.y = Math.floor(yS.invert(x));
            drawImage(ctx, heatmap, dy+gap, 0, dy, height, pos.x, 0);
            drawImage(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y, 1);
            break;
        case 3: // X
            pos.z = Math.floor(zS.invert(y));
            pos.y = dy - Math.floor(yS2.invert(x-dy-gap));
            drawImage(ctx, heatmap, 0, 0, dy, height, pos.z, 2);
            drawImage(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y, 1);
            break;
        case 5: // Y
            pos.z = Math.floor(zS.invert(y));
            pos.x = Math.floor(xS.invert(x-2*dy-2*gap));
            drawImage(ctx, heatmap, 0, 0, dy, height, pos.z, 2);
            drawImage(ctx, heatmap, dy+gap, 0, dy, height, pos.x, 0);
            break;
        default:
        }
        if (gaugeWidth) updateGauge();
        /* If many move events fired before this function could finish drawing, make note.
         * Penalize subsequent drawing by permitting the thread to focus elsewhere as clearly
         * we cannot draw fast enough. */
        if (drawLockPings) {
            drawPenalty = true;
            lockDurPenalty = constrain(drawLockPings * 5, 1, 1000);
            drawLockPings = 0;
        }
        setTimeout(function clearDrawLock () {
            drawLock = false;
            drawPenalty = false;
        }, lockDurPenalty || 0);
    }



    /**
     * Handles mouseout activites for the mri canvas
     */
    function mo () {
        clearGauge();
        if (mo_f === 1) {
            if (minFrameRenderTime === undefined) {
                throw new Error("Cannot animate MRI panes unless a max " +
                                "refresh rate is defined");
            }
            var animationDuration = mo_at, // ms
                revertFrames = Math.ceil(animationDuration/minFrameRenderTime),
                revertInc = { // distance incriments for each refresh frame to travel
                    x: (defX - pos.x)/revertFrames,
                    y: (defY - pos.y)/revertFrames,
                    z: (defZ - pos.z)/revertFrames
                };

            // pauseBeforeReset delays for 500 ms before sliding the mri
            // images back to their defaults
            reset = setTimeout(function pauseBeforeReset () {
                /**
                 * Animates the MRI panes to their default positions
                 */
                resetInterval = setInterval(function animateReset () {
                    pos.x += revertInc.x;
                    pos.y += revertInc.y;
                    pos.z += revertInc.z;
                    drawImage(ctx, heatmap, dy+gap, 0, dy, height, pos.x, 0);
                    drawImage(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y, 1);
                    drawImage(ctx, heatmap, 0, 0, dy, height, pos.z, 2);
                    --revertFrames;
                    if (!revertFrames) {
                        clearInterval(resetInterval);
                        pos.x = Math.floor(pos.x);
                        pos.y = Math.floor(pos.y);
                        pos.z = Math.floor(pos.z);
                    }
                }, minFrameRenderTime);
            }, mo_dt);
        } else {
            moSnapBack();
        }
        idleAnimation(idleEnabled);
    }



    /**
     * Draws the view of the default point of slice
     * Called by the mouseout handler, mo()
     */
    function moSnapBack () {
        pos.x = defX;
        pos.y = defY;
        pos.z = defZ;
        drawImage(ctx, heatmap, dy+gap, 0, dy, height, pos.x, 0);
        drawImage(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y, 1);
        drawImage(ctx, heatmap, 0, 0, dy, height, pos.z, 2);
    }



    /**
     * Sets the duration that window may spend rendering a given frame
     * during animation.  Slowest permitted is ~30 FPS (animation ~1s)
     */
    function setMinFrameRenderTime () {
        if (!tmrStart || ! tmrStop) {
            throw new Error("Timer flags must be set to compute " +
                            "max animation speed");
        }
        minFrameRenderTime = Math.ceil((tmrStop - tmrStart) * 1.5);
        if (minFrameRenderTime > 33) minFrameRenderTime = 33; // ~30 FPS w/ 1s animation
        tmrStop = tmrStart = 0;
    }



    /**
     * Gets current UTC timestamp in ms and places into this tmrStart
     * @return {Number} utc time, ms
     */
    function timerStart () {
        tmrStart = (new Date()).getTime();
        return tmrStart;
    }



    /**
     * Gets current UTC timestamp in ms and places into this tmrStop
     * @return {Number} utc time, ms
     */
    function timerStop () {
        tmrStop = (new Date()).getTime();
        return tmrStop;
    }



    /**
     * Updates the indicator on the gauge bar
     */
    function updateGauge () {
        var x              = Math.floor(SS.invert(7)),
            radius         = gaugeDialRadius - 2,
            startAngle     = Math.PI/2,
            endAngle       = 3*Math.PI/2,
            guageValue,
            y;
        if (heatmap[pos.x] !== undefined &&
            heatmap[pos.x][pos.y] !== undefined &&
            heatmap[pos.x][pos.y][pos.z] !== undefined) {
            guageValue = heatmap[pos.x][pos.y][pos.z]; // avgCubeVal(heatmap, 1, pos.x, pos.y, pos.z),
            y = Math.floor(hS(guageValue));
        } else {
            if (heatmap[pos.x] === undefined) throw new Error("Heatmap has no X coord of " + pos.x);
            if (heatmap[pos.x][pos.y] === undefined) throw new Error("Heatmap has no Y coord of " + pos.y);
            if (heatmap[pos.x][pos.y][pos.z] === undefined) throw new Error("Heatmap has no Z coord of " + pos.z);
        }
        if (guageValue < 0 || guageValue > 255) {
            throw new Error("Invalid guageValue detected: " + guageValue);
        }
        clearGauge(x);
        ctx.strokeStyle = gaugeDialColor;
        ctx.beginPath();
        ctx.arc(x + 1, y, radius, startAngle, endAngle, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }

    if (typeof module !== "undefined" && typeof require !== "undefined") {
        module.exports = datacubeSlicer;
    } else if (window.datacubeSlicer) {
        throw new Error("datacubeSlicerdy exists on the window.  Overwriting not permitted.");
    } else {
        window.datacubeSlicer = datacubeSlicer;
    }
})();
