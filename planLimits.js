// planLimits.js

module.exports = {
  free: {
    maxForms: 1,
    maxResponsesPerForm: 50,
  },
  Starter: {
    maxForms: 3,
    maxResponsesPerForm: 10,
  },
  Pro: {
    maxForms: 10,
    maxResponsesPerForm: 1000,
  },
  Business: {
    maxForms: Infinity, 
    maxResponsesPerForm: Infinity,
  }
};
