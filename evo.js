var EvoLisa = function(target, canvas) {
    "use strict"
    this.t = target;    // image we're mutating towards
    this.c = canvas;    // canva we're drawing on

    // ensure our canvas matches the target
    this.c.width = this.c.style.width = this.t.width;
    this.c.height = this.c.style.height = this.t.height;

    this.settings = {
        "max_polygon": 255,
        "max_polygon_points": 10,
        "max_width": this.t.width,
        "max_height": this.t.height
    };

    this.tData = utils.getImagePixelData(this.t);
    this.dna = new Dna(this.settings);

    this.generation = 0;
};

EvoLisa.prototype.start = function(callback) {
    /*
        Entry point for evolution with web workers
    */
    "use strict"
    this.dna.mutate();
    var self = this;
    this.dna.step(this.tData, function() {
        self.initialFitness = this.fit;
        self.step(callback);
    });
};

EvoLisa.prototype.step = function(callback) {
    /*
        Step function for web workes, sets up call backs
    */
    var child = utils.deepCopy(this.dna);
    child.mutate();
    var self = this;

    child.fitness_workers(this.tData, function() {
        if (child.fit < self.dna.fit) {
            self.dna = child;
            self.draw();
        }
        self.generation++;

        if (typeof callback == "function")
                callback();

        self.step_workers(callback);
    });
};

EvoLisa.prototype.draw = function(c) {
    /*
        Ouput our dna to our canvas
    */
    "use strict"
    if (typeof c == "undefined")
        this.dna.draw(this.c);
    else
        this.dna.draw(c);
};

/*******************************************************************************

*/

var Mutation = function(probability, mutate, isValid) {
    this.probability = probability;
    this.mutate = mutate;
    this.isValid = isValid;
    this.index = undefined;
}

/*******************************************************************************

*/
var Dna = function (settings) {
    "use strict"
    this.dna = [];      // contains polygon information
    this.max_polygon = settings["max_polygon"];
    this.max_polygon_points = settings["max_polygon_points"];
    this.max_width = settings["max_width"];
    this.max_height = settings["max_height"];

    this.dnaMutations = [
        new Mutation(1/700, Dna.prototype.addPolygon, Dna.prototype.addPolygon_valid),
        new Mutation(1/700, Dna.prototype.movePolygon, Dna.prototype.movePoint_valid),
        new Mutation(1/1500, Dna.prototype.removePolygon, Dna.prototype.removePolygon_valid)
    ];

    this.polygonMutations = [
        new Mutation(1/1500, Dna.prototype.addPoint, Dna.prototype.addPoint_valid),
        new Mutation(1/1500, Dna.prototype.removePoint, Dna.prototype.removePoint_valid),
        new Mutation(1/1500, Dna.prototype.movePoint, Dna.prototype.movePoint_valid),
        new Mutation(1/1500, Dna.prototype.recolourRed, Dna.prototype.recolour_valid),
        new Mutation(1/1500, Dna.prototype.recolourGreen, Dna.prototype.recolour_valid),
        new Mutation(1/1500, Dna.prototype.recolourBlue, Dna.prototype.recolour_valid),
        new Mutation(1/1500, Dna.prototype.recolourAlpha, Dna.prototype.recolour_valid)
    ];
};

Dna.prototype.draw = function(c) {
    /*
        Output dna to canvas
    */
    "use strict"
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (var i=0; i<this.dna.length; i++)
        this.dna[i].draw(c);
};

Dna.prototype.getFitnessWorker = function() {
    /*
        To speed up the fitness function we can split the data to multiple workers
    */
    "use strict"
    var blob = new Blob([
        "                                                               \
        self.onmessage = function(e) {                                  \
            var fit = 0,                                                \
                p = 0,                                                  \
                numParitions = e.data.numParitions,                     \
                partition = e.data.partition,                           \
                stepSize = 4 * (numParitions / 3);                      \
            for (var i=partition; i<e.data.tData.length; i+=stepSize) { \
                p = e.data.tData[i] - e.data.cData[i];                  \
                fit += p*p;                                             \
            }                                                           \
            self.postMessage({fit: fit});                               \
        }                                                               \
        "
    ]);
    var blobURL = window.URL.createObjectURL(blob);
    return new Worker(blobURL);
};

