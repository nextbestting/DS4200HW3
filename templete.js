// Load the data
const socialMedia = d3.csv("socialMedia.csv");

// Once the data is loaded, proceed with plotting
socialMedia.then(function(data) {
    // Convert string values to numbers
    data.forEach(function(d) {
        d.Likes = +d.Likes;
    });

    // (real quick) clear the div so it doesn’t duplicate if you refresh
    d3.select("#boxplot").selectAll("*").remove();

    // Define the dimensions and margins for the SVG
    const margin = { top: 30, right: 30, bottom: 60, left: 70 };
    const width = 750 - margin.left - margin.right;
    const height = 420 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select("#boxplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Set up scales for x and y axes
    const xScale = d3.scaleBand()
        .domain([...new Set(data.map(d => d.AgeGroup))])
        .range([0, width])
        .padding(0.35);

    const yScale = d3.scaleLinear()
        // you can switch the 1000 to d3.max if you want it auto
        .domain([0, d3.max(data, d => d.Likes)])
        .nice()
        .range([height, 0]);

    // Add scales (axes)
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Add x-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .text("Age Group");

    // Add y-axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Likes");

    // 5-number summary: min, q1, median, q3, max
    const rollupFunction = function(groupData) {
        const values = groupData
            .map(d => d.Likes)
            .filter(v => Number.isFinite(v))
            .sort(d3.ascending);

        const min = d3.min(values);
        const q1 = d3.quantileSorted(values, 0.25);
        const median = d3.quantileSorted(values, 0.50);
        const q3 = d3.quantileSorted(values, 0.75);
        const max = d3.max(values);

        return { min, q1, median, q3, max };
    };

    const quantilesByGroups = d3.rollup(data, rollupFunction, d => d.AgeGroup);

    quantilesByGroups.forEach((quantiles, AgeGroup) => {
        const x = xScale(AgeGroup);
        const boxWidth = xScale.bandwidth();
        const center = x + boxWidth / 2;

        // Draw vertical whisker line (min to max)
        svg.append("line")
            .attr("x1", center)
            .attr("x2", center)
            .attr("y1", yScale(quantiles.min))
            .attr("y2", yScale(quantiles.max))
            .attr("stroke", "black");

        // Draw whisker caps (min + max)
        svg.append("line")
            .attr("x1", center - boxWidth * 0.25)
            .attr("x2", center + boxWidth * 0.25)
            .attr("y1", yScale(quantiles.min))
            .attr("y2", yScale(quantiles.min))
            .attr("stroke", "black");

        svg.append("line")
            .attr("x1", center - boxWidth * 0.25)
            .attr("x2", center + boxWidth * 0.25)
            .attr("y1", yScale(quantiles.max))
            .attr("y2", yScale(quantiles.max))
            .attr("stroke", "black");

        // Draw box (q1 to q3)
        svg.append("rect")
            .attr("x", x)
            .attr("y", yScale(quantiles.q3))
            .attr("width", boxWidth)
            .attr("height", Math.max(0, yScale(quantiles.q1) - yScale(quantiles.q3)))
            .attr("fill", "#cfe8ff")
            .attr("stroke", "black");

        // Draw median line
        svg.append("line")
            .attr("x1", x)
            .attr("x2", x + boxWidth)
            .attr("y1", yScale(quantiles.median))
            .attr("y2", yScale(quantiles.median))
            .attr("stroke", "black")
            .attr("stroke-width", 2);
    });
});


// Prepare your data (IN JS) so there are no missing-file errors.
// This data contains: Platform, PostType, AvgLikes
const socialMediaAvg = socialMedia.then(function(raw) {
    raw.forEach(d => d.Likes = +d.Likes);

    const rolled = d3.rollups(
        raw,
        v => d3.mean(v, d => d.Likes),
        d => d.Platform,
        d => d.PostType
    );

    const flat = [];
    rolled.forEach(([platform, byType]) => {
        byType.forEach(([postType, avgLikes]) => {
            flat.push({ Platform: platform, PostType: postType, AvgLikes: +avgLikes });
        });
    });

    return flat;
});

socialMediaAvg.then(function(data) {
    // Convert string values to numbers (just in case)
    data.forEach(d => d.AvgLikes = +d.AvgLikes);

    // clear so it doesn’t stack
    d3.select("#barplot").selectAll("*").remove();

    // Define the dimensions and margins for the SVG
    const margin = { top: 30, right: 200, bottom: 70, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 430 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select("#barplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define four scales
    // x0: platform buckets
    // x1: post types inside each platform bucket
    // y: average likes
    // color: by post type (legend)
    const platforms = [...new Set(data.map(d => d.Platform))];
    const types = [...new Set(data.map(d => d.PostType))];

    const x0 = d3.scaleBand()
      .domain(platforms)
      .range([0, width])
      .padding(0.2);

    const x1 = d3.scaleBand()
      .domain(types)
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.AvgLikes)])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(types)
      .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);

    // Add scales x0 and y (axes)
    svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x0));

    svg.append("g")
      .call(d3.axisLeft(y));

    // Add x-axis label
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 55)
      .attr("text-anchor", "middle")
      .text("Platform");

    // Add y-axis label
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text("Average Likes");

    // Group container for bars (one group per platform)
    const groupedByPlatform = d3.group(data, d => d.Platform);

    const barGroups = svg.selectAll(".platformGroup")
      .data(platforms)
      .enter()
      .append("g")
      .attr("class", "platformGroup")
      .attr("transform", d => `translate(${x0(d)},0)`);

    // Draw bars
    barGroups.selectAll("rect")
      .data(platform => groupedByPlatform.get(platform) || [])
      .enter()
      .append("rect")
      .attr("x", d => x1(d.PostType))
      .attr("y", d => y(d.AvgLikes))
      .attr("width", x1.bandwidth())
      .attr("height", d => height - y(d.AvgLikes))
      .attr("fill", d => color(d.PostType));

    // Add the legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width + 20}, 0)`);

    types.forEach((type, i) => {
      // little color square
      legend.append("rect")
        .attr("x", 0)
        .attr("y", i * 20)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color(type));

      // Already have the text information for the legend.
      legend.append("text")
          .attr("x", 20)
          .attr("y", i * 20 + 10)
          .text(type)
          .attr("alignment-baseline", "middle");
    });

});


