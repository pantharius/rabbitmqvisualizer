// Récupération des informations RabbitMq
let rabbitinfos = WS.call("GET","/definitions", [], false, false, false, "rabbitmq:rabbitmq", "http://localhost:15672/api");
// Récupération des consumers RabbitMq
let consumers = WS.call("GET","/consumers", [], false, false, false, "rabbitmq:rabbitmq", "http://localhost:15672/api");

// Load configuration
let _config = WS.call("GET","config.json", [], false, false, false, null, "./");

// Method that convert the consumer name to a string
let toConsumerName=c=>c.consumer_tag + " ("+c.channel_details.peer_host+":"+c.channel_details.peer_port+")";
// Method that return the bindings count for exchanges
let getBindingsCountExchange=c=>rabbitinfos.bindings.filter(binding=>binding.source==c.name).length;
// Method that return the bindings count for queues
let getBindingsCountQueueFromBindings=c=>rabbitinfos.bindings.filter(binding=>binding.destination==c.name).length;
let getBindingsCountQueueFromConsumers=c=>consumers.filter(consumer=>consumer.queue.name==c.name).length;
let getBindingsCountQueue=c=>getBindingsCountQueueFromBindings(c)+getBindingsCountQueueFromConsumers(c)
// Transform data to an object readable for graph d3js
json = {
  nodes:[
    ...rabbitinfos.exchanges.sort((a,b)=>a.name-b.name).map((c,i)=>({ id:i, name: c.name, group: 1, color:1, bindingscount:getBindingsCountExchange(c)})),
    ...rabbitinfos.queues.sort((a,b)=>a.name-b.name).map((c,i)=>({ id:rabbitinfos.exchanges.length+i, name: c.name, group: 0, color:0, bindingscount: getBindingsCountQueue(c)})),
    ...consumers.map((c,i)=>({ id:rabbitinfos.exchanges.length+rabbitinfos.queues.length+i, name: toConsumerName(c), group: 2, color:2, bindingscount:1 }))
  ].sort((a,b)=>b.bindingscount-a.bindingscount)
}
json.links=[
  ...rabbitinfos.bindings.map(c=>({ source: json.nodes.find(x=>x.name==c.source).id, target: json.nodes.find(x=>x.name==c.destination).id, type:c.routing_key, value:1 })),
  ...consumers.map(c=>({ source: json.nodes.find(x=>x.name==c.queue.name).id, target: json.nodes.find(x=>x.name==toConsumerName(c)).id, value:2 }))
]

// output in console the data used
console.log(json);

var svg = d3.select("svg")
    .attr("class", "canvas")
    .attr("width", window.innerWidth)
    .attr("height", window.innerHeight)
    .call(d3.zoom().on("zoom", function (event) {
        svg.attr("transform", event.transform)
    }))
    .append("g")

// Append markers to svg
svg.append("defs").append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "-0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 50)
    .attr("markerHeight", 50)
    .attr("xoverflow", "visible")
    .append("svg:path")
    .attr("d", "M 0,-1 L 2 ,0 L 0,1")
    .attr("fill", "black")
    .style("stroke", "none")

var linksContainer = svg.append("g").attr("class", linksContainer)
var nodesContainer = svg.append("g").attr("class", nodesContainer)

// Add force simulated by d3js to push out object from others
var force = d3.forceSimulation()
    .force("link", d3.forceLink().id(function (d) {
        return d.id
    }).distance(40))
    .force("charge", d3.forceManyBody().strength(-45))
    .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .force("collision", d3.forceCollide().radius(50))

function nodesByTypeAfterForce(nodeId, sieved, type) {

  // Get the links for the node per the type
  const newLinks = json.links
    .filter(link => link.type === type && link.source.id === nodeId);

  // Get the linked nodes to nodeId from the links 
  const newNodes = newLinks
    .map(link => json.nodes.find(newNode => newNode.id === link.target.id));

  // Concatenate new nodes and links
  (sieved.links = sieved.links || []).push(...newLinks);
  (sieved.nodes = sieved.nodes || []).push(...newNodes);

  // Recursively visit linked nodes until exhausted options
  newNodes.forEach(node => nodesByTypeAfterForce(node.id, sieved, type));

  // Return indices relevant nodes and links
  return {
    nodes: sieved.nodes.map(node => node.index),
    links: sieved.links.map(link => link.index)
  };
}

