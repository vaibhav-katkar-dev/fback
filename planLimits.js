// planLimits.js

module.exports = {
  free: {
    maxForms: 3,
    maxResponsesPerForm: 200,
  },
  Starter: {
    maxForms: 5,
    maxResponsesPerForm: 500,
  },
  Pro: {
    maxForms: 10,
    maxResponsesPerForm: 1000,
  },
  Business: {
    maxForms: 50, 
    maxResponsesPerForm: 10000,
  }
};
