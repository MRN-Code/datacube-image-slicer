(function initMRISlicer (window, d3, iePf, undefined) {
    "use strict";
    if (!window || !d3 || !iePf) {
        throw new Error("MRI slicer dependencies not met");
    }

    // Main
    d3.json("sample_data/T2.json", bootstrap);

    /**
     * Initializes canvas data, environment, and event hanlders
     * @param  {Error} error - from parsing input JSON
     * @param  {Array} heatmap - 3d array of 'heat' integers
     */
    function bootstrap (error, heatmap) {
        if (error) {
            console.error("Unable to fetch heatmap data");
            // draw some fail image on the canvas, perhaps reloader button
            throw error;
        }
        var factor = 1, // scalar, canvas size scalar
            gap = 5, // px, width between imgs
            margin = {
                top: 20,
                right: 90,
                bottom: 30,
                left: 50
            },

            // init heatmap vals
            dx = heatmap.length, // px, cube width
            dy = heatmap[0].length, // px, cube height
            dz = heatmap[0][0].length, // px, cube depth
            defX = Math.floor(dx/2), // defaults
            defY = Math.floor(dy/2),
            defZ = Math.floor(dz/2),
            pos = {
                x: defX,
                y: defY,
                z: defZ
            },
            gaugeWidth = 15,
            height = d3.max([dx, dz]),
            width = dy + gap + dy + gap + dx + gap + gaugeWidth,

            // init scales
            SS = d3.scale.linear()
                .range([0, 1, 2, 3, 4, 5, 6, 7])
                .domain([0, dy, dy+gap, 2*dy+gap, 2*dy+2*gap, 2*dy+2*gap+dx, 2*dy+3*gap+dx, width]),
            xS = d3.scale.linear()
                .domain([0, dx])
                .range([0, dx]),
            yS = d3.scale.linear()
                .domain([0, dy])
                .range([dy, 0]),
            yS2 = d3.scale.linear()
                .domain([0, dy])
                .range([0, dy]),
            zS = d3.scale.linear()
                .domain([0, dz])
                .range([0, dz]),
            color = d3.scale.linear()
                .domain([0, 255])
                .range(["black", "white"]),
            ctx = d3.select("body").append("canvas")
                .attr({"width": width, "height": height})
                .style({
                    "position": "absolute",
                    "left":  margin.left + "px",
                    "top":  margin.top + "px",
                    "zIndex":  0,
                    "cursor": "crosshair"
                })
                .call(timerStart)
                .call(drawImageZ, heatmap, 0, 0, dy, height, defZ)
                .call(drawImageX, heatmap, dy+gap, 0, dy, height, defX)
                .call(drawImageY, heatmap, 2*dy+2*gap, 0, dx, height, defY)
                .call(drawGaugeBar, heatmap, 2*dy+3*gap+dx, heatmap[defX][defY][defZ])
                .call(timerStop)
                .call(setMaxAnimationSpeed)
                .on('mousemove', mmv)
                .on('mouseout', mo),
            maxAnimationSpeed,
            reset,
            tmrStart,
            tmrStop;


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
         * Handles mouseout activites for the mri canvas
         */
        function mo() {
            if (maxAnimationSpeed === undefined) {
                throw new Error("Cannot animate MRI panes unless a max " +
                    "refresh rate is defined");
            }
            var self = this,
                animationDuration = 500, // ms
                x = d3.mouse(self)[0],
                y = d3.mouse(self)[1],
                revertFrames = Math.ceil(animationDuration/maxAnimationSpeed),
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
                var resetInterval = setInterval(function animateReset () {
                    pos.x += revertInc.x;
                    pos.y += revertInc.y;
                    pos.z += revertInc.z;
                    drawImageX(ctx, heatmap, dy+gap, 0, dy, height, pos.x);
                    drawImageY(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y);
                    drawImageZ(ctx, heatmap, 0, 0, dy, height, pos.z);
                    --revertFrames;
                    if (!revertFrames) {
                        clearInterval(resetInterval);
                        idleAnimation(true);
                    }
                }, maxAnimationSpeed);
            }, 500);
        }



        /**
         * Respond to mouse movement over the canvas
         */
        function mmv() {
            var self = this,
                x = d3.mouse(self)[0],
                y = d3.mouse(self)[1];
            idleAnimation(false);
            if (reset && !inBounds(x,y)) {
                clearTimeout(reset);
                reset = null;
            }
            switch (Math.ceil(SS(x))) {
                case 1: // Z
                    pos.x = dx - Math.floor(xS.invert(y));
                    pos.y = Math.floor(yS.invert(x));
                    drawImageX(ctx, heatmap, dy+gap, 0, dy, height, pos.x);
                    drawImageY(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y);
                    break;
                case 3: // X
                    pos.z = Math.floor(zS.invert(y));
                    pos.y = dy - Math.floor(yS2.invert(x-dy-gap));
                    drawImageZ(ctx, heatmap, 0, 0, dy, height, pos.z);
                    drawImageY(ctx, heatmap, 2*dy+2*gap+gap, 0, dx, height, pos.y);
                    break;
                case 5: // Y
                    pos.z = Math.floor(zS.invert(y));
                    pos.x = Math.floor(xS.invert(x-2*dy-2*gap));
                    drawImageZ(ctx, heatmap, 0, 0, dy, height, pos.z);
                    drawImageX(ctx, heatmap, dy+gap, 0, dy, height, pos.x);
                    break;
                default:
            }
        }



        function drawImageZ(canvas, hm, sx, sy, w, h, zz) {
            var context = canvas.node().getContext("2d"),
                image = context.createImageData(w, h);
            zz = Math.floor(zz);
            for (var x = 0, p = -1; x < dx; ++x) {
                for (var y = dy-1; y >= 0; --y) {
                    image.data[++p] = hm[x][y][zz];
                    image.data[++p] = hm[x][y][zz];
                    image.data[++p] = hm[x][y][zz];
                    image.data[++p] = ((hm[x][y][zz] % 255) >= 0) ? 255 : -255;
                }
            }
            context.putImageData(image, sx, sy);

        }



        function drawImageX(canvas, hm, sy, sx, w, h, xx) {
            var context = canvas.node().getContext("2d"),
                image = context.createImageData(w, h);
            xx = Math.floor(xx) - 1;
            for (var z = 0, p = -1; z < dz; ++z) {
                for (var y = dy-1; y >= 0; --y) {
                    image.data[++p] = hm[xx][y][z];
                    image.data[++p] = hm[xx][y][z];
                    image.data[++p] = hm[xx][y][z];
                    image.data[++p] = ((hm[xx][y][z] % 255) >= 0) ? 255 : -255;
                }
            }
            context.putImageData(image, sy, sx);
        }



        function drawImageY (canvas, hm, sx, sz, w, h, yy) {
            var context = canvas.node().getContext("2d");
            var image = context.createImageData(w, h);
            yy = Math.floor(yy) - 1;
            for (var z = 0, p = -1; z < dz; ++z) {
                for (var x = dx-1; x >= 0; --x) {
                    image.data[++p] = hm[x][yy][z];
                    image.data[++p] = hm[x][yy][z];
                    image.data[++p] = hm[x][yy][z];
                    image.data[++p] = ((hm[x][yy][z] % 255) >= 0) ? 255 : -255;
                }
            }
            context.putImageData(image, sx, sz);
        }



        function drawGaugeBar (canvas, hm, sx, sy) {
            var context = canvas.node().getContext("2d");
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



        function setMaxAnimationSpeed () {
            if (!tmrStart || ! tmrStop) {
                throw new Error("Timer flags must be set to compute " +
                    "max animation speed");
            }
            maxAnimationSpeed = Math.ceil((tmrStop - tmrStart) * 1.5);
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



        function removeZero(axis) {
            axis.selectAll("g").filter(
                function(d) {
                    return !d;
                }
            ).remove();
        }
    }
})(window, d3, ieCanvasPolyfill);