Dna.prototype.getFitnessWorker_basic = function() {
    /*
        To speed up the fitness function we can split the data to multiple workers
    */
    "use strict"
    var blob = new Blob([
        "                                                               \
        self.onmessage = function(e) {                                  \
            var fit = 0,                                                \
                p = 0,                                                  \
                cData = e.data.cData,                                   \
                tData = e.data.tData;                                   \
            for (var i=0; i<cData.length; i+=4) {                       \
                var r = tData[i] - cData[i];                            \
                var g = tData[i+1] - cData[i+1];                        \
                var b = tData[i+2] - cData[i+2];                        \
                fit += r*r + g*g + b*b;                                 \
            }                                                           \
            self.postMessage({fit: fit});                               \
        }                                                               \
        "
    ]);
    var blobURL = window.URL.createObjectURL(blob);
    return new Worker(blobURL);
};

var WORKERS = undefined;

Dna.prototype.fitness_workers = function(tData, workersComplete) {
    /*

    */
    var NUM_WORKERS = 3,
        self = this;

    this.workersWaiting = NUM_WORKERS;

    if (typeof WORKERS === "undefined") {
        WORKERS = [];
        for (var i=0; i<NUM_WORKERS; i++) {
            var w = this.getFitnessWorker()
            WORKERS.push(w);
        }
    }

    max = 0;

    WORKERS.forEach(function(worker) {
        worker.onmessage = function(e) {
            self.workersWaiting--;
            self.fit = self.fit ? self.fit + e.data.fit : e.data.fit;
            var delta = new Date().getTime() - e.data.y;
            if (delta > max) {
                max = delta
                //console.log(max);
            }

            if (self.workersWaiting == 0) {
                if (typeof workersComplete === "function")
                    workersComplete.apply(self);
            }
        };
    });

    var c = document.createElement('canvas');
    c.width = c.style.width = this.max_width;
    c.height = c.style.height = this.max_height;

    this.draw(c);

    var ctx = c.getContext('2d'),
        fit = 0,
        cData = ctx.getImageData(0, 0, this.max_width, this.max_height).data;

    // pass the full set of data to each worker, they can then sort through which segment they're doing
    for (var i=0; i<NUM_WORKERS; i++) {
        data = {tData: tData, cData: cData, partition: i, numParitions: NUM_WORKERS};
        WORKERS[i].postMessage(data);
    }
};

Dna.prototype.fitness_workers_basic = function(tData, workersComplete) {
    var NUM_WORKERS = 1,
        self = this;

    this.workersWaiting = NUM_WORKERS;

    if (typeof WORKERS === "undefined") {
        WORKERS = [];
        for (var i=0; i<NUM_WORKERS; i++) {
            var w = this.getFitnessWorker()
            WORKERS.push(w);
        }
    }

    WORKERS.forEach(function(worker) {
        worker.onmessage = function(e) {
            self.workersWaiting--;
            self.fit = self.fit ? self.fit + e.data.fit : e.data.fit;
            if (self.workersWaiting == 0) {
                if (typeof workersComplete === "function")
                    workersComplete.apply(self);
            }
        };
    });

    var c = document.createElement('canvas');
    c.width = c.style.width = this.max_width;
    c.height = c.style.height = this.max_height;

    this.draw(c);

    var ctx = c.getContext('2d');
    var fit = 0;
    var cData = ctx.getImageData(0, 0, this.max_width, this.max_height).data;

    data = {tData: tData, cData: cData};
    WORKERS[0].postMessage(data);
};

