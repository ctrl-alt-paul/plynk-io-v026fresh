const { evaluateScript } = require('./scriptEvaluator');
const { logEvent } = require('./loggerBridge');
const { dispatchMemoryValues } = require('./gameProfileDispatcher');

/**
 * Extract the actual value from a memory result object
 * This normalizes data between process monitor and memory manager
 */
function extractMemoryValue(resultObj) {
  // Check for null/undefined first and return 0 instead
  if (resultObj === null || resultObj === undefined) {
    return 0;
  }
  
  // If it's already a primitive value, return it
  if (resultObj !== null && typeof resultObj !== 'object') {
    // Handle BigInt type specially - convert to Number
    if (typeof resultObj === 'bigint') {
      const numValue = Number(resultObj);
      return numValue;
    }
    
    // If it's already a number, just return it
    if (typeof resultObj === 'number') {
      return resultObj;
    }
    
    return resultObj;
  }
  
  // Handle object types
  if (resultObj !== null && typeof resultObj === 'object' && !(resultObj instanceof Date)) {
    // Check if the value property exists
    if ('value' in resultObj) {
      const extractedValue = resultObj.value;
      
      // Handle null/undefined values in the value property
      if (extractedValue === null || extractedValue === undefined) {
        return 0;
      }
      
      // Handle BigInt type specially - convert to Number
      if (typeof extractedValue === 'bigint') {
        const numValue = Number(extractedValue);
        return numValue;
      }
      
      return extractedValue;
    }
    
    // Check for success field which might indicate a memory read result
    if ('success' in resultObj) {
      const isSuccess = Boolean(resultObj.success);
      
      // Memory read result - handle differently based on success
      if (isSuccess && 'value' in resultObj) {
        // Already handled above in 'value' in resultObj
      } else {
        // If memory read failed, return 0 to ensure we have a number
        logEvent('warning', `Memory read failed, returning 0`);
        return 0;
      }
    }
    
    // Specific check for RPM values
    if ('id' in resultObj && resultObj.id && typeof resultObj.id === 'string' && 
        resultObj.id.includes('RPM') && 'value' in resultObj) {
      // Ensure we return a number for RPM, not null
      if (resultObj.value === null || resultObj.value === undefined) {
        logEvent('warning', `RPM value is null/undefined, returning 0`);
        return 0;
      }
    }
  }
  
  // Otherwise return the original object, but if it's null, return 0
  return resultObj || 0;
}

function evaluateFormat(format, value) {
  // Handle null/undefined values before formatting
  if (value === null || value === undefined) {
    value = 0;
  }
  
  if (!format || format === '') return value.toString();
  
  try {
    // Check for decimal formatting patterns first (e.g., "0", "0.00", "0.0000")
    const decimalPattern = /^0(\.0+)?$/;
    if (decimalPattern.test(format.trim())) {
      const numericValue = Number(value);
      if (!isNaN(numericValue)) {
        // Count decimal places in the format string
        const decimalMatch = format.match(/\.0+/);
        if (decimalMatch) {
          const decimalPlaces = decimalMatch[0].length - 1; // Subtract 1 for the dot
          return numericValue.toFixed(decimalPlaces);
        } else {
          // Format is just "0", so return whole number
          return Math.round(numericValue).toString();
        }
      }
      return value.toString();
    }
    
    // Simple string replacement for {value}
    if (format.includes('{value}')) {
      const result = format.replace('{value}', value.toString());
      return result;
    }
    
    // More complex expression evaluation
    if (format.includes('{') && format.includes('}')) {
      const expressionMatch = format.match(/{([^}]+)}/);
      if (expressionMatch && expressionMatch[1]) {
        const expression = expressionMatch[1].trim();
        const evalFn = new Function('value', `return ${expression}`);
        const result = evalFn(value);
        
        const finalResult = format.replace(/{([^}]+)}/, result);
        return finalResult;
      }
    }
    
    return format;
  } catch (err) {
    logEvent('warning', `Error formatting value ${value}: ${err.message}`);
    return value.toString();
  }
}

/**
 * Build the address string for display in logs
 */
function buildAddressString(output) {
  if (output.useModuleOffset && output.moduleName && output.offset) {
    let addressStr = `${output.moduleName}+${output.offset}`;
    
    // Add bitmask information if present
    if (output.bitmask && output.bitmask.trim() !== '') {
      addressStr += ` [${output.bitmask}]`;
    }
    
    return addressStr;
  } else if (output.address) {
    let addressStr = output.address;
    
    // Add bitmask information if present
    if (output.bitmask && output.bitmask.trim() !== '') {
      addressStr += ` [${output.bitmask}]`;
    }
    
    return addressStr;
  }
  
  return 'Unknown Address';
}