function initialize() {

    link = linksContainer.selectAll(".link")
        .data(json.links)
        .join("line")
        .attr("class", "link")
        .attr('marker-end', 'url(#arrowhead)')
        .style("display", "block")
        .style("stroke", _config.linkstrokecolor)
        .style("stroke-width", _config.linkstrokewidth)

    linkPaths = linksContainer.selectAll(".linkPath")
        .data(json.links)
        .join("path")
        .style("pointer-events", "none")
        .attr("class", "linkPath")
        .attr("fill-opacity", _config.linkopacity)
        .attr("stroke-opacity", _config.linkopacity)
        .attr("id", function (d, i) { return "linkPath" + i })
        .style("display", "block")

    linkLabels = linksContainer.selectAll(".linkLabel")
        .data(json.links)
        .join("text")
        .style("pointer-events", "none")
        .attr("class", "linkLabel")
        .attr("id", function (d, i) { return "linkLabel" + i })
        .attr("font-size", _config.linklabelsize)
        .attr("fill", _config.linklabelcolor)
        .text("")

    linkLabels
        .append("textPath")
        .attr('xlink:href', function (d, i) { return '#linkPath' + i })
        .style("text-anchor", "middle")
        .style("pointer-events", "none")
        .attr("startOffset", "50%")
        .text(function (d) { return d.type })

    node = nodesContainer.selectAll(".node")
        .data(json.nodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
        )

    node.selectAll("circle")
        .data(d => [d])
        .join("circle")
        .attr("r", _config.nodesize)
        .style("opacity", (d)=>d.bindingscount>0?1.0:0.2)
        .style("fill", function (d) { return _config.colorscheme[d.color] })
        .on("mouseenter", mouseEnter)
        .on("mouseleave", mouseLeave)

    node.selectAll("text")
        .data(d => [d])
        .join("text")
        .style("class", "icon")
        .attr("font-family", "FontAwesome")
        .attr("dominant-baseline", "central")
        .attr("text-anchor", "middle")
        .attr("font-size", 20)
        .attr("fill", "black")
        .attr("pointer-events", "none")
        .attr("dy", "-1em")
        .text(function (d) {
            return d.name
        })
    node.append("text")
        .attr("dominant-baseline", "central")
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .attr("fill", "black")
        .attr("pointer-events", "none")
        .attr("dy", "0.5em")
        .text(function (d) {
            return d.id
        })

    force
        .nodes(json.nodes)
        .on("tick", ticked);

    force
        .force("link")
        .links(json.links)
}

function mouseEnter(event, d) {

    // Sub json for the hovered node
    const sieved = nodesByTypeAfterForce(d.id, {nodes: [d]}, "need");
    
    // Fade everything
    node.selectAll("circle").classed('faded', true)
    node.selectAll("circle").classed('highlight', false)
    link.classed('faded', true)
    link.classed('highlight', false)
    linkLabels.classed('faded', true)
    linkLabels.classed('highlight', false)
    node.selectAll("text").classed('faded', true)
    node.selectAll("text").classed('highlight', false)
    
    // Only highlight from sieved
    node.selectAll("circle")
      .filter(node => sieved.nodes.indexOf(node.index) > -1)
      .classed('highlight', true)
    link
      .filter(link => sieved.links.indexOf(link.index) > -1)
      .classed('highlight', true)
    linkLabels
      .filter(link => sieved.links.indexOf(link.index) > -1)
      .classed('highlight', true)
    node.selectAll("text")
      .filter(node => sieved.nodes.indexOf(node.index) > -1)
      .classed('highlight', true)
    
    force.alphaTarget(0.0001).restart()
}

function mouseLeave(event, d) {
    const selNodes = node.selectAll("circle")
    const selLink = link
    const selLinkLabel = linkLabels
    const selText = node.selectAll("text")

    selNodes.classed('faded', false)
    selNodes.classed('highlight', false)
    selLink.classed('faded', false)
    selLink.classed('highlight', false)
    selLinkLabel.classed('faded', false)
    selLinkLabel.classed('highlight', false)
    selText.classed('faded', false)
    selText.classed('highlight', false)
    
    force.restart()
}

function ticked() {
    // Update link positions
    link
        .attr("x1", function (d) {
            return d.source.x;
        })
        .attr("y1", function (d) {
            return d.source.y;
        })
        .attr("x2", function (d) {
            return d.target.x;
        })
        .attr("y2", function (d) {
            return d.target.y;
        });

    // Update node positions
    node
        .attr("transform", function (d) {
            return "translate(" + d.x + ", " + d.y + ")";
        });

    linkPaths.attr('d', function (d) {
        return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y;
    });

    linkLabels.attr('transform', function (d) {
        if (d.target.x < d.source.x) {
            var bbox = this.getBBox();

            rx = bbox.x + bbox.width / 2;
            ry = bbox.y + bbox.height / 2;
            return 'rotate(180 ' + rx + ' ' + ry + ')';
        }
        else {
            return 'rotate(0)';
        }
    });

}

function dragStarted(event, d) {
    if (!event.active) force.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;

    PosX = d.x
    PosY = d.y
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) force.alphaTarget(0);
    d.fx = undefined;
    d.fy = undefined;
}

initialize();