Dna.prototype.fitness = function(tData) {
    /*
        Determine the "fitness" of our current DNA string
    */
    "use strict"

    // check if we've cached this fitness already
    if (this.fit)
        return this.fit;

    var c = document.createElement('canvas');
    c.width = c.style.width = this.max_width;
    c.height = c.style.height = this.max_height;

    this.draw(c);

    var ctx = c.getContext('2d');
    var fit = 0;
    var cData = ctx.getImageData(0, 0, this.max_width, this.max_height).data;
    for (var i=0; i<cData.length; i+=4) {
        //red
        var r = tData[i] - cData[i];
        //green
        var g = tData[i+1] - cData[i+1];
        //blue
        var b = tData[i+2] - cData[i+2];

        //the fourth element represents alpha, which we don't care about

        fit += r*r + g*g + b*b;
    }
    this.fit = fit;
    return fit;
};

Dna.prototype.mutate = function() {
    /*
        Mutate our dna!
    */
    "use strict"
    // clear the cached fitness
    this.fit = undefined;

    var mutated = false;
    while (!mutated) {
        this.dnaMutations.forEach(function(mutation) {
            if (mutation.isValid.apply(this)) {
                if (Math.random() < mutation.probability) {
                    mutated = true;
                    mutation.mutate.apply(this);
                }
            }
        }, this)

        this.dna.forEach(function(chromosone, index) {
            this.polygonMutations.forEach(function(mutation) {
                if (mutation.isValid.apply(this, [index])) {
                    if (Math.random() < mutation.probability) {
                        mutated = true;
                        mutation.mutate.apply(this, [index]);
                    }
                }
            }, this);
        }, this)
    }
};

Dna.prototype.addPolygon = function() {
    /*
        Adds a randomly generated polygon to our DNA, either at specified index or at the end
    */
    var poly = new Polygon(),  // polygon we'll be adding
        num_points_add = utils.random(this.max_polygon_points - 3); // we know we need at least 3 points, so look for the number we can have above that

    for (var i=0; i<num_points_add + 3; i++) {
        var p = new Point().random(this.max_width, this.max_height);
        poly.addPoint(p);
    }

    poly.color = utils.randomColorAlpha(Math.random()); // randomize alpha too?

    var index = utils.random(this.dna.length);
    this.dna.splice(index, 0, poly);
}

Dna.prototype.addPolygon_valid = function() {
    /*
        Can a polygon be added to our dna?
    */
    "use strict"
    return this.dna.length < this.max_polygon;
}

Dna.prototype.movePolygon = function() {
    /*
        randomly pick a polygon and move it somewhere else in the dna string
    */
    "use strict"
    var index = utils.random(this.dna.length),
        poly = this.dna.splice(index, 1)[0];
    index = utils.random(this.dna.length );
    this.dna.splice(index, 0, poly);
};

Dna.prototype.movePolygon_valid = function(dna, settings) {
    /*
        Remvoes a polygon from a given index
    */
    "use strict"
    return dna.length > 1;
};


Dna.prototype.removePolygon = function(index) {
    /*
        Remvoes a polygon from a given index
    */
    "use strict"
    this.dna.splice(utils.random(this.dna.length), 1);
}

Dna.prototype.removePolygon_valid = function() {
    /*
        can a polygon be removed from our dna?
    */
    "use strict"
    return this.dna.length > 0;
};

Dna.prototype.recolour_valid = function() {
    /*
        only case we can't recolour is when we don't actually have any polygons 
    */
    return this.dna.length > 0;
};

Dna.prototype.recolourRGBA = function(index, part) {
    /*
        change a portion of our color
    */
    "use strict"
    var color = this.dna[index].color,
        rgb = color.substring(4, color.length-1)
         .replace(/ /g, '')
         .split(','),
        replacement = 0;
    if (part == 3)
        replacement = Math.random();
    else
        replacement = utils.random(255);

    rgb[part] = replacement;
    this.dna[index].color = "rgba(" + rgb.join(",") + ")";
}

Dna.prototype.recolourRed = function(index) {
    /*
        recolour red
    */
    "use strict"
    this.recolourRGBA(index, 0);
};

Dna.prototype.recolourGreen = function(index) {
    /*
        recolour green
    */
    "use strict"
    this.recolourRGBA(index, 1);
};

Dna.prototype.recolourBlue = function(index) {
    /*
        recolour blue
    */
    "use strict"
    this.recolourRGBA(index, 2);
};

