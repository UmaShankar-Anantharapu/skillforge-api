const { loggingService } = require('./loggingService');

/**
 * Comprehensive error handling service for roadmap generation system
 * Provides structured error handling, recovery mechanisms, and monitoring
 */
class ErrorHandlingService {
    constructor() {
        this.errorTypes = {
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
            AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
            DATABASE_ERROR: 'DATABASE_ERROR',
            EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
            AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
            WEB_SCRAPING_ERROR: 'WEB_SCRAPING_ERROR',
            CACHE_ERROR: 'CACHE_ERROR',
            NETWORK_ERROR: 'NETWORK_ERROR',
            TIMEOUT_ERROR: 'TIMEOUT_ERROR',
            RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
            INTERNAL_ERROR: 'INTERNAL_ERROR'
        };
        
        this.errorCodes = {
            [this.errorTypes.VALIDATION_ERROR]: 400,
            [this.errorTypes.AUTHENTICATION_ERROR]: 401,
            [this.errorTypes.AUTHORIZATION_ERROR]: 403,
            [this.errorTypes.DATABASE_ERROR]: 500,
            [this.errorTypes.EXTERNAL_API_ERROR]: 502,
            [this.errorTypes.AI_SERVICE_ERROR]: 503,
            [this.errorTypes.WEB_SCRAPING_ERROR]: 502,
            [this.errorTypes.CACHE_ERROR]: 500,
            [this.errorTypes.NETWORK_ERROR]: 502,
            [this.errorTypes.TIMEOUT_ERROR]: 504,
            [this.errorTypes.RATE_LIMIT_ERROR]: 429,
            [this.errorTypes.INTERNAL_ERROR]: 500
        };
        
        this.retryableErrors = [
            this.errorTypes.NETWORK_ERROR,
            this.errorTypes.TIMEOUT_ERROR,
            this.errorTypes.EXTERNAL_API_ERROR,
            this.errorTypes.AI_SERVICE_ERROR,
            this.errorTypes.WEB_SCRAPING_ERROR
        ];
    }

    /**
     * Create a structured error object
     */
    createError(type, message, originalError = null, metadata = {}) {
        const error = new Error(message);
        error.type = type;
        error.code = this.errorCodes[type] || 500;
        error.originalError = originalError;
        error.metadata = metadata;
        error.timestamp = new Date().toISOString();
        error.isRetryable = this.retryableErrors.includes(type);
        
        return error;
    }

    /**
     * Handle validation errors
     */
    handleValidationError(message, details = {}) {
        const error = this.createError(
            this.errorTypes.VALIDATION_ERROR,
            message,
            null,
            { validationDetails: details }
        );
        
        loggingService.warn('Validation Error', {
            message,
            details
        });
        
        return error;
    }

    /**
     * Handle database errors
     */
    handleDatabaseError(originalError, operation = 'unknown') {
        const error = this.createError(
            this.errorTypes.DATABASE_ERROR,
            `Database operation failed: ${operation}`,
            originalError,
            { operation }
        );
        
        loggingService.error('Database Error', originalError, {
            operation,
            errorType: 'DATABASE_ERROR'
        });
        
        return error;
    }

    /**
     * Handle AI service errors
     */
    handleAIServiceError(originalError, service = 'unknown', operation = 'unknown') {
        const error = this.createError(
            this.errorTypes.AI_SERVICE_ERROR,
            `AI service error: ${service} - ${operation}`,
            originalError,
            { service, operation }
        );
        
        loggingService.error('AI Service Error', originalError, {
            service,
            operation,
            errorType: 'AI_SERVICE_ERROR'
        });
        
        return error;
    }

    /**
     * Handle web scraping errors
     */
    handleWebScrapingError(originalError, source = 'unknown', url = null) {
        const error = this.createError(
            this.errorTypes.WEB_SCRAPING_ERROR,
            `Web scraping failed: ${source}`,
            originalError,
            { source, url }
        );
        
        loggingService.error('Web Scraping Error', originalError, {
            source,
            url,
            errorType: 'WEB_SCRAPING_ERROR'
        });
        
        return error;
    }

    /**
     * Handle external API errors
     */
    handleExternalAPIError(originalError, apiName = 'unknown', endpoint = null) {
        const error = this.createError(
            this.errorTypes.EXTERNAL_API_ERROR,
            `External API error: ${apiName}`,
            originalError,
            { apiName, endpoint }
        );
        
        loggingService.error('External API Error', originalError, {
            apiName,
            endpoint,
            errorType: 'EXTERNAL_API_ERROR'
        });
        
        return error;
    }

    /**
     * Handle cache errors
     */
    handleCacheError(originalError, operation = 'unknown', key = null) {
        const error = this.createError(
            this.errorTypes.CACHE_ERROR,
            `Cache operation failed: ${operation}`,
            originalError,
            { operation, key }
        );
        
        loggingService.warn('Cache Error', {
            operation,
            key,
            error: originalError?.message
        });
        
        return error;
    }

