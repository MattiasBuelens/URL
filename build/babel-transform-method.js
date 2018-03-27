const path = require('path');
const process = require('process');

module.exports = function ({types: t}) {
  return {
    visitor: {
      CallExpression(p, state) {
        const node = p.node;
        const callee = node.callee;
        if (!t.isMemberExpression(callee) || callee.computed) {
          return;
        }

        const property = callee.property;
        if (!Object.prototype.hasOwnProperty.call(state.opts, property.name)) {
          return;
        }
        p.replaceWith(
            t.callExpression(
                state.addImport(path.resolve(process.cwd(), state.opts[property.name]), 'default', property.name),
                [
                  callee.object,
                  ...node.arguments
                ]
            )
        );
      }
    }
  };
};
