// Load configuration
let _config = WS.call("GET","config.json", [], false, false, false, null, "./");

// Get RabbitMq exchanges, queues and bindings
let rabbitinfos = {
    exchanges:WS.call("GET","/exchanges", [], false, false, false, _config.rabbitUsername+":"+_config.rabbitPassword, _config.baseApiUrl).filter(c=>c.name!=""),
    queues:WS.call("GET","/queues", [], false, false, false, _config.rabbitUsername+":"+_config.rabbitPassword, _config.baseApiUrl),
    bindings:WS.call("GET","/bindings", [], false, false, false, _config.rabbitUsername+":"+_config.rabbitPassword, _config.baseApiUrl),
};
// Get RabbitMq consumers
let consumers = WS.call("GET","/consumers", [], false, false, false, _config.rabbitUsername+":"+_config.rabbitPassword, _config.baseApiUrl);
// Get RabbitMq policies
let policies = WS.call("GET","/policies", [], false, false, false, _config.rabbitUsername+":"+_config.rabbitPassword, _config.baseApiUrl);


let echangealternatesFromPolicies = policies.filter(policy=>policy.definition["alternate-exchange"])
    .map(policy=>rabbitinfos.exchanges
        .filter(c=>new RegExp(policy.pattern).test(c.name))
        .map(c=>([c,rabbitinfos.exchanges.find(ex=>ex.name==policy.definition["alternate-exchange"]),policy.name]))).flat(1)

let echangedeadletterFromPolicies = policies.filter(policy=>policy.definition["dead-letter-exchange"])
    .map(policy=>rabbitinfos.exchanges
        .filter(c=>new RegExp(policy.pattern).test(c.name))
        .map(c=>([c,rabbitinfos.exchanges.find(ex=>ex.name==policy.definition["dead-letter-exchange"]),policy.name]))).flat(1)