    /**
     * Handle network errors
     */
    handleNetworkError(originalError, url = null, method = 'GET') {
        const error = this.createError(
            this.errorTypes.NETWORK_ERROR,
            'Network request failed',
            originalError,
            { url, method }
        );
        
        loggingService.error('Network Error', originalError, {
            url,
            method,
            errorType: 'NETWORK_ERROR'
        });
        
        return error;
    }

    /**
     * Handle timeout errors
     */
    handleTimeoutError(operation = 'unknown', timeout = null) {
        const error = this.createError(
            this.errorTypes.TIMEOUT_ERROR,
            `Operation timed out: ${operation}`,
            null,
            { operation, timeout }
        );
        
        loggingService.warn('Timeout Error', {
            operation,
            timeout,
            errorType: 'TIMEOUT_ERROR'
        });
        
        return error;
    }

    /**
     * Handle rate limit errors
     */
    handleRateLimitError(service = 'unknown', resetTime = null) {
        const error = this.createError(
            this.errorTypes.RATE_LIMIT_ERROR,
            `Rate limit exceeded: ${service}`,
            null,
            { service, resetTime }
        );
        
        loggingService.warn('Rate Limit Error', {
            service,
            resetTime,
            errorType: 'RATE_LIMIT_ERROR'
        });
        
        return error;
    }

    /**
     * Retry mechanism with exponential backoff
     */
    async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                
                if (attempt > 1) {
                    loggingService.info('Operation succeeded after retry', {
                        attempt,
                        maxRetries
                    });
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries || !this.isRetryableError(error)) {
                    break;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                
                loggingService.warn('Operation failed, retrying', {
                    attempt,
                    maxRetries,
                    delay,
                    error: error.message
                });
                
                await this.sleep(delay);
            }
        }
        
        loggingService.error('Operation failed after all retries', lastError, {
            maxRetries,
            finalAttempt: true
        });
        
        throw lastError;
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        return error.isRetryable || this.retryableErrors.includes(error.type);
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Circuit breaker pattern implementation
     */
    createCircuitBreaker(operation, options = {}) {
        const {
            failureThreshold = 5,
            resetTimeout = 60000,
            monitoringPeriod = 60000
        } = options;
        
        let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        let failureCount = 0;
        let lastFailureTime = null;
        let successCount = 0;
        
        return async (...args) => {
            const now = Date.now();
            
            // Reset failure count if monitoring period has passed
            if (lastFailureTime && (now - lastFailureTime) > monitoringPeriod) {
                failureCount = 0;
                if (state === 'OPEN') {
                    state = 'HALF_OPEN';
                    successCount = 0;
                }
            }
            
            // Check circuit state
            if (state === 'OPEN') {
                if ((now - lastFailureTime) < resetTimeout) {
                    throw this.createError(
                        this.errorTypes.EXTERNAL_API_ERROR,
                        'Circuit breaker is OPEN',
                        null,
                        { circuitState: state, failureCount }
                    );
                } else {
                    state = 'HALF_OPEN';
                    successCount = 0;
                }
            }
            
            try {
                const result = await operation(...args);
                
                // Success in HALF_OPEN state
                if (state === 'HALF_OPEN') {
                    successCount++;
                    if (successCount >= 3) {
                        state = 'CLOSED';
                        failureCount = 0;
                        loggingService.info('Circuit breaker reset to CLOSED');
                    }
                }
                
                return result;
            } catch (error) {
                failureCount++;
                lastFailureTime = now;
                
                if (failureCount >= failureThreshold) {
                    state = 'OPEN';
                    loggingService.warn('Circuit breaker opened', {
                        failureCount,
                        threshold: failureThreshold
                    });
                }
                
                throw error;
            }
        };
    }

    /**
     * Format error for API response
     */
    formatErrorResponse(error) {
        const response = {
            success: false,
            error: {
                type: error.type || this.errorTypes.INTERNAL_ERROR,
                message: error.message,
                code: error.code || 500,
                timestamp: error.timestamp || new Date().toISOString()
            }
        };
        
        // Add additional details in development
        if (process.env.NODE_ENV === 'development') {
            response.error.stack = error.stack;
            response.error.metadata = error.metadata;
        }
        
        return response;
    }

    /**
     * Express error handling middleware
     */
    expressErrorHandler() {
        return (error, req, res, next) => {
            // Log the error
            loggingService.error('Express Error Handler', error, {
                url: req.url,
                method: req.method,
                userId: req.user?.id,
                userAgent: req.get('User-Agent')
            });
            
            // Format and send error response
            const errorResponse = this.formatErrorResponse(error);
            res.status(error.code || 500).json(errorResponse);
        };
    }

    /**
     * Async error wrapper for route handlers
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        // This would typically integrate with a monitoring system
        // For now, return basic structure
        return {
            totalErrors: 0,
            errorsByType: {},
            errorsByHour: {},
            retryStats: {
                totalRetries: 0,
                successfulRetries: 0,
                failedRetries: 0
            }
        };
    }
}

// Create singleton instance
const errorHandlingService = new ErrorHandlingService();

module.exports = {
    errorHandlingService,
    ErrorTypes: errorHandlingService.errorTypes
};