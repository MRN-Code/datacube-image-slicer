// inspired by http://jsfiddle.net/splis/VwPL9/
//             http://bl.ocks.org/mbostock/3074470#heatmap.json
(function initMRISlicer (window, d3, jQuery, undefined) {
    "use strict";
    if (!window || !d3 || !jQuery || !jQuery.effects) {
        throw new Error("MRI slicer dependencies not met");
    }
    if (!document.createElement('canvas').getContext) {
        throw new Error("Your browser is unsupported");
        // IE polyfill should have been loaded to added canvas API to
        // old browsers (excanvas.js)
    }

    var color = d3.scale.linear()
            .domain([0, 255])
            .range(["black", "white"]),
        d3Canv,
        gap = 5,                // px, width between imgs
        pos = {                 // current view position
            x: null,
            y: null,
            z: null
        },
        gaugeWidth = 20,        // px, gauge width
        gaugeDialRadius = 5,   // px, dial raidus
        ctx,                    // canvas context
        dx, dy, dz,             // px, cube width, height, depth
        defX, defY, defZ,       // int, default view positions
        heatmap,                // Array, 3d data to render
        minFrameRenderTime,     // ms, permit at least this time between redraw-calls during animation
        height, width,          // int, canvas dimensions
        reset, resetInterval,   // Timeout, function to reset panes
        SS, xS, yS, yS2, zS, hS,// d3 scalars
        tmrStart, tmrStop;      // ms, timer markers for measuring browser performance


    // Main
    d3.json("sample_data/TT1.json", bootstrap);


    /**
     * Averages values of surround values in cube array
     * @param  {Number} cubeRadius - number of sub elements on
     * either side of cube array center to include in average
     * @return {Number}
     */
    function avgCubeVal (arr3d, cubeRadius, x, y, z) {
        for (var n in arguments) {
            if (arguments.hasOwnProperty(i)) {
                arguments[n] = Math.floor(arguments[n]);
            }
        }
        var noAdds = 0,
            total = 0,
            counts = 0;
        x -= cubeRadius;
        y -= cubeRadius;
        z -= cubeRadius;
        for (var i = 0; i <= cubeRadius*2; i++) {
            for (var j = 0; j<= cubeRadius*2; ++j) {
                for (var k = 0; k<= cubeRadius*2; ++k) {
                    if (arr3d[x+i] && arr3d[x+i][y+j] && arr3d[x+i][y+j][z+k]) {
                        total += arr3d[x+i][y+j][z+k];
                        counts++;
                    } else {
                        ++noAdds;
                    }
                }
            }
        }
        return total/(Math.pow((2*cubeRadius+1),3) - noAdds);
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

        // init heatmap vals
        heatmap = hm;
        dx = heatmap.length;
        dy = heatmap[0].length;
        dz = heatmap[0][0].length;
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

        d3Canv = d3.select("#canvas_wrapper").append("canvas")
            .attr({
                "width": width,
                "height": height,
                "class": "slicer"
            });
        ctx = d3Canv.node().getContext("2d");

        d3Canv.call(timerStart)
            .call(drawImage, heatmap, 0, 0, dy, height, defZ, 2)
            .call(drawImage, heatmap, dy+gap, 0, dy, height, defX, 0)
            .call(drawImage, heatmap, 2*dy+2*gap, 0, dx, height, defY, 1)
            .call(drawGaugeBar, 2*dy+3*gap+dx, 0)
            .call(timerStop)
            .call(setMinFrameRenderTime)
            .on('mousemove', mmv)
            .on('mouseout', mo);

        jQuery("#slicer_loading").fadeOut(1000, function fadeMRIslicerIn() {
            var jqC = jQuery("canvas");
            jQuery("canvas").toggle("slide");
            //(1000).fadeIn();
        });

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
     * Paints a gradient gauge to right right of the slice panes
     * @param  {Canvas} canvas
     * @param  {Number} sx - shift/x
     * @param  {Number} sy - shift/y
     */
    function drawGaugeBar (canvas, sx, sy) {
        var grd=ctx.createLinearGradient(sx, 0, sx, height);
        grd.addColorStop(0,"black");
        grd.addColorStop(1,"white");
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
                image.data[++p] = sub(x,y);
                image.data[++p] = sub(x,y);
                image.data[++p] = sub(x,y);
                image.data[++p] = sign(sub(x,y) % 255) * 255;
            }
        }
        ctx.putImageData(image, sx, sy);
    }



    /**
     * Enables a periodic sway motion in the mri slicer
     * canvas to demonstrate it's ability without user
     * interaction
     * @param  {Boolean} enable - turn the feature on or off
     * @return {Timeout|null}
     */
    function idleAnimation (enable) {
        // when true, if timer already exists return it
        // when false, if timer doesn't exists, return null
        // set interval on THIS, sway canvas back and forth every 15s
    }



    /**
     * Determines if a cursor is within the 3
     * drawn mri panes. Assumed called within context
     * of mouse event on canvas, thus y is always in
     * bounds
     * @param  {Number} x
     * @param  {Number} y
     * @return {Boolean} true, if inbounds
     */
    function inBounds(x, y) {
        var SSval = SS(x);
        return (SSval > 0 && SSval < 6);
    }



    /**
     * Respond to mouse movement over the canvas
     */
    function mmv() {
        var self = this,
            x = d3.mouse(self)[0],
            y = d3.mouse(self)[1];
        idleAnimation(false);
        if (reset) { // !inBounds(x,y)
            // Reset to int values as animations permit non-int positions
            pos.x = Math.floor(pos.x);
            pos.y = Math.floor(pos.y);
            pos.z = Math.floor(pos.z);
            clearInterval(resetInterval);
            clearTimeout(reset);
            reset = null;
        }
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
        if (Math.floor(pos.x) != pos.x) {
            throw new Error("hey you should be an int");
        }
        updateGauge();
    }



    /**
     * Handles mouseout activites for the mri canvas
     */
    function mo() {
        if (minFrameRenderTime === undefined) {
            throw new Error("Cannot animate MRI panes unless a max " +
                "refresh rate is defined");
        }
        var self = this,
            animationDuration = 1000, // ms
            x = d3.mouse(self)[0],
            y = d3.mouse(self)[1],
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
            clearGauge();
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
                    idleAnimation(true);
                }
            }, minFrameRenderTime);
        }, 500);
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
     * Determines if a numeric value is positive, negative, or zero
     * @param  {*} x
     * @return {Number|NaN} 1 for +, -1 for -, else NaN
     */
    function sign(x){
        if( +x === x ) { // check if a number was given
            return (x === 0) ? x : (x > 0) ? 1 : -1;
        }
        return NaN;
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
            anticlockwise  = true,
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
        if (guageValue > 0 && guageValue < 255) {
            ctx.beginPath();
            ctx.arc(x + 1, y, radius, startAngle, endAngle, true);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + 1, y);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }
})(window, d3, jQuery);