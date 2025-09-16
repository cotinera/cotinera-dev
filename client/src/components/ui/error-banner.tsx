/**
 * Comprehensive Error Banner Component
 * Handles all Google Places API error states with user-friendly messages
 */

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  X, 
  RefreshCw, 
  ExternalLink, 
  Clock, 
  Key,
  CreditCard,
  Ban,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlacesApiErrorType, PlacesApiError } from '@/lib/places/api-wrapper';

export interface ErrorBannerProps {
  error: PlacesApiError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  autoHide?: number; // milliseconds
  className?: string;
  variant?: 'default' | 'compact';
}

// Error type to visual configuration mapping
const ERROR_CONFIG: Record<PlacesApiErrorType, {
  icon: typeof AlertCircle;
  severity: 'error' | 'warning' | 'info';
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  actionable: boolean;
}> = {
  [PlacesApiErrorType.API_KEY_INVALID]: {
    icon: Key,
    severity: 'error',
    title: 'Invalid API Key',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    actionable: true,
  },
  [PlacesApiErrorType.API_KEY_MISSING]: {
    icon: Key,
    severity: 'error',
    title: 'Missing API Key',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    actionable: true,
  },
  [PlacesApiErrorType.QUOTA_EXCEEDED]: {
    icon: CreditCard,
    severity: 'error',
    title: 'Quota Exceeded',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    actionable: false,
  },
  [PlacesApiErrorType.BILLING_NOT_ENABLED]: {
    icon: CreditCard,
    severity: 'error',
    title: 'Billing Not Enabled',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    actionable: true,
  },
  [PlacesApiErrorType.ZERO_RESULTS]: {
    icon: Info,
    severity: 'info',
    title: 'No Results Found',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    actionable: false,
  },
  [PlacesApiErrorType.INVALID_REQUEST]: {
    icon: AlertTriangle,
    severity: 'warning',
    title: 'Invalid Request',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    actionable: true,
  },
  [PlacesApiErrorType.REQUEST_DENIED]: {
    icon: Ban,
    severity: 'error',
    title: 'Request Denied',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    actionable: true,
  },
  [PlacesApiErrorType.NETWORK_ERROR]: {
    icon: RefreshCw,
    severity: 'warning',
    title: 'Network Error',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    actionable: true,
  },
  [PlacesApiErrorType.TIMEOUT]: {
    icon: Clock,
    severity: 'warning',
    title: 'Request Timeout',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    actionable: true,
  },
  [PlacesApiErrorType.CANCELLED]: {
    icon: Info,
    severity: 'info',
    title: 'Request Cancelled',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    actionable: false,
  },
  [PlacesApiErrorType.UNKNOWN_ERROR]: {
    icon: AlertCircle,
    severity: 'error',
    title: 'Unknown Error',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    actionable: true,
  },
};

// User-friendly error messages with actionable advice
const ERROR_MESSAGES: Record<PlacesApiErrorType, {
  message: string;
  action?: string;
  link?: string;
}> = {
  [PlacesApiErrorType.API_KEY_INVALID]: {
    message: 'The Google Maps API key is invalid or has expired.',
    action: 'Check API Key Configuration',
    link: 'https://developers.google.com/maps/documentation/javascript/get-api-key',
  },
  [PlacesApiErrorType.API_KEY_MISSING]: {
    message: 'No Google Maps API key has been configured.',
    action: 'Configure API Key',
    link: 'https://developers.google.com/maps/documentation/javascript/get-api-key',
  },
  [PlacesApiErrorType.QUOTA_EXCEEDED]: {
    message: 'The daily request limit for Places API has been exceeded. Try again tomorrow.',
    action: 'Check Usage Limits',
    link: 'https://console.cloud.google.com/google/maps-apis/quotas',
  },
  [PlacesApiErrorType.BILLING_NOT_ENABLED]: {
    message: 'Google Maps billing is not enabled for this project.',
    action: 'Enable Billing',
    link: 'https://console.cloud.google.com/billing',
  },
  [PlacesApiErrorType.ZERO_RESULTS]: {
    message: 'No places found matching your search criteria. Try expanding your search area or using different keywords.',
  },
  [PlacesApiErrorType.INVALID_REQUEST]: {
    message: 'The request parameters are invalid. Please try a different search.',
  },
  [PlacesApiErrorType.REQUEST_DENIED]: {
    message: 'Request was denied. This may be due to insufficient permissions or invalid configuration.',
    action: 'Check API Configuration',
    link: 'https://developers.google.com/maps/documentation/places/web-service/policies',
  },
  [PlacesApiErrorType.NETWORK_ERROR]: {
    message: 'Network connection failed. Please check your internet connection.',
  },
  [PlacesApiErrorType.TIMEOUT]: {
    message: 'Request timed out. The service may be temporarily unavailable.',
  },
  [PlacesApiErrorType.CANCELLED]: {
    message: 'The request was cancelled.',
  },
  [PlacesApiErrorType.UNKNOWN_ERROR]: {
    message: 'An unexpected error occurred. Please try again.',
  },
};

