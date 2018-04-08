const path = require('path');
const process = require('process');
const { types: t } = require('@babel/core');
const { addDefault } = require('@babel/helper-module-imports');

module.exports = function () {
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
                addDefault(p, path.resolve(process.cwd(), state.opts[property.name]), { nameHint: property.name }),
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
