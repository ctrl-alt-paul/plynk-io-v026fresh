
const { logInputsAndOverrides, logOutputs } = require('./logger');

// Test data
const mockInputs = {
  Speed: 30,
  RPM: 5,
  Gear: 1,
  Lap: 1,
  Position: 2
};

const mockOverrides = {
  RPM: 5
};

const mockOutputs = [
  {
    label: 'RPM',
    device: 'Arduino COM4',
    channel: 2,
    value: 10,
    format: '{value * 2}'
  },
  {
    label: 'Gear',
    device: 'Arduino COM4',
    channel: 3,
    value: 1,
    script: 'value > 100 ? 1 : 0'
  }
];

// Test the logger
//console.log('Testing logger...');

// Test inputs and overrides
logInputsAndOverrides(mockInputs, mockOverrides);

// Test outputs
logOutputs(mockOutputs);

//console.log('Logger test complete. Check /log/app.log for results.');
