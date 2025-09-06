const fs = require('fs');
const path = require('path');

/**
 * Comprehensive logging service for roadmap generation system
 * Handles error logging, monitoring, and performance tracking
 */
class LoggingService {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDirectory();
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLogLevel = this.logLevels.INFO;
    }

    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    /**
     * Format log entry with timestamp and metadata
     */
    formatLogEntry(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...metadata,
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        return JSON.stringify(logEntry, null, 2);
    }

    /**
     * Write log to file
     */
    writeToFile(filename, content) {
        try {
            const filePath = path.join(this.logDir, filename);
            fs.appendFileSync(filePath, content + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Log error messages
     */
    error(message, error = null, metadata = {}) {
        if (this.currentLogLevel >= this.logLevels.ERROR) {
            const errorMetadata = {
                ...metadata,
                error: error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : null
            };
            
            const logEntry = this.formatLogEntry('ERROR', message, errorMetadata);
            this.writeToFile('error.log', logEntry);
            console.error(`[ERROR] ${message}`, error);
        }
    }

    /**
     * Log warning messages
     */
    warn(message, metadata = {}) {
        if (this.currentLogLevel >= this.logLevels.WARN) {
            const logEntry = this.formatLogEntry('WARN', message, metadata);
            this.writeToFile('app.log', logEntry);
            console.warn(`[WARN] ${message}`);
        }
    }

    /**
     * Log info messages
     */
    info(message, metadata = {}) {
        if (this.currentLogLevel >= this.logLevels.INFO) {
            const logEntry = this.formatLogEntry('INFO', message, metadata);
            this.writeToFile('app.log', logEntry);
            console.log(`[INFO] ${message}`);
        }
    }

    /**
     * Log debug messages
     */
    debug(message, metadata = {}) {
        if (this.currentLogLevel >= this.logLevels.DEBUG) {
            const logEntry = this.formatLogEntry('DEBUG', message, metadata);
            this.writeToFile('debug.log', logEntry);
            console.log(`[DEBUG] ${message}`);
        }
    }

    /**
     * Log API requests
     */
    logApiRequest(req, res, duration) {
        const requestLog = {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id || 'anonymous'
        };
        
        this.info('API Request', requestLog);
    }

    /**
     * Log roadmap generation events
     */
    logRoadmapGeneration(userId, targetSkill, status, metadata = {}) {
        const roadmapLog = {
            userId,
            targetSkill,
            status, // 'started', 'completed', 'failed'
            ...metadata
        };
        
        this.info(`Roadmap Generation ${status}`, roadmapLog);
    }

    /**
     * Log skill assessment events
     */
    logSkillAssessment(userId, targetSkill, assessmentResult, metadata = {}) {
        const assessmentLog = {
            userId,
            targetSkill,
            skillsFound: assessmentResult.existingSkills?.length || 0,
            gapsIdentified: assessmentResult.skillGaps?.length || 0,
            ...metadata
        };
        
        this.info('Skill Assessment Completed', assessmentLog);
    }

    /**
     * Log web scraping events
     */
    logWebScraping(source, status, dataCount = 0, metadata = {}) {
        const scrapingLog = {
            source,
            status, // 'started', 'completed', 'failed'
            dataCount,
            ...metadata
        };
        
        this.info(`Web Scraping ${status}`, scrapingLog);
    }

    /**
     * Log AI service interactions
     */
    logAIService(service, operation, status, metadata = {}) {
        const aiLog = {
            service, // 'ollama', 'openrouter'
            operation, // 'skill_assessment', 'roadmap_generation'
            status, // 'started', 'completed', 'failed'
            ...metadata
        };
        
        this.info(`AI Service ${status}`, aiLog);
    }

    /**
     * Log performance metrics
     */
    logPerformance(operation, duration, metadata = {}) {
        const performanceLog = {
            operation,
            duration: `${duration}ms`,
            ...metadata
        };
        
        this.info('Performance Metric', performanceLog);
    }

    /**
     * Log cache operations
     */
    logCache(operation, key, hit = null, metadata = {}) {
        const cacheLog = {
            operation, // 'get', 'set', 'delete', 'clear'
            key,
            hit, // true/false for get operations
            ...metadata
        };
        
        this.debug('Cache Operation', cacheLog);
    }

    /**
     * Log user progress tracking
     */
    logProgressTracking(userId, roadmapId, action, metadata = {}) {
        const progressLog = {
            userId,
            roadmapId,
            action, // 'step_completed', 'milestone_reached', 'streak_updated'
            ...metadata
        };
        
        this.info('Progress Tracking', progressLog);
    }

    /**
     * Set log level
     */
    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.currentLogLevel = this.logLevels[level];
            this.info(`Log level set to ${level}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    /**
     * Get log statistics
     */
    getLogStats() {
        try {
            const stats = {};
            const logFiles = ['error.log', 'app.log', 'debug.log'];
            
            logFiles.forEach(file => {
                const filePath = path.join(this.logDir, file);
                if (fs.existsSync(filePath)) {
                    const stat = fs.statSync(filePath);
                    stats[file] = {
                        size: stat.size,
                        modified: stat.mtime,
                        lines: fs.readFileSync(filePath, 'utf8').split('\n').length - 1
                    };
                }
            });
            
            return stats;
        } catch (error) {
            this.error('Failed to get log statistics', error);
            return {};
        }
    }

    /**
     * Clean old log files
     */
    cleanOldLogs(daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const files = fs.readdirSync(this.logDir);
            let cleanedCount = 0;
            
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            });
            
            this.info(`Cleaned ${cleanedCount} old log files`);
            return cleanedCount;
        } catch (error) {
            this.error('Failed to clean old logs', error);
            return 0;
        }
    }
}

// Create singleton instance
const loggingService = new LoggingService();

// Express middleware for request logging
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const requestLog = {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id || 'anonymous'
        };
        loggingService.info('API Request', requestLog);
    });
    
    next();
};

// Error handling middleware
const errorHandler = (error, req, res, next) => {
    loggingService.error('Unhandled API Error', error, {
        url: req.url,
        method: req.method,
        userId: req.user?.id,
        body: req.body
    });
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
};

module.exports = {
    loggingService,
    requestLogger,
    errorHandler
};