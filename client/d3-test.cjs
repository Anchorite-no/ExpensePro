const d3Force = require('d3-force');
const initNodes = [{ id: 'a', count: 1 }];
const initLinks = [{ source: 'a', target: 'b', weight: 1 }];
try {
  d3Force.forceSimulation(initNodes).force("link", d3Force.forceLink(initLinks).id(d => d.id));
} catch(e) {
  console.log(e.stack);
}
