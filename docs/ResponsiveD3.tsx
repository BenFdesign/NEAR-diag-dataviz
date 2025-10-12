import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const LineChart = ({ Data, data_type }) => {
  // Element References
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const svgContainer = useRef(null); // The PARENT of the SVG 

  // State to track width and height of SVG Container
  const [width, setWidth] = useState();
  const [height, setHeight] = useState();

  // This function calculates width and height of the container
  const getSvgContainerSize = () => {
    const newWidth = svgContainer.current.clientWidth;
    setWidth(newWidth);

    const newHeight = svgContainer.current.clientHeight;
    setHeight(newHeight);
  };

  useEffect(() => {
    // detect 'width' and 'height' on render
    getSvgContainerSize();
    // listen for resize changes, and detect dimensions again when they change
    window.addEventListener("resize", getSvgContainerSize);
    // cleanup event listener
    return () => window.removeEventListener("resize", getSvgContainerSize);
  }, []);