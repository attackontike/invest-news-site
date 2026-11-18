const fs = require('fs');
function run(file, nodes, input) {
  const $ = (name) => {
    const v = nodes[name];
    if (!v) throw new Error('no node ' + name);
    return { all: () => v, first: () => v[0], item: v[0] };
  };
  const $input = { all: () => input || [], first: () => (input || [])[0] };
  return new Function('$', '$input', fs.readFileSync(file, 'utf8'))($, $input);
}
module.exports = { run };