Dna.prototype.recolourAlpha = function(index) {
    /*
        recolour alpha
    */
    "use strict"
    this.recolourRGBA(index, 3);
};

Dna.prototype.addPoint = function(index) {
    /*
        move a point to the polygon at the given index
    */
    "use strict"
    var p = new Point().random(this.max_width, this.max_height);
    this.dna[index].addPoint(p);
};

Dna.prototype.addPoint_valid = function(index) {
    /*
        can we add a point to the polygon at the given index? 
    */
    if (this.dna.length > 0)
        return this.dna[index] < this.max_polygon_points;
    return false;
};

Dna.prototype.removePoint = function(index) {
    /*
        remove a random point
    */
    "use strict"
    this.dna[index].points.splice(utils.random(this.dna[index].points.length), 1);
};

Dna.prototype.removePoint_valid = function(index) {
    /*
        can we remove a point?
    */
    "use strict"
    if (this.dna.length > 0)
        return this.dna[index].points.length > 3;
    return false;
};

Dna.prototype.movePoint = function(index) {
    /*
        Give a random point new coords
    */
    "use strict"
    var point_index = utils.random(this.dna[index].points.length);
    this.dna[index].points[point_index].x = utils.random(this.max_width);
    this.dna[index].points[point_index].y = utils.random(this.max_height);
};

Dna.prototype.movePoint_valid = function() {
    /*
        Only invalid when we have no polygons
    */
    return this.dna.length > 0;
};


/*******************************************************************************

*/
var Point = function(x, y) {
    "use strict"
    this.x = x;
    this.y = y;
};

Point.prototype.random = function(x, y) {
    /*
        Generates a random point between the limits of x and y
    */
    return new Point(utils.random(x), utils.random(y));
};


/*******************************************************************************

*/

var Polygon = function() {
    /*
        Polygon constructor
    */
    "use strict"
    this.points = [];
    this.color = null;
};

Polygon.prototype.addPoint = function(p, index) {
    /*
        Add a point to our polygon, either at the end or at the supplied index
    */
    "use strict"
    if (typeof index == "undefined")
        this.points.push(p);
    else
        // add the point as a specific index
        this.points.push.splice(index, 0, p)
};

Polygon.prototype.draw = function(c) {
    /*
        Draw polygon on the supplied canvas
    */
    "use strict"
    var ctx = c.getContext("2d");
    // set the color
    ctx.fillStyle = this.color;
    // start our polygon
    ctx.beginPath();
    // move to start point
    ctx.moveTo(this.points[0].x, this.points[0].y);

    // draw polygon
    for (var i=0; i<this.points.length; i++) {
        var p = this.points[i];
        ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
};


/*******************************************************************************

*/
var utils = {
    random: function(n) { 
        return Math.floor(Math.random() * n)
    },
    randomColorAlpha: function(alpha) {
        var color="rgba(";
        for (var i = 0; i < 3; i++) {
            color += Math.floor(Math.random() * 256) + ",";
        }
        color += alpha + ")";
        return color;
    },
    getImagePixelData: function(img) {
        /*
            Allows access to pixel data for a given image element
        */
        "use strict"
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        return ctx.getImageData(0, 0, img.width, img.height).data;
    },
    deepCopy: function(obj) {
        if (Object.prototype.toString.call(obj) === '[object Array]') {
            var out = [], i = 0, len = obj.length;
            for ( ; i < len; i++ ) {
                out[i] = arguments.callee(obj[i]);
            }
            return out;
        }
        if (typeof obj === 'object') {
            var out = {}, i;
            for ( i in obj ) {
                out[i] = arguments.callee(obj[i]);
            }
            return out;
        }
        return obj;
    },
    getNElements: function(arr, n) {
        if ( n === 1 ) return arr.slice();
        var i, j,
            len = arr.length,
            ret = [];
        for ( i = 0; i < n; i++ ) {
            for ( j = i; j < len; j += n ) {
                ret.push( arr[ j ] );
            }
        }
        return ret;
    }
};