export function ErrorBanner({
  error,
  onDismiss,
  onRetry,
  autoHide,
  className,
  variant = 'default'
}: ErrorBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Auto-hide functionality
  useEffect(() => {
    if (!error || !autoHide) return;

    setTimeRemaining(Math.floor(autoHide / 1000));
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          handleDismiss();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [error, autoHide]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleRetry = () => {
    onRetry?.();
  };

  if (!error || !isVisible) {
    return null;
  }

  const config = ERROR_CONFIG[error.type];
  const errorInfo = ERROR_MESSAGES[error.type];
  const Icon = config.icon;

  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center justify-between p-3 rounded-md border',
        config.bgColor,
        config.borderColor,
        className
      )}>
        <div className="flex items-center space-x-2">
          <Icon className={cn('h-4 w-4', config.color)} />
          <span className={cn('text-sm font-medium', config.color)}>
            {config.title}
          </span>
          {error.requestId && (
            <Badge variant="outline" className="text-xs">
              #{error.requestId.slice(-6)}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {config.actionable && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className={cn('h-6 px-2', config.color)}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className={cn('h-6 px-2', config.color)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Alert className={cn(
      'border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <Icon className={cn('h-5 w-5', config.color)} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <AlertTitle className={cn('mb-1', config.color)}>
            {config.title}
            {error.requestId && (
              <Badge variant="outline" className="ml-2 text-xs">
                Request #{error.requestId.slice(-6)}
              </Badge>
            )}
          </AlertTitle>
          <div className="flex items-center space-x-2">
            {timeRemaining !== null && (
              <span className={cn('text-xs', config.color)}>
                Auto-dismiss in {timeRemaining}s
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className={cn('h-6 w-6 p-0', config.color)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <AlertDescription className={cn('text-sm', config.color)}>
          {errorInfo.message}
          
          {error.originalError && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                Technical Details
              </summary>
              <pre className="mt-1 text-xs opacity-75 whitespace-pre-wrap">
                {JSON.stringify(error.originalError, null, 2)}
              </pre>
            </details>
          )}
        </AlertDescription>

        {(config.actionable && (onRetry || errorInfo.action)) && (
          <div className="flex items-center space-x-3 mt-3">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className={cn(
                  'h-8',
                  config.color,
                  'border-current hover:bg-current hover:bg-opacity-10'
                )}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Try Again
              </Button>
            )}
            
            {errorInfo.action && errorInfo.link && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(errorInfo.link, '_blank')}
                className={cn('h-8', config.color)}
              >
                {errorInfo.action}
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Alert>
  );
}

// Error context for managing multiple errors
interface ErrorState {
  [key: string]: PlacesApiError | null;
}

interface ErrorContextValue {
  errors: ErrorState;
  addError: (key: string, error: PlacesApiError) => void;
  removeError: (key: string) => void;
  clearAllErrors: () => void;
}

import { createContext, useContext, ReactNode } from 'react';

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorState>({});

  const addError = (key: string, error: PlacesApiError) => {
    setErrors(prev => ({ ...prev, [key]: error }));
  };

  const removeError = (key: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[key];
      return newErrors;
    });
  };

  const clearAllErrors = () => {
    setErrors({});
  };

  return (
    <ErrorContext.Provider value={{ errors, addError, removeError, clearAllErrors }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrorHandler() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useErrorHandler must be used within an ErrorProvider');
  }
  return context;
}

// Multi-error banner for showing multiple errors at once
export function MultiErrorBanner({ 
  className,
  maxVisible = 3,
  variant = 'default' 
}: {
  className?: string;
  maxVisible?: number;
  variant?: 'default' | 'compact';
}) {
  const { errors, removeError, clearAllErrors } = useErrorHandler();
  const errorEntries = Object.entries(errors).filter(([, error]) => error !== null);
  
  if (errorEntries.length === 0) {
    return null;
  }

  const visibleErrors = errorEntries.slice(0, maxVisible);
  const hiddenCount = errorEntries.length - maxVisible;

  return (
    <div className={cn('space-y-2', className)}>
      {visibleErrors.map(([key, error]) => (
        <ErrorBanner
          key={key}
          error={error}
          onDismiss={() => removeError(key)}
          variant={variant}
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
          <span>+{hiddenCount} more error{hiddenCount !== 1 ? 's' : ''}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllErrors}
            className="h-6 px-2 text-gray-600"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorBanner;