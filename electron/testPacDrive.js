const { initialize, shutdown } = require('./devices/pacDriveController');
const { dispatchPacDriveOutput } = require('./devices/pacDriveDispatcher');

(async () => {
  try {
    //console.log('🟡 Initializing PacDrive...');
    const initResult = initialize();
    //console.log('✅ Init result:', initResult);

    //console.log('🔵 Turning ON outputs 0, 1, and 2...');
    dispatchPacDriveOutput(0, [0, 1, 2], 1); // Turn ON outputs

    await new Promise(res => setTimeout(res, 2000)); // wait 2s

    //console.log('🔴 Turning OFF outputs 0, 1, and 2...');
    dispatchPacDriveOutput(0, [0, 1, 2], 0); // Turn OFF outputs

    //console.log('🟣 Shutting down PacDrive...');
    const shutdownResult = shutdown();
    //console.log('✅ Shutdown result:', shutdownResult);
  } catch (err) {
    //console.error('❌ Error during PacDrive test:', err);
  }
})();