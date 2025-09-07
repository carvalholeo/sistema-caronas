import CarpoolApp from './app';
import logger from 'utils/logger';

const app = new CarpoolApp();

app.listen();

process.on('SIGINT', () => {
    logger.warn('SIGINT received (Ctrl+C)');
    app.shutdown(0);
});

process.on('SIGTERM', () => {
    logger.warn('SIGTERM received (system shutdown)');
    app.shutdown(0);
});

process.on('SIGHUP', async () => {
    logger.info('SIGHUP received (reload). Restarting app...');
    try {
        await app.reload();
        logger.info('App reloaded successfully');
    } catch (err) {
        logger.error('Unexpected error during reload:', err);
        logger.warn('Keeping current instance running.');
    }
});
