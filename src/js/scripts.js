window.numberCounties = 0;
window.loadedCountyData = [];

function extractKeys(obj, keys) {
    return keys.reduce( (current, key) => {
        current[key] = obj[key];
        return current;
    }, {});
}

function addNewData(countyName, incomingCountyData) {
    for (const incomingRow of incomingCountyData) {
        const indexOfRowToInsertBefore = window.loadedCountyData.findIndex((existing) => existing.date >= incomingRow.date);
        if (indexOfRowToInsertBefore === -1)
            window.loadedCountyData.push({ date: incomingRow.date, [countyName]: incomingRow.cases });
        else {
            const pivotRow = window.loadedCountyData[indexOfRowToInsertBefore];
            if (pivotRow.date.getTime() === incomingRow.date.getTime())
                pivotRow[countyName] = incomingRow.cases;
            else
                window.loadedCountyData.splice(indexOfRowToInsertBefore, 0, { date: incomingRow.date, [countyName]: incomingRow.cases });
        }
    }
    var keys = getSelectedCounties().concat(['date']);
    window.loadedCountyData = window.loadedCountyData.map(row => extractKeys(row, keys));
}

function loadCounties() {
    fetch('../data/counties.json')
        .then(response => response.json())
        .then(json => {
            window.stateCounties = json;
        });
}

function createCountyControls(index) {
    return `State: <select id="state${index}" onchange='onStateChanged(this)'></select><br>` +
        `County: <select id="county${index}" disabled onchange='loadCounty(this)'></select><hr>`;
}

function onAddClicked() {
    const container = getCountiesDiv();
    const wrapper = document.createElement('div');
    const index = window.numberCounties++;
    wrapper.innerHTML = createCountyControls(index);
    container.appendChild(wrapper);
    const stateComponent = document.getElementById(`state${index}`);
    stateComponent.add(new Option("--Select state--"))
    Object.keys(window.stateCounties).sort().forEach(state => stateComponent.add(new Option(state)));
}

function getCountiesDiv() {
    return document.getElementById("counties");
}

function clearChart() {
    document.getElementById("chart").innerHTML = "";
}

function onClear() {
    window.numberCounties = 0;
    window.loadedCountyData = [];
    getCountiesDiv().innerHTML = "";
    clearChart();
}

function onStateChanged(select) {
    const index = +select.id.slice(5);
    const countySelect = document.getElementById(`county${index}`);

    if (select.value[0] === '-') { // --Select state--
        countySelect.disabled = true;
        return;
    }

    while (countySelect.options.length > 0)
        countySelect.remove(0);

    const counties = window.stateCounties[select.value];
    countySelect.add(new Option("--Select county--"))
    for (const county in counties)
        countySelect.add(new Option(counties[county]));
    
    countySelect.disabled = false;
}

// from https://stackoverflow.com/a/41387286/80525
function movingAvg (data, neighbors) {
    return data.map((val, idx, arr) => {
      let start = Math.max(0, idx - neighbors), end = idx + neighbors;
      let subset = arr.slice(start, end + 1);
      let sum = subset.reduce((a,b) => a + b.cases, 0);
      return {date: val.date, cases: sum / subset.length};
    })
  }

let chart;
let z = d3.scaleOrdinal(d3.schemeCategory10);

/*
    const dataAvg = movingAvg(data, 7);

    var curvedLine = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.avg))
        .curve(d3.curveBasis);

    chart.append('path')
             .attr('class', 'avg')
             .datum(dataAvg)
             .attr('d', curvedLine);
*/

function getSelectedCounties() {
    let index = 0;
    const counties = [];
    while (document.getElementById(`state${index}`) !== null) {
        counties.push(document.getElementById(`county${index}`).value + ', ' + document.getElementById(`state${index}`).value);
        index++;
    }
    return counties;
}