// Prepare your data (IN JS) so there are no missing-file errors.
// This data contains: Date (3/1–3/7) and AvgLikes
const socialMediaTime = socialMedia.then(function(raw) {
    raw.forEach(d => d.Likes = +d.Likes);

    const parse1 = d3.timeParse("%m/%d/%Y");
    const parse2 = d3.timeParse("%m/%d");
    const parseSmart = (s) => {
        if (!s) return null;
        const main = s.split(" ")[0]; // strips "(Thursday)" etc
        return parse1(main) || parse2(main);
    };

    const rolled = d3.rollups(
        raw,
        v => d3.mean(v, d => d.Likes),
        d => (d.Date ? d.Date.split(" ")[0] : "")
    );

    return rolled
        .map(([dateStr, avgLikes]) => ({
            Date: dateStr,
            DateObj: parseSmart(dateStr),
            AvgLikes: +avgLikes
        }))
        .filter(d => d.DateObj)
        .sort((a, b) => d3.ascending(a.DateObj, b.DateObj));
});

socialMediaTime.then(function(data) {
    // Convert string values to numbers
    data.forEach(function(d) {
        d.AvgLikes = +d.AvgLikes;
    });

    // clear so it doesn’t stack
    d3.select("#lineplot").selectAll("*").remove();

    // Define the dimensions and margins for the SVG
    const margin = { top: 30, right: 30, bottom: 85, left: 70 };
    const width = 900 - margin.left - margin.right;
    const height = 430 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3.select("#lineplot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Set up scales for x and y axes
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.DateObj))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.AvgLikes)])
        .nice()
        .range([height, 0]);

    // Draw the axis (rotate x labels so it doesn’t look crowded)
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat("%m/%d")).ticks(data.length);

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(-35)")
        .style("text-anchor", "end");

    svg.append("g")
        .call(d3.axisLeft(yScale));

    // Add x-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 65)
        .attr("text-anchor", "middle")
        .text("Date");

    // Add y-axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .text("Average Likes");

    // Draw the line and path. Remember to use curveNatural.
    const line = d3.line()
        .x(d => xScale(d.DateObj))
        .y(d => yScale(d.AvgLikes))
        .curve(d3.curveNatural);

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2.5)
        .attr("d", line);

    // points (optional but it makes it easier to see each day)
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.DateObj))
        .attr("cy", d => yScale(d.AvgLikes))
        .attr("r", 4)
        .attr("fill", "steelblue");

});
