import * as d3 from 'https://cdn.skypack.dev/d3@7';

export class D3Graph {
    #svg;
    #opts;
    #EMPTY_Y_LABEL = 'EMPTY';

    constructor(opts) {
        const marginTop = 20; // top margin, in pixels
        const marginRight = 40; // right margin, in pixels
        const marginBottom = 20; // bottom margin, in pixels
        const marginLeft = 40; // left margin, in pixels
        const width = 640; // outer width, in pixels
        const height = 400; // outer height, in pixels

        this.#opts = Object.assign({
            marginTop,
            marginRight,
            marginBottom,
            marginLeft,
            width,
            height,
            xFunc: ([x]) => x, // given d in data, returns the (temporal) x-value
            // xStart: 'start_date',
            // xEnd: 'end_date',
            // xStep: 'step_minutes',
            ys: [{
                yFunc: ([, y]) => y,
                yField: undefined,
            }],
            xType: d3.scaleUtc, // the x-scale type
            // xDomain, // [xmin, xmax]
            xRange: [marginLeft, width - marginRight], // [left, right]
            yType: d3.scaleLinear, // the y-scale type
            // yDomain, // [ymin, ymax]
            yRange: [height - marginBottom, marginTop], // [bottom, top]
            // yFormat, // a format specifier string for the y-axis
            // yLabel, // a label for the y-axis
            // yPosition,  // 'right' or 'left' (default)
            // defined, // for gaps in data
            curve: d3.curveLinear, // method of interpolation between points
            // fill: "none",
            // fillOpacity: .5,
            color: "currentColor", // stroke color of shape
            strokeLinecap: "round", // stroke shape cap of the shape
            strokeLinejoin: "round", // stroke shape join of the shape
            strokeWidth: 1.5, // stroke width of shape, in pixels
            strokeOpacity: 1, // stroke opacity of shape
        }, opts);

        this.#svg = d3.create("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;");
    }

    getSVG() {
        return this.#svg.node();
    }

    load(data) {
        const {
            ys,
            yLabel,
        } = this.#opts;

        // Compute x values
        const xAxis = this.#computeXAxis(data);

        this.#renderXAxis(xAxis);

        // Construct y axes
        const yAxes = this.#computeYAxes(data);

        // Construct shapes
        for (const y of ys) {
            const myLabel = y.yLabel || yLabel || this.#EMPTY_Y_LABEL;
            const yAxis = yAxes[myLabel];
            if (!yAxis.rendered) {
                this.#renderYAxis(data, yAxis, y);
                yAxis.rendered = true;
            }

            this.#renderShape(data, xAxis, yAxis, y);
        }
    }

    #computeXAxis(data) {
        const {
            xFunc,
            xType,
            xRange,
            xDomain,
            xStart,
            xEnd,
            xStep,
        } = this.#opts;

        let X = [];
        if (xStart && xEnd && xStep) {
            const startDate = new Date(data[xStart]);

            const endDate = new Date(data[xEnd]);
            //TODO: needed until return date contains time
            endDate.setHours(23, 59, 59, 999);

            const step = data[xStep];

            // Compute x values
            let tempDate = new Date(startDate);

            while (tempDate <= endDate) {
                X.push(tempDate)
                tempDate = new Date(tempDate.getTime() + step * 60000);
            }
        } else {
            X = d3.map(data, xFunc);
        }

        // Compute x domain
        let xDom = xDomain;
        if (!xDom) {
            xDom = d3.extent(X);
        }
        // Construct x scale and axis
        const xScale = xType(xDom, xRange);

        return {xScale, xDomain: xDom, X};
    }

    #renderXAxis(xData) {
        const {
            width,
            height,
            marginBottom,
        } = this.#opts;

        const xAxis = d3.axisBottom(xData.xScale).ticks(width / 80).tickSizeOuter(0);

        this.#svg.append("g")
            .attr("transform", `translate(0, ${height - marginBottom})`)
            .call(xAxis);
    }

    #computeYAxes(data) {
        const yAxes = {};
        const {
            yType,
            yRange,
            yDomain,
            yLabel,
            ys,
        } = this.#opts;

        for (const y of ys) {
            const Y = y.yField ? data[y.yField] : d3.map(data, y.yFunc);
            let yDom = y.yDomain || yDomain;
            if (!yDom) {
                yDom = d3.extent(Y);
            }

            const myLabel = y.yLabel || yLabel || this.#EMPTY_Y_LABEL;

            let yAxis = yAxes[myLabel];
            if (!yAxis) {
                yAxis = {Y, yDomain: yDom, rendered: false};
                yAxes[myLabel] = yAxis;
            } else {
                // update existing Y domain to include new values
                yDom = d3.extent(yDom.concat(yAxis.yDomain));
            }
            yAxis.yScale = (y.yType || yType)(yDom, y.yRange || yRange);
        }

        return yAxes;
    }

    #renderYAxis(data, yData, y) {
        const {yFormat, marginLeft, width, height, marginRight, yLabel, yPosition} = this.#opts;

        const yPos = y.yPosition || yPosition || d3.axisLeft;
        const yAxis = (yPos)(yData.yScale).ticks(height / 40, y.yFormat || yFormat);

        const translateX = yPos === d3.axisLeft ? marginLeft : (width - marginRight);

        this.#svg.append("g")
            .attr("transform", `translate(${translateX},0)`)
            .call(yAxis)
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick shape").clone()
                .attr("x2", width - marginLeft - marginRight)
                .attr("stroke-opacity", 0.1))
            .call(g => g.append("text")
                .attr("x", -marginLeft)
                .attr("y", 10)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .text(y.yLabel || yLabel));
    }

    #renderShape(data, xData, yData, y) {
        const defined = y.defined || ((d, i) => !isNaN(xData.X[i]) && !isNaN(yData.Y[i]));

        const D = d3.map(y.yField ? data[y.yField]: data, defined);
        const I = d3.range(xData.X.length);

        const {curve, fill, fillOpacity, color, strokeWidth, strokeLinecap, strokeLinejoin, strokeOpacity} = this.#opts;

        const p = this.#svg.append("path")
            .attr("fill-opacity", y.fillOpacity || fillOpacity)
            .attr("stroke", y.color || color)
            .attr("stroke-width", y.strokeWidth || strokeWidth)
            .attr("stroke-linecap", y.strokeLinecap || strokeLinecap)
            .attr("stroke-linejoin", y.strokeLinejoin || strokeLinejoin)
            .attr("stroke-opacity", y.strokeOpacity || strokeOpacity);

        let shape;
        switch (y.type) {
        case 'area':
            shape = d3.area()
                .defined(i => D[i])
                .x(i => xData.xScale(xData.X[i]))
                .y0(yData.yScale(0))
                .y1(i => yData.yScale(yData.Y[i]));

            p.attr("fill", y.fill || fill || y.color || color)
                .attr("fill-opacity", y.fillOpacity || 0.3);
            break;
        default:
            shape = d3.line()
                .defined(i => D[i])
                .curve(y.curve || curve)
                .x(i => xData.xScale(xData.X[i]))
                .y(i => yData.yScale(yData.Y[i]));

            p.attr("fill", "transparent");
            break;
        }

        p.attr("d", shape(I));
    }
}
