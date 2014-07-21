x = [];
for (var i = 0; i < 25; ++i) {
    for (var j = 0; j < 25; ++j) {
        for (var k = 0; k < 25; ++k) {
            if (!x[i]) x[i] = [];
            if (!x[i][j]) x[i][j] = [];
            x[i][j][k] = Math.ceil(Math.random()*255);
        }
    }
}
console.log(JSON.stringify(x));