// Based on https://bl.ocks.org/LemoNode/a9dc1a454fdc80ff2a738a9990935e9d
function drawChart(data) {
    var keys = getSelectedCounties();

	var parseTime = d3.timeParse("%Y%m%d"),
		formatDate = d3.timeFormat("%Y-%m-%d"),
		bisectDate = d3.bisector(d => d.date).left,
		formatValue = d3.format(",.0f");

	var svg = d3.select("#chart"),
		margin = {top: 15, right: 35, bottom: 15, left: 35},
		width = +svg.attr("width") - margin.left - margin.right,
		height = +svg.attr("height") - margin.top - margin.bottom;

	var x = d3.scaleTime()
		.rangeRound([margin.left, width - margin.right])
		.domain(d3.extent(data, d => d.date))

	var y = d3.scaleLinear()
		.rangeRound([height - margin.bottom, margin.top]);

	var line = d3.line()
		.curve(d3.curveCardinal)
		.x(d => x(d.date))
        .y(d => y(d.cases));
        
    if (document.getElementById('chart').innerHTML === '') { // on create
        svg.append("g")
           .attr("class","x-axis");
           
        svg.append("g")
           .attr("class", "y-axis");

        const focus = svg.append("g")
           .attr("class", "focus");

        focus.append("line").attr("class", "lineHover");
        focus.append("text").attr("class", "lineHoverDate");
           
        svg.append("rect")
           .attr("class", "overlay");
    }

    svg.selectAll("g.x-axis")
        .attr("transform", "translate(0," + (height - margin.bottom) + ")")
		.call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b")));

	svg.selectAll("g.y-axis")
		.attr("transform", "translate(" + margin.left + ",0)");

	var focus = svg.selectAll("g.focus")
		.style("display", "none");

	svg.selectAll("g.focus line.lineHover")
		.style("stroke", "#999")
		.attr("stroke-width", 1)
		.style("shape-rendering", "crispEdges")
		.style("opacity", 0.5)
		.attr("y1", -height)
		.attr("y2",0);

    svg.selectAll("g.focus text.lineHoverDate")
		.attr("text-anchor", "middle")
		.attr("font-size", 12);

	svg.selectAll("rect.overlay")
		.attr("x", margin.left)
		.attr("width", width - margin.right - margin.left)
		.attr("height", height);

	update(0);

	function update(speed) {

		var copy = keys;

		var counties = copy.map(function(id) {
			return {
				id: id,
				values: data.map(d => {return {date: d.date, cases: +(d[id] || 0)}})
			};
		});

		y.domain([
			d3.min(counties, d => d3.min(d.values, c => c.cases)),
			d3.max(counties, d => d3.max(d.values, c => c.cases))
		]).nice();

		svg.selectAll(".y-axis").transition()
			.duration(speed)
			.call(d3.axisLeft(y).tickSize(-width + margin.right + margin.left))

		var series = svg.selectAll(".series")
			.data(counties);

		series.exit().remove();

		series.enter().insert("g", ".focus").append("path")
			.attr("class", "line series")
			.style("stroke", d => z(d.id))
			.merge(series)
		.transition().duration(speed)
			.attr("d", d => line(d.values))

		tooltip(copy);
	}

	function tooltip(copy) {
		
		var labels = focus.selectAll(".lineHoverText")
			.data(copy)

		labels.enter().append("text")
			.attr("class", "lineHoverText")
			.style("fill", d => z(d))
			.attr("text-anchor", "start")
			.attr("font-size",12)
			.attr("dy", (_, i) => 1 + i * 2 + "em")
			.merge(labels);

		var circles = focus.selectAll(".hoverCircle")
			.data(copy)

		circles.enter().append("circle")
			.attr("class", "hoverCircle")
			.style("fill", d => z(d))
			.attr("r", 2.5)
			.merge(circles);

		svg.selectAll(".overlay")
			.on("mouseover", function() { focus.style("display", null); })
			.on("mouseout", function() { focus.style("display", "none"); })
			.on("mousemove", mousemove);

		function mousemove() {

			var x0 = x.invert(d3.mouse(this)[0]),
				i = bisectDate(data, x0, 1),
				d0 = data[i - 1],
				d1 = data[i],
				d = x0 - d0.date > d1.date - x0 ? d1 : d0;

			focus.select(".lineHover")
				.attr("transform", "translate(" + x(d.date) + "," + height + ")");

			focus.select(".lineHoverDate")
				.attr("transform", 
					"translate(" + x(d.date) + "," + (height + margin.bottom) + ")")
				.text(formatDate(d.date));

			focus.selectAll(".hoverCircle")
				.attr("cy", e => y(d[e] || 0))
				.attr("cx", x(d.date));

			focus.selectAll(".lineHoverText")
				.attr("transform", 
					"translate(" + (x(d.date)) + "," + height / 2.5 + ")")
				.text(e => e + " " + formatValue(d[e] || 0) + " cases");

			x(d.date) > (width - width / 4) 
				? focus.selectAll("text.lineHoverText")
					.attr("text-anchor", "end")
					.attr("dx", -10)
				: focus.selectAll("text.lineHoverText")
					.attr("text-anchor", "start")
					.attr("dx", 10)
		}
	}

/*
    var w = 1200,
        h = 400;

    const margin = {top: 20, right: 20, bottom: 30, left: 50};

    var x = d3.scaleBand()
        .domain(data.map(function (d) {
            return d.date;
        }))
        .padding(0.1)
        .range([0, w]);
        
    var y = d3.scaleLinear()
        .domain([0, d3.max(data, function (d) {
            return d.cases;
        })])
        .rangeRound([h, 0]);

    var straightLine = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.cases));
        
    var curvedLine = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.avg))
        .curve(d3.curveBasis);

        if (chart)
            d3.select(".chart").remove();

        chart = d3.select("body").append("svg")
                    .attr("class", "chart")
                    .attr("width", w * data.length -1)
                    .attr("height", h + 200)
                    .append("g")
                    .attr("transform",
                        "translate(" + margin.left + "," + margin.top + ")");
;
// Bar graph 
        
        chart.selectAll(".bar")
        .data(data)
        .enter().append("rect")
                      .attr("class", "bar")
                      .attr("x", function(d) { return x(d.date); })
                      .attr("width", x.bandwidth())
                      .attr("y", function(d) { return y(d.cases); })
                      .attr("height", function(d) { return h - y(d.cases); })
        .exit().remove();

        // Add the x axis
        chart.append("g")
        .attr("transform", "translate(0," + h + ")")
        .call(d3.axisBottom(x))
        .selectAll("text")	
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-90)");

        chart.append("g")
            .call(d3.axisLeft(y));

	    chart.append('path')
             .attr('class', 'avg')
             .datum(dataAvg)
             .attr('d', curvedLine);
*/
}

function loadCounty(countyComponent) {
    if (countyComponent.value[0] === '-') { // --Select county--
        return;
    }
    const index = +countyComponent.id.slice(6);
    const state = document.getElementById(`state${index}`).value;
    const county = countyComponent.value;
    d3.dsv(",", `../data/counties/${county} - ${state}.json`, function(d) {
        return {
            date: new Date(d.date),
            cases: +d.cases,
            deaths: +d.deaths
        };
    }).then(data => addNewData(`${county}, ${state}`, movingAvg(data, 7))).then(() => drawChart(window.loadedCountyData));
}