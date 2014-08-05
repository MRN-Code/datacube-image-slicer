// inspired by http://jsfiddle.net/splis/VwPL9/
//             http://bl.ocks.org/mbostock/3074470#heatmap.json
(function datacubeSlicerLoader (undefined) {
	"use strict";

	if (typeof module !== "undefined" && typeof require !== "undefined") {
		d3 = require('d3');
	} else {
		if (!window.d3) throw new Error("datacube slicer dependencies not met");
		d3 = window.d3;
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
		gaugeDialRadius = 5,    // px, dial raidus
		cb,                     // callback, onload
		ctx,                    // canvas context
		dx, dy, dz,             // px, cube width, height, depth
		defX, defY, defZ,       // int, default view positions
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


	// Main
	/**
	 * Generates a new 3-pane slicer
	 * @param  {Object} config {
	 *     data: 'string' filepath to json/3d data array
	 * }
	 */
	function datacubeSlicer (config) {
		if (!config || !config.data) {
			throw new Error("Attempted to build 3d slicer with insufficient config data!");
		}
		if (config.mouseout === undefined || config.mouseout === "slide-to-center") {
			mo_f = 1;  // 1 > animate
		} else if (typeof config.mouseout !== 'string') {
			mo_f = 0; // 0 > snapback
		} else throw new Error("Invalid mouseout requested");

		mo_at = config.mouseoutAnimationDur || 1000;
		mo_dt = config.mouseoutDelay || 500;

		if (config.idleAnimation) {
			idleEnabled = true;
			idleAnimationPercentage = config.idleAnimationPercentage || 0.25;
		}

		target = config.target || "body";
		if (config.cb) {
			cb = config.cb;
		}

		d3.json(config.data, bootstrap);
	}


	/**
	 * TODO: UNUSED - PURGE?
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

		if (!document.createElement('canvas').getContext) {
			throw new Error("Your browser is unsupported");
			// IE polyfill should have been loaded to added canvas API to
			// old browsers (excanvas.js)
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

		d3Canv = d3.select(target).append("canvas")
			.attr({
				"width": width,
				"height": height,
				"class": "datacube-slicer"
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
		var	c = 0; // variable to store color value
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
				c = sub(x,y);
				image.data[++p] = c;
				image.data[++p] = c;
				image.data[++p] = c;
				image.data[++p] = sign(c % 255) * 255;
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
	function mo () {
		if (mo_f === 1) {
			if (minFrameRenderTime === undefined) {
				throw new Error("Cannot animate MRI panes unless a max " +
								"refresh rate is defined");
			}
			var self = this,
				animationDuration = mo_at, // ms
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
				clearGauge();
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

	if (typeof module !== "undefined" && typeof require !== "undefined") {
		module.exports = datacubeSlicer;
	} else if (window.datacubeSlicer) {
		throw new Error("datacubeSlicerdy exists on the window.  Overwriting not permitted.");
	} else {
		window.datacubeSlicer = datacubeSlicer;
	}
})();
