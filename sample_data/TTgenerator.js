var fs = require('fs');
var path = require('path');
var x = [],
    cubeW = 256;
for (var i = 0; i < cubeW; ++i) {
    for (var j = 0; j < cubeW; ++j) {
        for (var k = 0; k < cubeW; ++k) {
            if (!x[i]) x[i] = [];
            if (!x[i][j]) x[i][j] = [];
            x[i][j][k] = Math.floor((i+j+k)/3);
        }
    }
}

fs.writeFile(path.resolve(__dirname, 'cubeData.json'), JSON.stringify(x), function(err) {
    if(err) {
        console.log(err);
    } else {
        console.log("cubeData.json saved!");
    }
});
