import { select, json, csv, geoPath, geoMercator } from 'd3';
import { feature } from 'topojson';

const svg = select('svg');
const pathGenerator = geoPath().projection(geoMercator());  // sets the path generator 

// file names
const regions = "regions.csv",
      deaths = "countryDeaths.json",
      map = "map.json";

const toTitleCase = str => {
  return str.replace(
    /\w\S*/g,
    function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

// Everything that comes to rendering
Promise.all([csv(regions), json(deaths), json(map)])
	.then(values => {

    document.getElementsByClassName("container-mapSide__loading-text")[0].style.fill = "white";
  	
  	// constants based on values from promises
  	const regions = values[0],
          deaths = values[1],
          map = values[2];
  
  	let deathsPD = {};
  	
  	const deathsPY_regions = deaths["deathsPY_regions"];
  	const deathsPY = deaths["deaths_every_year"];
  
  	let isDescChangeable = true;
  	let justClickedMap = false;
  	let currentYear = "Total";
  
  	// change the opacity from the path elements
    const blurElements = d => {
      d3.selectAll(".department")
        .attr("transition", 2)
        .attr("opacity", 0.5);
      d3.select("#" + d.properties.DPTO_CNMBR.replaceAll(" ", "_"))
        .attr("transition", 2)
        .attr("opacity", 1);

      d3.select(".container-descSide__p-departmentName")
        .text(toTitleCase(d.properties.DPTO_CNMBR + " (" + currentYear + ")"));

      d3.select(".container-descSide__p-totalDeaths")
        .text(() => {
        	if (deathsPY_regions[currentYear][toTitleCase(d.properties.DPTO_CNMBR)] == undefined) { return "There were no deaths in this department for the time you are selecting."; }
          return "Deaths: " + deathsPY_regions[currentYear][toTitleCase(d.properties.DPTO_CNMBR)];
        });
    };
      

    // change the opacity back
    const unblurElements = () => {
      d3.selectAll(".department")
      .attr("opacity", 1);

      d3.select(".container-descSide__p-departmentName")
      .text("Colombia (" + currentYear + ")")
      
      d3.select(".container-descSide__p-totalDeaths")
        .text(d => {
          	return "Deaths: " + deathsPY[currentYear];
        });
      }
    
  
  	// filling the deaths per department object
    for (let i = 0; i < regions.length; i++) {
      if (regions[i].departamento.toUpperCase() in deathsPD) {
        deathsPD[regions[i].departamento.toUpperCase()] += 1;
      } else {
      	deathsPD[regions[i].departamento.toUpperCase()] = 1;
      }
    }
  
  	// COLOR FOR THE MAP
  	const noDeathsColor = "#ffc";
  	const scale = [0, 5, 10, 20, 30, 40, 50];
    // creating the color scale based on the deathsPD numbers
    const colorScaleTotal = d3.scaleThreshold()
      .domain(scale)
      .range(d3.schemeOrRd[7]);

  
    // returning the colors based on the color scale and the dataset
    const colorMapForTotal = (d) => {
      let ret = 0;
      if (d.properties.DPTO_CNMBR in deathsPD) {
        ret = deathsPD[d.properties.DPTO_CNMBR];
        return colorScaleTotal(ret);
      }
      return noDeathsColor;
    };
  
  
  	// generating the map
  	const dpts = feature(map, map.objects.MGN_ANM_DPTOS);  // data to topojson
  	svg.selectAll("path")
      .data(dpts.features)
  		.enter().append("path")
  			.attr("id", d => {
   				return d.properties.DPTO_CNMBR.replaceAll(" ", "_");
    		})
        .attr("class", "department")
        .attr("d", pathGenerator)
  			// dynamicly setting colors for the map
  			.attr("fill", (d) => {
      		return colorMapForTotal(d);  // SETTING THE COLOR FOR THE MAP
   			})
  
  			// mouse stuff
        .on("mouseover", (d) => {
      		if (isDescChangeable == true) {
            blurElements(d);
          }
    		})
  			.on("mouseleave", (d) => {
      		if (isDescChangeable == true) {
            unblurElements(d);
          }
        })
  
  			// for "selecting" a department
  			.on("click", (d) => {
      		if (isDescChangeable != true) {
            blurElements(d);
          }
      		isDescChangeable = false;
      		justClickedMap = true;
    		});

  	// for unselecting, and i hope you like this because it was fucking horrendous to implement, im saying it literally while crying
  	svg.on("click", () => {
      if (isDescChangeable == false && justClickedMap == false) {
        
        unblurElements();
        isDescChangeable = true;
      
      }
      justClickedMap = false;
    });
  
  	// COLOR FOR THE UNORDERED LIST ITEMS
  	// a function for the color scale oriented to the ul element
    let colorCSS = (index) => {
        return "background:" + colorScaleTotal(scale[index]) + ";";
    };
  
  	// RETURNING THE COLORS THAT THE CALLER FUNCTION NEEDS FOR CHANGING THE YEAR
  	const colorMapForYears = year => {
      
      d3.selectAll(".department")
      	.attr("fill", (d) => {
        	if (year != "Total") {
            if (deathsPY_regions[year][toTitleCase(d.properties.DPTO_CNMBR)] == undefined) {
              return noDeathsColor;
            }
            return colorScaleTotal(deathsPY_regions[year][toTitleCase(d.properties.DPTO_CNMBR)]);
          }
      		return colorMapForTotal(d);
      });
    };
  
  	let index = 0;
  	// for changing the background colors from the list items
    d3.selectAll("li")._groups[0]  // had to do it manually, douh
      .forEach((e) => {
      		e.setAttribute("style", colorCSS(index));  // old js stuff, here
      		e.addEventListener("click", (e) => {
       			  isDescChangeable = true;
            	currentYear = e.target.innerText;
            	colorMapForYears(e.target.innerText);
            	unblurElements();
          	});
      	index++;
    });
  	
  	
  	// RENDERING THE LEGEND FOR THE MAP
  	// creating the g objects featured by the data method
  	const legends = svg.append("g")
	  	.attr("transform", "translate(100,130)")
      .selectAll(".legends")
      .data(colorScaleTotal.domain());
  
  	const legend = legends.enter().append("g").classed(".legends",true)
  	.attr("transform", (d,i)=>{
      return `translate(0,${(i+1)*25})`;
    });
  
  	  //redering legend colors to pie chart 
    legend.append("rect").attr("width",10).attr("height",10)
      .attr("fill", d => { 
      	if (d != 0) {
          return colorScaleTotal(d)
        }
      	return noDeathsColor;
    	});

    //Redering legends brands text  
    legend.append("text")
      .attr("x", 25)
      .attr("y", 10)
      .text(d => {return d});
  
  	// title number of deaths
  	svg.append("g")
      .attr("transform", "translate(85,200)")
  		.selectAll(".legendsTitle").data("Number Of Deaths")
      .enter()
      .append("g")
  		.append("text").attr("transform", "rotate(-90 50 50)").text("Number Of Deaths");
  
  });
