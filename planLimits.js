// planLimits.js

module.exports = {
  free: {
    maxForms: 1,
    maxResponsesPerForm: 50,
  },
  Starter: {
    maxForms: 3,
    maxResponsesPerForm: 300,
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