let makeUniqueByKey=(key,array)=>[...new Map(array.map(c=>[c[key],c])).values()]
// Method that convert the consumer name to a string
let toConsumerName=c=>c.channel_details.peer_host+":"+c.channel_details.peer_port;
// Method that return the bindings count for exchanges
let getBindingsCountExchangeFromBindings=c=>rabbitinfos.bindings.filter(binding=>binding.source==c.name).length;
let getBindingsCountExchangeFromPolicies=c=>[...new Map([...echangealternatesFromPolicies,...echangedeadletterFromPolicies].filter(x=>x[0].name == c.name).map(x=>[x[1].name,x[1]])).values()].length
let getBindingsCountExchange=c=>getBindingsCountExchangeFromBindings(c)+getBindingsCountExchangeFromPolicies(c)
// Method that return the bindings count for queues
let getBindingsCountQueueFromBindings=c=>rabbitinfos.bindings.filter(binding=>binding.destination==c.name).length;
let getBindingsCountQueueFromConsumers=c=>consumers.filter(consumer=>consumer.queue.name==c.name).length;
let getBindingsCountQueue=c=>getBindingsCountQueueFromBindings(c)+getBindingsCountQueueFromConsumers(c)
// Transform data to an object readable for graph d3js
let nodeindex=1;
json = {
  nodes:makeUniqueByKey('name',[
    ...[...new Map(rabbitinfos.bindings
        .map(binding=>([...rabbitinfos.exchanges.filter(e=>e.name == binding.source).map(e=>({...e,type:"e"})),...rabbitinfos.queues.filter(q=>q.name == binding.destination)]))
        .flat(1).map(c=>[c.name, c])).values()]
          .filter(c=>c.type!="e" || [...new Map([...echangealternatesFromPolicies,...echangedeadletterFromPolicies].map(c=>[c[1].name,c[1]])).values()].find(x=>x.name==c.name)==null)
          .map(u=>u?({ id: nodeindex++, name: u.name, color:u.type=="e"?1:0 }):0).filter(u=>u!=0),
    ...[...new Map(echangealternatesFromPolicies.map(c=>[c[1].name,c[1]])).values()].map(c=>({ id: nodeindex++, name: c.name, color:3 })),
    ...[...new Map(echangedeadletterFromPolicies.map(c=>[c[1].name,c[1]])).values()].map(c=>({ id: nodeindex++, name: c.name, color:4 })),
    ...rabbitinfos.exchanges.filter(c=>getBindingsCountExchangeFromPolicies(c)>0).map(c=>({ id:nodeindex++, name: c.name, color:1 })),
    ...rabbitinfos.queues.filter(c=>getBindingsCountQueueFromConsumers(c)>0).map(c=>({ id:nodeindex++, name: c.name, color:0 })),
    ...consumers.map(c=>({ id:nodeindex++, name: toConsumerName(c), color:2 })),
    ...rabbitinfos.exchanges.filter(c=>getBindingsCountExchange(c)==0).map(c=>({ id:nodeindex++, name: c.name, color:1, alone:true })),
    ...rabbitinfos.queues.filter(c=>getBindingsCountQueue(c)==0).map(c=>({ id:nodeindex++, name: c.name, color:0, alone:true }))
  ])
}
json.links=[
  ...rabbitinfos.bindings.filter(c=>c.source!="").map(c=>({ source: json.nodes.find(x=>x.name==c.source).id, target: json.nodes.find(x=>x.name==c.destination).id, type:c.routing_key, color:0 })),
  ...consumers.map(c=>({ source: json.nodes.find(x=>x.name==c.queue.name).id, target: json.nodes.find(x=>x.name==toConsumerName(c)).id, type:c.consumer_tag, color:1 })),
  ...echangealternatesFromPolicies.map(c=>({ source: json.nodes.find(x=>x.name==c[0].name).id, target: json.nodes.find(x=>x.name==c[1].name).id, type:c[2], color:2 })),
  ...echangedeadletterFromPolicies.map(c=>({ source: json.nodes.find(x=>x.name==c[0].name).id, target: json.nodes.find(x=>x.name==c[1].name).id, type:c[2], color:3 })),
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
for (let num = 0; num < _config.linkscolorscheme.length; num++) {
    svg.append("defs").append("marker")
        .attr("id", "arrowheadcolor"+num)
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 7.75)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 50/_config.linkstrokewidth)
        .attr("markerHeight", 50/_config.linkstrokewidth)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-1 L 2 ,0 L 0,1")
        .attr("fill", _config.linkscolorscheme[num])
        .style("stroke", "none")
}


var linksContainer = svg.append("g").attr("class", linksContainer)
var nodesContainer = svg.append("g").attr("class", nodesContainer)

// Add force simulated by d3js to push out object from others
var force = d3.forceSimulation()
    .force("link", d3.forceLink().id(function (d) {
        return d.id
    }).distance(_config.linkSizeStart))
    .force("charge", d3.forceManyBody().strength(-15))
    .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
    .force("collision", d3.forceCollide().radius(40))

// Grow link size after delay
setTimeout(()=>{
  force.force("link", d3.forceLink().id(function (d) {
      return d.id
  }).distance(_config.linkSizeAfter))
  force.alphaTarget(1).restart();
  setTimeout(()=>{
    force.alphaTarget(0).restart()
  },300);
},500);

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
        .attr('marker-end', d=>'url(#arrowheadcolor'+d.color+')')
        .style("display", "block")
        .style("stroke", d=>_config.linkscolorscheme[d.color])
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
        .attr("fill", d=>_config.linkscolorscheme[d.color])
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
        .style("opacity", (d)=>d.alone?_config.nodeOpacityNoBinding:_config.nodeOpacityWithBindings)
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
        .attr("font-size", _config.nodeTextOuterBubbleSize)
        .attr("fill", _config.nodeTextOuterBubbleColor)
        .attr("pointer-events", "none")
        .attr("dy", "-1em")
        .text(function (d) {
            return d.name
        })
    node.append("text")
        .attr("dominant-baseline", "central")
        .attr("text-anchor", "middle")
        .attr("font-size", _config.nodeTextInsideBubbleSize)
        .attr("fill", _config.nodeTextInsideBubbleColor)
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