/**
 * Handle message-based output processing with formatting and script evaluation
 * This function works exactly like memory outputs but for message inputs
 * @param {string} key - The message output key
 * @param {any} value - The raw message value
 * @param {Object} gameProfile - The active game profile
 * @returns {Promise<Object>} Processed output result
 */
async function handleMessageUpdate(key, value, gameProfile) {
  if (!gameProfile?.outputs || !Array.isArray(gameProfile.outputs)) {
    return null;
  }

  // Find the game profile output that matches this message key
  const gameOutput = gameProfile.outputs.find(output => 
    output.key === key && output.isActive !== false
  );
  
  if (!gameOutput) {
    logEvent('debug', `No active game profile output found for message key '${key}'`);
    return null;
  }

  // Create a single formatted log for message processing
  let formattedBlock = `--- Message Processing ---\n\n`;
  formattedBlock += `Message Input:\n`;
  formattedBlock += `  Key: ${key}\n`;
  formattedBlock += `  Label: ${gameOutput.label}\n`;
  formattedBlock += `  Raw Value: ${value ?? 0}\n\n`;

  let rawValue = value;
  
  // Ensure we have a numeric value for outputs, not null/undefined
  if (rawValue === undefined || rawValue === null) {
    rawValue = 0;
  }

  if (!gameOutput.device || gameOutput.device === 'none') {
    logEvent('debug', `No device configured for message output '${gameOutput.label}'`);
    return null;
  }

  let processedValue = rawValue;
  let formatString = '';
  let scriptString = '';
  let inverted = false;
  
  // Process script (same as memory outputs)
  if (gameOutput.script) {
    try {
      processedValue = evaluateScript(rawValue, gameOutput.script, gameOutput.label);
      scriptString = gameOutput.script;
    } catch (error) {
      logEvent('warning', `Script error for message ${gameOutput.label}: ${error.message}`);
      // Don't stop processing - use original value
      processedValue = rawValue;
    }
  }
  
  // Handle invert (same as memory outputs)
  if (gameOutput.invert) {
    processedValue = processedValue === 0 ? 1 : (processedValue === 1 ? 0 : processedValue);
    inverted = true;
  }
  
  // Apply format (same as memory outputs)
  if (gameOutput.format) {
    try {
      processedValue = evaluateFormat(gameOutput.format, processedValue);
      formatString = gameOutput.format;
    } catch (error) {
      logEvent('warning', `Format error for message ${gameOutput.label}: ${error.message}`);
      // Don't stop processing - convert to string
      processedValue = String(processedValue);
    }
  }

  const processedOutput = {
    label: gameOutput.label,
    device: gameOutput.device,
    channel: gameOutput.channel,
    value: processedValue,
    format: formatString || '',
    script: scriptString || '',
    inverted: inverted ? 'Yes' : 'No'
  };
  
  // Format output section
  formattedBlock += 'Message Output:\n';
  let line = `• ${processedOutput.label} → ${processedOutput.device} Ch${processedOutput.channel} = ${processedOutput.value ?? 0}`;
  if (processedOutput.format) line += ` (Format: ${processedOutput.format})`;
  if (processedOutput.script) line += ` (Script: ${processedOutput.script})`;
  if (processedOutput.inverted === 'Yes') line += ' (Inv)';
  formattedBlock += line + '\n';

  // Log the complete formatted block
  logEvent('message', formattedBlock);

  // Create a processed memory values object for device dispatch using the SAME system as memory
  const processedMemoryValues = {
    [processedOutput.label]: processedOutput.value
  };

  // Dispatch the processed values to output devices using the EXACT SAME system as memory
  try {
    const dispatchResults = await dispatchMemoryValues(gameProfile, processedMemoryValues);
    
    // Log dispatch results for messages
    if (dispatchResults.length > 0) {
      const result = dispatchResults.find(r => r.label === processedOutput.label);
      if (result) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        const errorInfo = result.error ? ` (${result.error})` : '';
        logEvent('dispatch', `Message key '${key}' dispatched to ${result.device} Ch${result.channel} = ${result.value} - ${status}${errorInfo}`);
      }
    }
    
    return processedOutput;
  } catch (error) {
    logEvent('warning', `Dispatch error for message key '${key}': ${error.message || String(error)}`);
    return null;
  }
}

