function covidExcessDeaths() {
    var files = ["data/observed_data.csv", "data/predicted_data.csv"];
    var promises = [];
    var observedData, predictedData, processedData = {};
    var selectViewAll = true, selectGenderMale = true, selectAge65Plus = true, selectCountry = "austria", selectYFree = true;
    var maxDate = new Date("2020-01-01"), minDate = new Date("2021-01-01");
    var overallYMin = null, overallYMax = null, countryYMin = {}, countryYMax = {};

    var width = document.getElementById("chart-row").offsetWidth;
    var plotWidth, plotHeight;
    var margin = {top: 20, right: 20, bottom: 70, left: 54};

    var compareFunc = function(a, b) {
        if (a.country != b.country) {
            return (a.country).localeCompare(b.country);
        }
        return (a.week).localeCompare(b.week);
    }

    let tooltip = d3.select("#chart-area")
            .append("div")
            .attr("class", "tooltip-el");
    const chartAreaNode = d3.select("#chart-area").node();
    let selectedSvgNode = null;
    let selectedDate = null;
    let selectedDateLine = null;

    // get promise to load data
    files.forEach(function(url) {
        promises.push(d3.csv(url))
    });

    // evaluate promises
    Promise.all(promises).then(getDataAndPlot, couldNotLoadData);

    function couldNotLoadData() {
        console.error("Could not load data");
    }

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
    d3.select("#select-scale").on("change", function() {
        selectYFree = this.value == "free";
        drawPlot();
    });

    function generateTableHtml(country, data) {
        let html = "<div>" + country + ": week " + data.week + "</div>";
        if (data.hasOwnProperty("q500")) {
            html += "<table><tbody><tr><td>Excess deaths</td><td>" + (data.deaths - data.q500) + "</td></tr>";
            html += "<tr><td>Excess percentage</td><td>" + Math.round(100 * data.deaths / data.q500) + "%</td></tr>";
            html += "<tr><td>Excess death rate per 100000</td><td>" + (Math.round((data.deaths - data.q500) * 10000000 / data.population) / 100) + "</td></tr>";
            html += "</tbody></table>";
        }
        tooltip.html(html);
    }

    function showTooltip(data, event, svgNode) {
        const svgArea = svgNode.getBoundingClientRect();
        const svgOffsetX = event.clientX - svgArea.left;
        const svgOffsetY = event.clientY - svgArea.top;
        if (svgOffsetX < margin.left || svgOffsetX > plotWidth - margin.right ||
            svgOffsetY < margin.top || svgOffsetY > plotHeight - margin.bottom) {
            if (selectedSvgNode != null) {
                tooltip.style("visibility", "hidden");
                selectedDateLine.remove();
                selectedSvgNode = null;
            }
            return;
        }

        const divArea = chartAreaNode.getBoundingClientRect();
        tooltip.style("left", (event.clientX - divArea.left + 10) + "px");
        tooltip.style("top", (event.clientY - divArea.top) + "px");

        let mouseDate = data.x.invert(svgOffsetX - margin.left);
        let floorDate = new Date(mouseDate);
        floorDate.setUTCMilliseconds(0);
        floorDate.setUTCSeconds(0);
        floorDate.setUTCMinutes(0);
        floorDate.setUTCHours(0);
        floorDate.setUTCDate(floorDate.getUTCDate() - ((floorDate.getUTCDay() + data["weekStartOffset"]) % 7));

        let ceilingDate = new Date(floorDate);
        ceilingDate.setUTCDate(floorDate.getUTCDate() + 7);

        let closestDate =
            (mouseDate.getTime() > (floorDate.getTime() + ceilingDate.getTime()) / 2)
            ? ceilingDate : floorDate;
        let closestDateStr = closestDate.toISOString().substr(0, 10);
        if ((selectedSvgNode != svgNode) || (selectedDate != closestDateStr)) {
            const weekData = data[closestDateStr];
            if (!weekData) {
                if (selectedSvgNode != null) {
                    tooltip.style("visibility", "hidden");
                    selectedDateLine.remove();
                    selectedSvgNode = null;
                }
                return;
            }
            generateTableHtml(data["country_label"], weekData, closestDate);
            if (selectedSvgNode == null) {
                tooltip.style("visibility", "visible");
            } else {
                selectedDateLine.remove();
            }
            selectedSvgNode = svgNode;
            selectedDate = closestDateStr;
            // vertical line
            selectedDateLine = data.svg.append("g").append("line")
                .attr("x1", data.x(closestDate))
                .attr("x2", data.x(closestDate))
                .attr("y1", data.mappedYMin)
                .attr("y2", data.mappedYMax)
                .attr("stroke", "#ff5555")
                .attr("stroke-width", "1");
        }
    }

    // parent function that determines location and data of each plot
    function drawPlot() {
        // clear previous plots before redrawing
        d3.selectAll("svg").remove();
        tooltip.style("visibility", "hidden");
        selectedSvgNode = null;

        let dataArr = [];
        if (selectViewAll) {
            let dataKey = (selectGenderMale ? "men" : "women") + "_" + (selectAge65Plus ? "over_65" : "under_65");
            for (const countryData of Object.values(processedData)) {
                dataArr.push(countryData[dataKey]);
            }
        } else {
            dataArr = [
                processedData[selectCountry]["men_over_65"],
                processedData[selectCountry]["women_over_65"],
                processedData[selectCountry]["men_under_65"],
                processedData[selectCountry]["women_under_65"]
            ];
        }

        let cols = selectViewAll ? 3 : 2;
        plotWidth = width / cols;
        plotHeight = plotWidth * 0.8;

        dataArr.forEach(elem => drawSinglePlot(elem));
    }

    function drawSinglePlot(data) {
        // one svg element per plot
        const svg = d3.select("#chart-area")
            .append("svg")
                .attr("width", plotWidth)
                .attr("height", plotHeight)
            .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        const x = d3.scaleTime()
            .domain([minDate, maxDate])
            .range([0, plotWidth-margin.left-margin.right]);

        const insideHeight = plotHeight - margin.top - margin.bottom;
        const y = d3.scaleLinear()
            .domain(selectYFree ? [data.yMax, data.yMin] : 
                selectViewAll ? [overallYMax, overallYMin] : 
                [countryYMax[data['country_label']], countryYMin[data['country_label']]])
            .range([0, insideHeight]);

        data.x = x;
        data.y = y;

        const xAxis = d3.axisBottom(x);
        const yAxis = d3.axisLeft(y);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + insideHeight + ")")
            .call(xAxis);

        svg.append("g")
          .attr("class", "y axis")
          .call(yAxis)
          .append("text")
            .attr("class", "y-axis-label label")
            .attr("transform", "rotate(-90)")
            .attr("y", -52)
            .attr("x", -10)
            .attr("dy", ".71em")
            .attr("dx", "0.5em")
            .style("text-anchor", "end")
            .text("Deaths");

        // legend for country name
        svg.append("g")
        .attr("class", "legend")
        .append("text")
            .attr("class", "label")
            .attr("x", -margin.left / 2)
            .attr("y", insideHeight + 35)
            .style("text-anchor", "start")
            .text(data[selectViewAll ? "country_label" : "sex_age"]);

        // vertical line
        data.mappedYMin = y(selectYFree ? data.yMin : selectViewAll ? overallYMin : countryYMin[data['country_label']]);
        data.mappedYMax = y(selectYFree ? data.yMax : selectViewAll ? overallYMax : countryYMax[data['country_label']]);
        svg.append("g").append("line")
            .attr("x1", x(data["minDatePredicted"]))
            .attr("x2", x(data["minDatePredicted"]))
            .attr("y1", data.mappedYMin)
            .attr("y2", data.mappedYMax)
            .attr("stroke", "#6c757d")
            .attr("stroke-width", "1");

        const weeksData = data["all_weeks"];

        // observed line
        const observedLine = d3.line()
            .x(function(d) { return x(d.xWeek); })
            .y(function(d) { return y(d.deaths); });

        svg.append("path")
            .datum(weeksData)
            .attr("class", "observed-line")
            .attr("d", observedLine);

        // predicted line
        const predictedLine = d3.line()
            .x(function(d) { return x(d.xWeek); })
            .y(function(d) { return y(d.q500); });

        svg.append("path")
            .datum(weeksData.filter(elem => elem.hasOwnProperty('q500')))
            .attr("class", "predicted-line")
            .attr("d", predictedLine);

        // predicted confidence interval area
        const predictedArea = d3.area()
            .x(function(d) { return x(d.xWeek); })
            .y0(function(d) { return y(d.q025); })
            .y1(function(d) { return y(d.q975); });

        svg.append("path")
            .datum(weeksData.filter(elem => elem.hasOwnProperty('q025') && elem.hasOwnProperty('q975')))
            .attr("class", "predicted-area")
            .attr("d", predictedArea);

        // tooltip mouse events
        data.svg = svg;
        const svgNode = svg.node().parentNode;
        svgNode.addEventListener("mouseenter", function() {
            showTooltip(data, event, svgNode);
        });
        svgNode.addEventListener("mousemove", function() {
            showTooltip(data, event, svgNode);
        });
        svgNode.addEventListener("mouseleave", function() {
            if (selectedSvgNode != null) {
                tooltip.style("visibility", "hidden");
                selectedDateLine.remove();
                selectedSvgNode = null;
            }
        });
    }

    function getDataAndPlot(values) {
        observedData = values[0];
        predictedData = values[1];

        observedData = observedData.filter( elem => (elem.sex == "men" || elem.sex == "women") && (elem.age == "over_65" || elem.age == "under_65"))
            .sort(compareFunc);

        predictedData = predictedData.filter(
                elem => elem.quantity == "no_pandemic_deaths" && 
                    (elem.sex == "men" || elem.sex == "women") && (elem.age == "over_65" || elem.age == "under_65"))
            .map(elem => ({ "sex": elem.sex,
                    "age": elem.age,
                    "week": elem.week,
                    "country": elem.country,
                    "q025": elem.q025,
                    "q500": elem.q500,
                    "q975": elem.q975 }));

        observedData.forEach(elem => {
            const countryName = elem.country, key = elem.sex + "_" + elem.age;
            let countryData = processedData[countryName];
            if (!countryData) {
                countryData = {};
                for (const key of ["men_over_65", "women_over_65", "men_under_65", "women_under_65"]) {
                    countryData[key] = {
                        "country_label": elem["country_label"],
                        "sex_age": key,
                        "all_weeks": []
                    };
                }
                processedData[countryName] = countryData;
            }

            let xWeek = d3.utcParse("%Y-%m-%d")(elem.week);
            if (xWeek < minDate) {
                minDate = xWeek;
            }
            if (xWeek > maxDate) {
                maxDate = xWeek;
            }
            let dp = {
                "week": elem.week,
                "xWeek": xWeek,
                "deaths": parseInt(elem.deaths),
                "population": Math.round(elem.population),
                "out_of_sample": elem["out_of_sample"]
            };
            const chartData = countryData[key];
            chartData[elem.week] = dp;
            chartData["all_weeks"].push(dp);
        })

        predictedData.forEach(elem => {
            const weekData = processedData[elem.country][elem.sex + "_" + elem.age][elem.week];
            if (weekData) {
                weekData["q025"] = Math.round(elem.q025);
                weekData["q500"] = Math.round(elem.q500);
                weekData["q975"] = Math.round(elem.q975);
            }
        });

        for (const countryData of Object.values(processedData)) {
            for (const chartData of Object.values(countryData)) {
                const countryName = chartData['country_label'];
                const weeksData = chartData["all_weeks"];
                const deathVals = weeksData.map(elem => elem.deaths)
                    .concat(weeksData.map(elem => elem.q500))
                    .concat(weeksData.map(elem => elem.q025))
                    .concat(weeksData.map(elem => elem.q975))
                    .filter(death => !!death);

                chartData.yMin = Math.min(...deathVals);
                chartData.yMax = Math.max(...deathVals);

                if ((overallYMin == null) || (chartData.yMin < overallYMin)) {
                    overallYMin = chartData.yMin;
                }
                if ((overallYMax == null) || (chartData.yMax > overallYMax)) {
                    overallYMax = chartData.yMax;
                }

                
                if (countryYMin.hasOwnProperty(countryName)) {
                    countryYMin[countryName] = Math.min(countryYMin[countryName], chartData.yMin);
                } else {
                    countryYMin[countryName] = chartData.yMin;
                }

                if (countryYMax.hasOwnProperty(countryName)) {
                    countryYMax[countryName] = Math.max(countryYMax[countryName], chartData.yMax);
                } else {
                    countryYMax[countryName] = chartData.yMax;
                }

                const minDatePredicted = weeksData.filter(elem => elem.hasOwnProperty('q500'))
                    .map(elem => elem.week).sort()[0];
                chartData["minDatePredicted"] = chartData[minDatePredicted]["xWeek"];
                chartData["weekStartOffset"] = 7 - chartData["minDatePredicted"].getUTCDay();
            }
        }

        drawPlot();
    }
}
