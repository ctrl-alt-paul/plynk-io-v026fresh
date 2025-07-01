
const fs = require('fs').promises;
const path = require('path');

/**
 * Writes logs to a timestamped file in the log directory
 * @param {Array} logs - Array of log entries to write
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function writeLogsToFile(logs) {
  try {
    // Create log directory if it doesn't exist
    const logDir = path.join(process.cwd(), 'log');
    await fs.mkdir(logDir, { recursive: true });

    // Generate timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const fileName = `log-export-${timestamp}.txt`;
    const filePath = path.join(logDir, fileName);

    // Format logs for file output
    const formattedLogs = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      let output = `[${timestamp}] ${log.category.toUpperCase()}:\n`;
      output += log.description;
      
      if (log.data && typeof log.data === 'object') {
        output += '\n' + JSON.stringify(log.data, null, 2);
      }
      
      return output;
    }).join('\n\n');

    // Write to file
    await fs.writeFile(filePath, formattedLogs, 'utf8');

    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to write logs to file'
    };
  }
}

module.exports = {
  writeLogsToFile
};
