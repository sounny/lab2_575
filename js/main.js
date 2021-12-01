
//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
var attrArray = ["Square Miles", "Total Population", "Median Age", "Hispanic Population", "Median Household Income"]; //list of attributes
var expressed = attrArray[0]; //initial attribute

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scaleLinear()
    .range([chartHeight - 10, 0])
    .domain([0, 88*1.1]); // csv first column max = 88

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 0.5,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on arizona
    var projection = d3.geoAlbers()
        .center([-7.25, 34.5])
        .rotate([104.64, 0, 0])
        .parallels([29.5, 45.5])
        .scale(3000)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("data/csvArizonaCountyACS2019.csv")); //load attributes from csv
    promises.push(d3.json("data/ArizonaACS2019.geojson")); //load choropleth spatial data
    Promise.all(promises).then(callback);

    function callback(data){
        [csvData, arizona] = data;

        //place graticule on the map
        setGraticule(map, path);

        //asigns variable to county features
        var arizonaCounties = arizona.features;

        //join csv data to GeoJSON enumeration units
        arizonaCounties = joinData(arizonaCounties, csvData);

        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(arizonaCounties, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);

        // dropdown
        createDropdown(csvData);

    };
}; //end of setMap()

function setGraticule(map, path){
    //...GRATICULE BLOCKS FROM MODULE 8
    //create graticule generator
    var graticule = d3.geoGraticule()
        .step([1, 1]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    //create graticule lines
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(arizonaCounties, csvData){
    //...DATA JOIN LOOPS FROM EXAMPLE 1.1
    //loop through csv to assign each set of csv attribute values to geojson county
    for (var i=0; i<csvData.length; i++){
        var csvCounty = csvData[i]; //the current county
        var csvKey = csvCounty.COUNTY; //the CSV primary key

        //loop through geojson counties to find correct county
        for (var a=0; a<arizonaCounties.length; a++){

            var geojsonProps = arizonaCounties[a].properties; //the current county geojson properties
            var geojsonKey = geojsonProps.COUNTY; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvCounty[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    return arizonaCounties;
};

//Natural Breaks color scale
function makeColorScale(data){
    var colorClasses = [
        "#ffffd4",
        "#fed98e",
        "#fe9929",
        "#d95f0e",
        "#993404"
    ];
    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);
    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };
    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();
    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);
    return colorScale;
};

//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};


function setEnumerationUnits(arizonaCounties, map, path, colorScale){
    //add arizona counties to map
    var counties = map.selectAll(".counties")
        .data(arizonaCounties)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "counties " + d.properties.COUNTY;
        })
        .attr("d", path)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale);
        })
        .on("mouseover", function(d){
            highlight(d.properties);
        })
        .on("mouseout", function(d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    //below Example 2.2 line 16...add style descriptor to each path
    var desc = counties.append("desc")
    .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);


    //set bars for each county
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.COUNTY;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);

    //below Example 2.2 line 31...add style descriptor to each rect
    var desc = bars.append("desc")
    .text('{"stroke": "none", "stroke-width": "0px"}');

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;


    // change yscale dynamically
    csvmax = d3.max(csvData, function(d) { return parseFloat(d[expressed]); });

    yScale = d3.scaleLinear()
        .range([chartHeight - 10, 0])
        .domain([0, csvmax*1.1]);

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });

    //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);

    updateChart(bars, csvData.length, colorScale);
};

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });

    //add text to chart title
    var chartTitle = d3.select(".chartTitle")
        .text("Number of Variable " + expressed[3] + " in each county");
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.COUNTY)
        .style("stroke", "black")
        .style("stroke-width", "5");

    setLabel(props);
};

//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("." + props.COUNTY)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });

    d3.select(".infolabel")
        .remove();

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
};

//function to create dynamic label
function setLabel(props){
    //add comma after thousandth: X,XXX,XXX
    var format = d3.format(",");
    //label content
    var labelAttribute = "<h1>" + format(props[expressed]) +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.COUNTY + "_label")
        .html(labelAttribute);

    var countyName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.COUNTY);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};

})();
