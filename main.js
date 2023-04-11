import "./map.css";
import * as d3 from "d3";

const COMUNI_R = 5,
  MAX_R = 60,
  MIN_R = COMUNI_R - 1,
  MAX_FILTERS = 2;

const palette1 = [
  "f94144",
  "f3722c",
  "f8961e",
  "f9844a",
  "f9c74f",
  "90be6d",
  "43aa8b",
  "4d908e",
  "577590",
  "277da1",
];
const palette2 = [
  "fbf8cc",
  "fde4cf",
  "ffcfd2",
  "f1c0e8",
  "cfbaf0",
  "a3c4f3",
  "90dbf4",
  "8eecf5",
  "98f5e1",
  "b9fbc0",
];
const palette3 = [
  "d11a1d",
  "1d386d",
  "007481",
  "e0e9ed",
  "000009",
  "262626",
  "e2e2e2",
  "ffffff",
];
const colors = [...palette1, ...palette2, ...palette3];
let activeFilters = [];

const addCoordinates = (data) => {
  return data.map((city) => {
    const getLatitude = () => Math.random() * (44 - 42) + 42;
    const getLongitude = () => Math.random() * (14 - 10) + 10;
    const { comune: name, ...properties } = city;
    return {
      name,
      properties,
      lat: getLatitude(),
      lon: getLongitude(),
    };
  });
};

const getProperties = (data, obj = false) => {
  let acc = {};
  data.forEach((item) => {
    Object.entries(item.properties).forEach(([key, value]) => {
      acc[key] = {
        max: acc[key]?.max > value ? acc[key].max : value,
        min: acc[key]?.min < value ? acc[key].min : value,
      };
    });
  });

  //removeDuplicates
  const red = data.reduce(
    (prev, curr) => ({
      ...prev,
      ...curr.properties,
    }),
    {}
  );

  return obj
    ? Object.entries(acc).reduce(
        (prev, [key, value], index) => ({
          ...prev,
          [key]: {
            property: key,
            color: `#${colors[index]}`,
            className: key.replaceAll(" ", "-"),
            max: value.max,
            min: value.min,
          },
        }),
        {}
      )
    : Object.entries(acc).reduce(
        (prev, [key, value], index) => [
          ...prev,
          {
            property: key,
            color: `#${colors[index]}`,
            className: key.replaceAll(" ", "-"),
            max: value.max,
            min: value.min,
          },
        ],
        []
      );
};

const getRadius = (value, key) => {
  if (properties[key]) {
    return value ? Math.max((value * MAX_R) / properties[key].max, MIN_R) : 0;
  } else {
    return value;
  }
};
let width = window.innerWidth;
let height = window.innerHeight;

const projection = d3.geoMercator().center([11.6, 43.4]).scale(9000); //.center([13.5674, 42.8719]).scale(2200);
const path = d3.geoPath(projection);
const filters = d3.select("#filters");
let markers = [];
let properties = [];
let comuni = [];
let markersLayer, comuniLayer;

// Create the SVG element for the map
const svg = d3
  .select("#container")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

const tooltip = d3.select("#tooltip");

// Load the map data and display it
d3.json("data/italy_regions_rewind.geojson").then(function (regions) {
  //FILTER BY REGION (es. Abruzzo).center([14, 42.60]).scale(15000);
  //const regions = italy.features.filter(feature => ['Toscana', 'Abruzzo'].includes(feature.properties.reg_name))
  svg
    .append("g")
    .selectAll(".region")
    .data(regions.features)
    .enter()
    .insert("path")
    .attr("class", "region")
    .attr("d", path)
    .style("fill", "#ededed45")
    //.style("fill", "#c5c5c545")
    .style("stroke", "#000")
    .style("stroke-width", "0.5px");
  // .on("mouseover", function () {
  //   d3.select(this).transition().duration("50").style("fill-opacity", 0.2);
  // })
  // .on("mouseout", function () {
  //   d3.select(this).transition().duration("50").style("fill-opacity", 1);
  // });
});

// Load the data for the bubbles and display them
d3.json("data/data2.json").then(function (data) {
  properties = getProperties(data, true);
  markers = data.flatMap((c) => {
    const { properties: comuneProperties, ...comune } = c;
    //update comuni list
    comuni.push(c);
    return Object.entries(comuneProperties).map(([key, value]) => ({
      ...comune,
      property: key,
      value,
    }));
  });

  //PROPERTIES CIRCLES
  markersLayer = svg
    .insert("g")
    .selectAll(".marker")
    .data(markers)
    .enter()
    .insert("circle")
    .attr("cx", (m) => projection([m.lon, m.lat])[0])
    .attr("cy", (m) => projection([m.lon, m.lat])[1])
    .attr("class", "marker")
    .style("fill", (m) => properties[m.property].color)
    .style("opacity", 0);

  //FILTERS
  filters
    .append("div")
    .attr("class", "filters-wrapper")
    .selectAll("div")
    .data(getProperties(data))
    .enter()
    .append("div")
    .attr("class", "item-filter")
    .html(
      (p) =>
        `<span class='pin-color' style="background-color: ${p.color}"></span><span class="filter-name">${p.property}</span>`
    )
    .on("click", function (f) {
      const element = d3.select(this);
      if (activeFilters[f.property]) {
        delete activeFilters[f.property];
        element.classed("active", false);
      } else {
        activeFilters[f.property] = { ...f };
        element.classed("active", true);
      }
      const parent = d3.select(this.parentNode);
      if (Object.keys(activeFilters).length === MAX_FILTERS) {
        parent.classed("disabled", true);
      } else {
        parent.classed("disabled", false);
      }
      renderBubbles();
    });

  //COMUNI CIRCLES
  setTimeout(() => {
    comuniLayer = svg
      .append("g")
      .raise()
      .selectAll(".comune")
      .data(comuni)
      .enter()
      .append("circle")
      .attr("cx", (c) => projection([c.lon, c.lat])[0])
      .attr("cy", (c) => projection([c.lon, c.lat])[1])
      .attr("r", COMUNI_R)
      .attr("class", "comune")
      .style("fill", "#000")
      .style("opacity", 0.3)
      .on("mouseover", function (c) {
        tooltip
          .html(
            `<strong>${c.name}</strong>${Object.entries(activeFilters)
              .map(
                ([k, v]) =>
                  `<li><span style="color:${v.color}">${k}</span>: ${c.properties[k]}</li>`
              )
              .join("")}`
          )
          .transition()
          .duration(500)
          .style("opacity", 1)
          .style("visibility", "visible");
      })
      .on("mousemove", function (event) {
        tooltip.style(
          "transform",
          `translate(${d3.event.clientX + 15}px, ${d3.event.clientY - 15}px)`
        );
      })
      .on("mouseleave", function (e, el) {
        console.log(e, el);
        tooltip
          .transition()
          .duration(500)
          .style("opacity", 0)
          .style("visibility", "hidden");
      });
  }, 100);
});

function renderBubbles() {
  const actives = markersLayer
    .filter((m) => activeFilters[m.property])
    .transition()
    .duration(1000)
    .style("opacity", 0.5)
    .attr("r", (m) => getRadius(m.value, m.property));
  const hidden = markersLayer
    .filter((m) => !activeFilters[m.property])
    .transition()
    .duration(1000)
    .style("opacity", 0)
    .attr("r", 0);
}