async function handleUpdate(gameProfile, memoryValues) {
  if (!gameProfile?.outputs || !Array.isArray(gameProfile.outputs)) {
    return;
  }
  
  // Create a single formatted block for both logs
  let formattedBlock = '--- Poll Cycle ---\n\n';
  
  // Extract actual values from memory result objects before processing
  const extractedMemoryValues = {};
  Object.entries(memoryValues).forEach(([label, value]) => {
    const extractedValue = extractMemoryValue(value);
    extractedMemoryValues[label] = extractedValue;
  });
  
  // Build consolidated memory scanning log
  let memoryScanningLog = 'MEMORY SCANNING LOGS\n';
  
  // Iterate through game profile outputs to get address information
  gameProfile.outputs.forEach(output => {
    const { label } = output;
    const value = extractedMemoryValues[label];
    const addressStr = buildAddressString(output);
    
    // Only log if we have a value for this output
    if (value !== undefined && value !== null) {
      memoryScanningLog += `${label} - ${addressStr} - value: ${value}\n`;
    }
  });
  
  // Log the consolidated memory scanning information
  logEvent('memory', memoryScanningLog);
  
  // Format inputs section with extracted values
  formattedBlock += 'Inputs:\n';
  Object.entries(extractedMemoryValues).forEach(([label, value]) => {
    formattedBlock += `  ${label}: ${value ?? 0}\n`;  // Use 0 instead of "-" for null values
  });
  formattedBlock += '\n';
  
  const processedOutputs = [];
  
  // Process all outputs with extracted values
  for (const output of gameProfile.outputs) {
    const { label, device, channel, format, script, invert } = output;
    
    let rawValue = extractedMemoryValues[label];
    
    // Ensure we have a numeric value for outputs, not null/undefined
    if (rawValue === undefined || rawValue === null) {
      rawValue = 0;
    }
    
    if (!device || device === 'none') continue;

    let processedValue = rawValue;
    let formatString = '';
    let scriptString = '';
    let inverted = false;
    
    // Process script
    if (script) {
      try {
        processedValue = evaluateScript(rawValue, script, label);
        scriptString = script;
      } catch (error) {
        logEvent('warning', `Script error for ${label}: ${error.message}`);
        // Don't stop processing - use original value
        processedValue = rawValue;
      }
    }
    
    // Handle invert
    if (invert) {
      processedValue = processedValue === 0 ? 1 : (processedValue === 1 ? 0 : processedValue);
      inverted = true;
    }
    
    // Apply format
    if (format) {
      try {
        processedValue = evaluateFormat(format, processedValue);
        formatString = format;
      } catch (error) {
        logEvent('warning', `Format error for ${label}: ${error.message}`);
        // Don't stop processing - convert to string
        processedValue = String(processedValue);
      }
    }

    processedOutputs.push({
      label,
      device,
      channel,
      value: processedValue,
      format: formatString || '',
      script: scriptString || '',
      inverted: inverted ? 'Yes' : 'No'
    });
  }
  
  // Format outputs section
  formattedBlock += 'Outputs:\n';
  processedOutputs.forEach(output => {
    let line = `• ${output.label} → ${output.device} Ch${output.channel} = ${output.value ?? 0}`; // Use 0 instead of "-"
    if (output.format) line += ` (Format: ${output.format})`;
    if (output.script) line += ` (Script: ${output.script})`;
    if (output.inverted === 'Yes') line += ' (Inv)';
    formattedBlock += line + '\n';
  });

  // Log the complete formatted block
  logEvent('output', formattedBlock);

  // Create a processed memory values object for device dispatch
  const processedMemoryValues = {};
  processedOutputs.forEach(output => {
    processedMemoryValues[output.label] = output.value;
  });

  // Dispatch the processed values to output devices
  try {
    const dispatchResults = await dispatchMemoryValues(gameProfile, processedMemoryValues);
    
    // Log dispatch results
    if (dispatchResults.length > 0) {
      let dispatchLog = '\nDispatch Results:\n';
      dispatchResults.forEach(result => {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        dispatchLog += `• ${result.label} → ${result.device}: ${status}`;
        if (result.error) dispatchLog += ` (${result.error})`;
        dispatchLog += '\n';
      });
      
      logEvent('dispatch', dispatchLog);
    }
  } catch (error) {
    logEvent('warning', `Dispatch error: ${error.message || String(error)}`);
  }

  // Return processed outputs for further use
  return processedOutputs;
}

module.exports = {
  handleUpdate,
  extractMemoryValue,
  handleMessageUpdate
};
