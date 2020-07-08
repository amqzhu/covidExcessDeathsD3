function covidExcessDeaths() {
    var files = ["data/observed_data.csv", "data/predicted_data.csv"];
    var promises = [];
    var observedData, predictedData, processedData = {};
    var selectViewAll = true, selectGenderMale = true, selectAge65Plus = true, selectCountry = "austria";
    var maxDate = new Date("2020-01-01"), minDate = new Date("2021-01-01"), minDatePredicted = new Date("2020-02-17");

    var width = document.getElementById("chart-row").offsetWidth;
    var plotWidth, plotHeight;
    var margin = {top: 20, right: 20, bottom: 30, left: 50};

    var compareFunc = function(a, b) {
        if (a.country != b.country) {
            return (a.country).localeCompare(b.country);
        }
        if (a.sex != b.sex) {
            return (a.sex).localeCompare(b.sex);
        }
        if (a.age != b.age) {
            return (a.age).localeCompare(b.age);
        }
        return (a.week).localeCompare(b.week);
    }

    // get promise to load data
    files.forEach(function(url) {
        promises.push(d3.csv(url))
    });

    // evaluate promises
    Promise.all(promises).then(getDataAndPlot, couldNotLoadData);

    d3.select("#select-view").on("change", function() {
        selectViewAll = this.value == "Compare All Countries";
        if (selectViewAll) {
            document.getElementById("select-country").style.display = "none";
            document.getElementById("select-age").style.display = "inline-block";
            document.getElementById("middle-angle").style.display = "inline-block";
            document.getElementById("select-gender").style.display = "inline-block";
        } else {
            document.getElementById("select-country").style.display = "inline-block";
            document.getElementById("select-age").style.display = "none";
            document.getElementById("middle-angle").style.display = "none";
            document.getElementById("select-gender").style.display = "none";
        }

        drawPlot();
    });

    d3.select("#select-gender").on("change", function() {
        selectGenderMale = this.value == "Male";
        drawPlot();
    });
    d3.select("#select-age").on("change", function() {
        selectAge65Plus = this.value == "Over 65 years";
        drawPlot();
    });
    d3.select("#select-country").on("change", function() {
        selectCountry = this.value.toLowerCase();
        drawPlot();
    });

    var tooltip_el = d3.select("#chart-area")
            .append("div")
            .attr("class", "tooltip-el");

    function generateTableHtml(country, data) {
        let html = "<div>" + country + ": week " + data.week + "</div><table><tbody>";
        // html += "<tr><td>Deaths</td><td>" + data.deaths + "</td></tr>";
        // html += "<tr><td>Population</td><td>" + data.population + "</td></tr>";
        html += "<tr><td>Excess deaths</td><td>" + (data.deaths - data.q500) + "</td></tr>";
        html += "<tr><td>Excess percentage</td><td>" + Math.round(100 * data.deaths / data.q500) + "%</td></tr>";
        html += "<tr><td>Excess death rate per 100000</td><td>" + (Math.round((data.deaths - data.q500) * 10000000 / data.population) / 100) + "</td></tr>";
        html += "</tbody></table>";
        tooltip_el.html(html);
    }

    const chart_area_node = d3.select("#chart-area").node();

    function showTooltip(country, data, from_x, event, svg_node) {
        if (event.offsetX < margin.left || event.offsetX > plotWidth - margin.right) {
            tooltip_el.style("visibility", "hidden");
            return;
        }
        tooltip_el.style("visibility", "visible");

        const svg_area = svg_node.getBoundingClientRect();
        const div_area = chart_area_node.getBoundingClientRect();
        const chart_offset_x = svg_area.left - div_area.left;
        const chart_offset_y = svg_area.top - div_area.top;
        tooltip_el.style("left", (event.offsetX + chart_offset_x + 10) + "px");
        tooltip_el.style("top", (event.offsetY + chart_offset_y) + "px");

        let mouse_date = from_x(event.offsetX - margin.left);
        let floor_date = new Date(mouse_date);
        floor_date.setUTCMilliseconds(0);
        floor_date.setUTCSeconds(0);
        floor_date.setUTCMinutes(0);
        floor_date.setUTCHours(0);
        if (country == "England & Wales") {
            floor_date.setUTCDate(floor_date.getUTCDate() - ((floor_date.getUTCDay() + 1) % 7));
        } else {
            floor_date.setUTCDate(floor_date.getUTCDate() - (floor_date.getUTCDay() - 1));
        }
        
        let ceiling_date = new Date(floor_date);
        ceiling_date.setUTCDate(floor_date.getUTCDate() + 7);

        let closest_date =
            (mouse_date.getTime() > (floor_date.getTime() + ceiling_date.getTime()) / 2)
            ? ceiling_date : floor_date;
        let closest_date_str = closest_date.toISOString().substr(0, 10);
        tooltip_el.html("Week: " + closest_date_str);
        let date_found = false;
        for (const d of data) {
            if (d.week == closest_date_str) {
                generateTableHtml(country, d, closest_date);
                date_found = true;
                break;
            }
        }
        if (!date_found) {
            tooltip_el.style("visibility", "hidden");
        }
    }

    // parent function that determines location and data of each plot
    function drawPlot() {
        // clear previous plots before redrawing
        d3.selectAll("svg").remove();
        tooltip_el.style("visibility", "hidden");

        let dataArr = [], countryArr = [];
        let key = ["men_over_65", "women_over_65", "men_under_65", "women_under_65"];
        if (selectViewAll) {
            let dataKey = (selectGenderMale ? "men" : "women") + "_" + (selectAge65Plus ? "over_65" : "under_65");
            for (const [key, value] of Object.entries(processedData)) {
                dataArr.push(value[dataKey]);
                countryArr.push(value["country_label"]);
            }
        } else {
            dataArr = [processedData[selectCountry][key[0]],
                processedData[selectCountry][key[1]],
                processedData[selectCountry][key[2]],
                processedData[selectCountry][key[3]]
            ];
            countryArr = [processedData[selectCountry]["country_label"],processedData[selectCountry]["country_label"],processedData[selectCountry]["country_label"],processedData[selectCountry]["country_label"]];
        }

        let cols = selectViewAll ? 3 : 2;
        let rows = selectViewAll ? 6 : 2;
        plotWidth = width / cols;
        plotHeight = plotWidth * 0.65;

        for (let i=0; i<cols*rows; i++) {
            if (dataArr[i]) {
                drawSinglePlot(countryArr[i], dataArr[i], key[i]);
            }
        }

    }

    function drawSinglePlot(country, data, sexAgeCombo) {
        // one svg element per plot
        let svg = d3.select("#chart-area")
            .append("svg")
                .attr("width", plotWidth)
                .attr("height", plotHeight + margin.top + margin.bottom)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        let x = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([0, plotWidth-margin.left-margin.right]);

        let deathVals = data.map(elem => elem.deaths || 0)
            .concat(data.map(elem => elem.q500 || 0))
            .concat(data.map(elem => elem.q025 || 0))
            .concat(data.map(elem => elem.q975 || 0))

        let yMax = Math.max(...deathVals);
        let yMin = Math.min(...deathVals);
        let y = d3.scaleLinear()
            .domain([yMax, yMin])
            .range([0, plotHeight-margin.top]);

        let xAxis = d3.axisBottom(x);
        let yAxis = d3.axisLeft(y);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (plotHeight - margin.top) + ")")
            .call(xAxis);

        svg.append("g")
          .attr("class", "y axis")
          .call(yAxis)
          .append("text")
            .attr("class", "y-axis-label label")
            .attr("transform", "rotate(-90)")
            .attr("y", -50)
            .attr("x", -10)
            .attr("dy", ".71em")
            .attr("dx", "0.5em")
            .style("text-anchor", "end")
            .text("Deaths");

        if (selectViewAll) {
            // legend for country name
            svg.append("g")
            .attr("class", "legend")
            .attr("height", 100)
            .attr("width", 100)
            .append("text")
                .attr("class", "label")
                .attr("y", plotHeight - margin.top * 2)
                .attr("dy", ".71em")
                .attr("dx", "0.5em")
                .style("text-anchor", "start")
                .text(country);
        } else {
            // legend for sex / age combination
            svg.append("g")
            .attr("class", "legend")
            .attr("height", 100)
            .attr("width", 100)
            .append("text")
                .attr("class", "label")
                .attr("y", plotHeight - margin.top * 2)
                .attr("dy", ".71em")
                .attr("dx", "0.5em")
                .style("text-anchor", "start")
                .text(sexAgeCombo);
        }

        // vertical line
        svg.append("g").append("line")
            .attr("x1", x(minDatePredicted))
            .attr("x2", x(minDatePredicted))
            .attr("y1", y(yMin))
            .attr("y2", y(yMax))
            .attr("stroke", "#6c757d")
            .attr("stroke-width", "1");

        // observed line
        let observedLine = d3.line()
            .x(function(d) { return x(d.xWeek); })
            .y(function(d) { return y(d.deaths); });

        svg.append("path")
            .datum(data)
            .attr("class", "observed-line")
            .attr("d", observedLine);

        // predicted line
        let predictedLine = d3.line()
            .x(function(d) { return x(d.xWeek); })
            .y(function(d) { return y(d.q500); });

        svg.append("path")
            .datum(data.filter(elem => elem.hasOwnProperty('q500')))
            .attr("class", "predicted-line")
            .attr("d", predictedLine);

        // predicted confidence interval area
        let predictedArea = d3.area()
            .x(function(d) { return x(d.xWeek); })
            .y0(function(d) { return y(d.q025); })
            .y1(function(d) { return y(d.q975); });

        svg.append("path")
            .datum(data.filter(elem => elem.hasOwnProperty('q500')))
            .attr("class", "predicted-area")
            .attr("d", predictedArea);

        // tooltip mouse events
        let svg_node = svg.node().parentNode;
        svg_node.addEventListener("mouseover", function() {
            showTooltip(country, data, x.invert, event, svg_node);
        });
        svg_node.addEventListener("mousemove", function() {
            showTooltip(country, data, x.invert, event, svg_node);
        });
        svg_node.addEventListener("mouseout", function() {
            return tooltip_el.style("visibility", "hidden");
        });
    }

    function getDataAndPlot(values) {
        observedData = values[0];
        predictedData = values[1];

        observedData = observedData.filter( elem => (elem.sex == "men" || elem.sex == "women") && (elem.age == "over_65" || elem.age == "under_65"))
            .sort(compareFunc);

        predictedData = predictedData.filter(
                elem => elem.quantity == "total_excess_deaths" && 
                    (elem.sex == "men" || elem.sex == "women") && (elem.age == "over_65" || elem.age == "under_65"))
            .map(elem => ({ "sex": elem.sex,
                    "age": elem.age,
                    "week": elem.week,
                    "country": elem.country,
                    "q025": elem.q025,
                    "q500": elem.q500,
                    "q975": elem.q975 }))
            .sort(compareFunc);

        observedData.forEach(elem => {
            let countryName = elem.country, key = elem.sex + "_" + elem.age;
            let countryData = processedData.hasOwnProperty(countryName) ? processedData[countryName] : 
                { "country_label": elem.country_label, "men_over_65": [], "women_over_65": [], "men_under_65": [], "women_under_65": [] };

            let xWeek = d3.utcParse("%Y-%m-%d")(elem.week);
            if (xWeek < minDate) {
                minDate = xWeek;
            }
            if (xWeek > maxDate) {
                maxDate = xWeek;
            }
            let dp = { "week": elem.week, "xWeek": xWeek, "deaths": parseInt(elem.deaths),
                "population": Math.round(elem.population), "out_of_sample": elem.out_of_sample };
            countryData[key].push(dp);
            processedData[countryName] = countryData;
        })

        predictedData.forEach(elem => {
            let countryData = processedData[elem.country];
            let key = elem.sex + "_" + elem.age;
            for (const dat of countryData[key]) {
                if (dat.week == elem.week) {
                    dat["q025"] = Math.round(elem.q025);
                    dat["q500"] = Math.round(elem.q500);
                    dat["q975"] = Math.round(elem.q975);
                    break;
                }
            }
        });
        drawPlot();
    }

    function couldNotLoadData() {
        console.error("Could not load data");
    }
}

