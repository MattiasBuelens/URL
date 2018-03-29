exports.filteringReporter = function (next, { filter }) {
  let ignoreStack = false;
  return {
    startSuite(name) {
      next.startSuite(name);
    },
    pass(message) {
      if (filter.test(message)) {
        next.pass(message);
      }
    },
    fail(message) {
      if (filter.test(message)) {
        next.fail(message);
      } else {
        ignoreStack = true;
      }
    },
    reportStack(stack) {
      if (ignoreStack) {
        ignoreStack = false;
      } else {
        next.reportStack(stack);
      }
    }
  };
};
