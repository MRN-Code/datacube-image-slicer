// inspired by http://jsfiddle.net/splis/VwPL9/
//             http://bl.ocks.org/mbostock/3074470#heatmap.json

var factor = 1;
var gap = 0;
var margin = {top: 20, right: 90, bottom: 30, left: 50};

d3.json("sample_data/TT1.json", function(error, heatmap) {
    var dx = heatmap.length,
    fdx = factor * dx;
    var dy = heatmap[0].length,
    fdy = factor * dy;
    var dz = heatmap[0][0].length,
    fdz = factor * dz;
    var defX = Math.floor(dx/2)
    var defY = Math.floor(dy/2)
    var defZ = Math.floor(dz/2)
    var height = d3.max([fdx, fdz])
    var width = fdy + gap + fdy + gap + fdx;

    var SS = d3.scale.linear()
        .range([0, 1, 2, 3, 4, 5])
        .domain([0, fdy, fdy+gap, 2*fdy+gap, 2*fdy+2*gap, width])

    var xS = d3.scale.linear()
        .domain([0, dx])
        .range([0, fdx]);

    var yS = d3.scale.linear()
        .domain([0, dy])
        .range([fdy, 0]);

    var yS2 = d3.scale.linear()
        .domain([0, dy])
        .range([0, fdy]);

    var zS = d3.scale.linear()
        .domain([0, dz])
        .range([0, fdz]);

    var color = d3.scale.linear()
        .domain([0, 255])
        .range(["black", "white"])

    var ctx = d3.select("body").append("canvas")
        .attr("width",  width)
        .attr("height", height)
        .style("position","absolute")
        .style("left", margin.left + "px")
        .style("top", margin.top + "px")
        .style("zIndex", 0)
        .style("cursor","crosshair")
        .call(drawImage, heatmap, 0, 0, fdy, height, defZ, 2)
        .call(drawImage, heatmap, fdy+gap, 0, fdy, height, defX, 0)
        .call(drawImage, heatmap, 2*fdy+2*gap, 0, fdx, height, defY, 1)
        .on('mousemove', mmv)
        .on('mouseout', mo);


    function mo() {
        drawImage(ctx, heatmap, 2*fdy+2*gap+gap, 0, fdx, height, defY, 1)
        drawImage(ctx, heatmap, fdy+gap, 0, fdy, height, defX, 0)
        drawImage(ctx, heatmap, 0, 0, fdy, height, defZ, 2)
    }

    function mmv() {
        var self = this;
        var x = d3.mouse(self)[0];
        var y = d3.mouse(self)[1];
        switch(Math.ceil(SS(x))) {
        case 1:
            var xx = dx - Math.floor(xS.invert(y));
            var yy = Math.floor(yS.invert(x));
            drawImage(ctx, heatmap, fdy+gap, 0, fdy, height, xx, 0)
            drawImage(ctx, heatmap, 2*fdy+2*gap+gap,0,fdx,height,yy,1)
            break;
        case 3:
            var zz = Math.floor(zS.invert(y));
            var yy = dy - Math.floor(yS2.invert(x-fdy-gap));
            drawImage(ctx, heatmap, 0, 0, fdy, height, zz,2)
            drawImage(ctx, heatmap, 2*fdy+2*gap+gap,0,fdx,height,yy,1)
            break;
        case 5:
            var zz = Math.floor(zS.invert(y));
            var xx = Math.floor(xS.invert(x-2*fdy-2*gap));
            drawImage(ctx, heatmap, 0, 0, fdy, height, zz, 2)
            drawImage(ctx, heatmap, fdy+gap, 0, fdy, height, xx, 0)
            break;
        default:
        }
    }

    function sign(x){
        if( +x === x ) { // check if a number was given
            return (x === 0) ? x : (x > 0) ? 1 : -1;
        }
        return NaN;
    }

    function drawImage(canvas, hm, sx, sy, w, h, cc, type) {
        // array of slicing functions 3D to 2D
        fnx = [function(x,y) {return hm[cc][dy-1-y][x]},
               function(x,y) {return hm[y][cc][x]},
               function(x,y) {return hm[x][dy-1-y][cc]}];
        // array of ranges for a slice
        mxs = [[dz,dy],[dz,dx],[dz,dy]];

        sub = fnx[type];
        maxX= mxs[type][0];
        maxY= mxs[type][1];

        var context = canvas.node().getContext("2d");
        var image = context.createImageData(w, h);

        for (var x = 0, p = -1; x < maxX; ++x) {
            for (var y = 0; y < maxY; ++y) {
                image.data[++p] = sub(x,y);
                image.data[++p] = sub(x,y);
                image.data[++p] = sub(x,y);
                image.data[++p] = sign(sub(x,y) % 255) * 255;
            }
        }
        context.putImageData(image, sx, sy);
    }

});
