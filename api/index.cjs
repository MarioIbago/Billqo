'use strict';

module.exports = function billqoBuildPlaceholder(_req, res) {
  res.status(503).json({
    error: {
      code: 'CONFIGURATION_ERROR',
      message: 'Billqo API bundle was not generated during deployment.',
      recoverable: true
    }
  });
};
