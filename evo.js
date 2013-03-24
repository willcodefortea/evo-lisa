var EvoLisa = function(target, canvas, fitness) {
    "use strict"
    this.t = target;    // image we're mutating towards
    this.c = canvas;    // canva we're drawing on
    this.f = fitness;   // span to display fitness

    // ensure our canvas matches the target
    this.c.width = this.c.style.width = this.t.width;
    this.c.height = this.c.style.height = this.t.height;

    this.settings = {
        "max_polygon": 20,
        "max_polygon_points": 3,
        "max_width": this.t.width,
        "max_height": this.t.height,
    };

    this.dna = new Dna(this.settings);
    this.generation = 0;
    this.tData = undefined;
};

EvoLisa.prototype.start = function() {
    /*
        entry point for evolution
    */
    "use strict"
};


EvoLisa.prototype.step = function() {
    /*
        Each step allows for a mutation
    */
    "use strict"

    var child = utils.deepCopy(this.dna);
    child.mutate();

    if (child.fitness() < this.dna.fitness())
        this.dna = child;
    this.generation++;
};

EvoLisa.prototype.draw = function() {
    /*
        Ouput our dna to our canvas
    */
    "use strict"
    this.dna.draw(this.c);
    this.outputFitness();
};

EvoLisa.prototype.outputFitness = function() {
    /*
        Ouput fitness to user
    */
    "use strict"
    this.f.innerHTML = this.dna.fitness();
};

/*******************************************************************************

*/
var Dna = function (settings) {
    "use strict"
    this.dna = [];      // contains polygon information
    this.max_polygon = settings["max_polygon"];
    this.max_polygon_points = settings["max_polygon_points"];
    this.max_width = settings["max_width"];
    this.max_height = settings["max_height"];
};

Dna.prototype.fitness = function() {
    /*
        Determine the "fitness" of our current DNA string
    */
    "use strict"

    return 0;
};

Dna.prototype.mutate = function() {

};

Dna.prototype.addPolygon = function(index) {
    /*
        Adds a randomly generated polygon to our DNA, either at specified index or at the end
    */
    "use strict"
    var poly = new Polygon(),  // polygon we'll be adding
        num_points_add = utils.random(this.max_polygon_points - 3); // we know we need at least 3 points, so look for the number we can have above that

    for (var i=0; i<num_points_add + 3; i++) {
        var p = new Point().random(this.max_width, this.max_height);
        poly.addPoint(p);
    }

    poly.color = utils.randomColorAlpha(Math.random()); // randomize alpha too?

    if (typeof index == "undefined")
        this.dna.push(poly);
    else
        this.dna.splice(index, 0, poly)

    console.log(this.dna)
}

Dna.prototype.addPolgon_valid = function() {
    /*
        Can a polygon be added to our dna?
    */
    "use strict"
    return this.dna.length < this.max_polygon;
}

Dna.prototype.removePolygon = function(index) {
    /*
        Remvoes a polygon from a given index
    */
    "use strict"
    this.dna.splce(utils.random(this.dna.length), 1);
}

Dna.prototype.removePolygon_valid = function() {
    /*
        can a polygon be removed from our dna?
    */
    "use strict"
    return this.dna.length > 0;
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


/*******************************************************************************

*/
var Point = function(x, y) {
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

        return ctx.getImageData(0, 0, img.width, img.height);
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
    }
};