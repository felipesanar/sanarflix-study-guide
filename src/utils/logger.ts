/**
 * Sistema de logging seguro para a aplicação
 * Remove logs sensíveis em produção e centraliza o controle de logging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  userAgent?: string;
  url?: string;
}

export class Logger {
  private static isDevelopment = import.meta.env.DEV;
  private static isProduction = import.meta.env.PROD;

  /**
   * Log de informações gerais (apenas em desenvolvimento)
   */
  static info(message: string, data?: any) {
    if (this.isDevelopment) {
      
    }
    this.sendToMonitoring('info', message, data);
  }

  /**
   * Log de avisos (apenas em desenvolvimento)
   */
  static warn(message: string, data?: any) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    }
    this.sendToMonitoring('warn', message, data);
  }

  /**
   * Log de erros (sempre registrado para monitoramento)
   */
  static error(message: string, error?: any) {
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    }
    
    // Em produção, sempre enviar erros para monitoramento
    this.sendToMonitoring('error', message, this.sanitizeError(error));
  }

  /**
   * Log de debug (apenas em desenvolvimento)
   */
  static debug(message: string, data?: any) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  /**
   * Remove informações sensíveis dos erros antes de enviar para monitoramento
   */
  private static sanitizeError(error: any): any {
    if (!error) return error;

    // Se for um objeto Error
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack, // Stack trace apenas em dev
      };
    }

    // Se for um objeto genérico, remover campos sensíveis
    if (typeof error === 'object') {
      const sanitized = { ...error };
      
      // Lista de campos sensíveis para remover
      const sensitiveFields = [
        'password', 'senha', 'token', 'secret', 'key', 'auth',
        'authorization', 'cookie', 'session', 'cpf', 'email'
      ];

      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      return sanitized;
    }

    return error;
  }

  /**
   * Envia logs para serviço de monitoramento (implementar integração futura)
   */
  private static sendToMonitoring(level: LogLevel, message: string, data?: any) {
    // TODO: Implementar integração com Sentry, LogRocket, ou outro serviço
    // Por enquanto, apenas armazena localmente em desenvolvimento
    
    if (this.isDevelopment) {
      const logEntry: LogEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Armazenar no localStorage para debug (apenas dev)
      try {
        const logs = JSON.parse(localStorage.getItem('app-logs') || '[]');
        logs.push(logEntry);
        
        // Manter apenas os últimos 100 logs
        if (logs.length > 100) {
          logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('app-logs', JSON.stringify(logs));
      } catch (e) {
        // Falha ao salvar logs não deve quebrar a aplicação
      }
    }
  }

  /**
   * Recupera logs armazenados localmente (apenas desenvolvimento)
   */
  static getLogs(): LogEntry[] {
    if (!this.isDevelopment) return [];
    
    try {
      return JSON.parse(localStorage.getItem('app-logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Limpa logs armazenados localmente
   */
  static clearLogs() {
    if (this.isDevelopment) {
      localStorage.removeItem('app-logs');
    }
  }

  /**
   * Log específico para performance
   */
  static performance(operation: string, duration: number, metadata?: any) {
    const message = `Performance: ${operation} took ${duration}ms`;
    
    if (this.isDevelopment) {
      
    }

    this.sendToMonitoring('info', message, {
      operation,
      duration,
      ...metadata,
    });
  }

  /**
   * Log específico para ações do usuário
   */
  static userAction(action: string, metadata?: any) {
    const message = `User Action: ${action}`;
    
    if (this.isDevelopment) {
      
    }

    this.sendToMonitoring('info', message, {
      action,
      ...metadata,
    });
  }
}

export default Logger;

/**
 * Hook para usar o logger em componentes React
 */
export const useLogger = () => {
  return {
    info: Logger.info,
    warn: Logger.warn,
    error: Logger.error,
    debug: Logger.debug,
    performance: Logger.performance,
    userAction: Logger.userAction,
  };
};

/**
 * Decorator para medir performance de funções
 */
export function measurePerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = method.apply(this, args);

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        Logger.performance(`${target.constructor.name}.${propertyName}`, duration);
      });
    } else {
      const duration = performance.now() - start;
      Logger.performance(`${target.constructor.name}.${propertyName}`, duration);
      return result;
    }
  };

  return descriptor;
}