
function evaluateScript(value, script, label) {
  if (!script) return value;
  
  try {
    // Handle null/undefined values by replacing with 0
    if (value === null || value === undefined) {
      value = 0;
    }
    
    // Convert BigInt to Number if needed before evaluation
    if (typeof value === 'bigint') {
      value = Number(value);
    }
    
    // Ensure value is a number if possible
    if (typeof value === 'string' && !isNaN(Number(value))) {
      value = Number(value);
    }
    
    // Ensure we have a valid numeric value to work with
    if (typeof value !== 'number' && typeof value !== 'bigint') {
      value = 0;
    }
    
    // Create a safe evaluation context
    const fn = new Function('value', `return ${script};`);
    const result = fn(value);
    
    // Handle null/undefined result values
    if (result === null || result === undefined) {
      return 0;
    }
    
    // Ensure we got a number back
    const finalValue = Number(result);
    if (isNaN(finalValue)) {
      return 0;
    }
    
    return finalValue;
  } catch (err) {
    // Return 0 instead of the original value if there was an error
    return 0;
  }
}

module.exports = {
  evaluateScript
};
