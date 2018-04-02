exports.filteringReporter = function (next, { filter }) {
  let ignoreStack = false;
  return {
    startSuite(name) {
      next.startSuite(name);
    },
    pass(message) {
      if (filter.test(message)) {
        next.pass(message);
      } else if (next.skip) {
        next.skip(message);
      }
    },
    fail(message) {
      if (filter.test(message)) {
        next.fail(message);
      } else {
        ignoreStack = true;
        if (next.skip) {
          next.skip(message);
        }
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

exports.countingReporter = function (next) {
  let counts = { pass: 0, fail: 0, skip: 0 };
  return {
    counts,
    startSuite(name) {
      next.startSuite(name);
    },
    pass(message) {
      counts.pass++;
      next.pass(message);
    },
    fail(message) {
      counts.fail++;
      next.fail(message);
    },
    skip(message) {
      counts.skip++;
      if (next.skip) {
        next.skip(message);
      }
    },
    reportStack(stack) {
      next.reportStack(stack);
    }
  };
};
