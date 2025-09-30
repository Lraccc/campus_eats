import { useRouter, useSegments } from 'expo-router';
import { useCallback, useRef } from 'react';
import { IS_PRODUCTION } from '../config';
import { crashReporter } from './crashReporter';
import { productionLogger } from './productionLogger';

interface NavigationOptions {
  retries?: number;
  delay?: number;
  fallback?: string;
}

export function useProductionSafeNavigation() {
  const router = useRouter();
  const segments = useSegments();
  const isNavigatingRef = useRef(false);

  const safeNavigate = useCallback(async (
    path: string, 
    options: NavigationOptions = {}
  ) => {
    const { retries = 3, delay = 100, fallback } = options;
    
    // Prevent concurrent navigation attempts
    if (isNavigatingRef.current) {
      console.warn('Navigation already in progress, ignoring:', path);
      return false;
    }

    isNavigatingRef.current = true;

    try {
      // Validate path format
      if (!path || typeof path !== 'string') {
        throw new Error(`Invalid navigation path: ${path}`);
      }

      // Clean path
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      
      console.log(`Navigating to: ${cleanPath}`);
      productionLogger.logNavigation('navigate', cleanPath, false);

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // In production, use push with explicit error handling
          if (IS_PRODUCTION) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Navigation timeout'));
              }, 5000);

              try {
                router.push(cleanPath as any);
                clearTimeout(timeout);
                resolve();
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            });
          } else {
            router.push(cleanPath as any);
          }

          isNavigatingRef.current = false;
          productionLogger.logNavigation('navigate', cleanPath, true);
          return true;

        } catch (error) {
          console.warn(`Navigation attempt ${attempt} failed:`, error);
          
          if (attempt === retries) {
            // Final attempt failed
            if (fallback) {
              console.log(`Falling back to: ${fallback}`);
              try {
                router.push(fallback as any);
                isNavigatingRef.current = false;
                return true;
              } catch (fallbackError) {
                console.error('Fallback navigation failed:', fallbackError);
              }
            }
            
            // Report the navigation failure
            if (IS_PRODUCTION) {
              crashReporter.reportCrash({
                error: (error as Error).message || error?.toString() || 'Navigation failed',
                stack: (error as Error).stack,
                screen: 'Navigation',
                additionalInfo: {
                  context: 'navigation_failure',
                  path: cleanPath,
                  currentSegments: segments,
                  attempt: attempt
                }
              });
            }
            
            throw error;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    } catch (error) {
      console.error('Critical navigation error:', error);
      isNavigatingRef.current = false;
      return false;
    }
  }, [router, segments]);

  const safeReplace = useCallback(async (
    path: string, 
    options: NavigationOptions = {}
  ) => {
    const { retries = 3, delay = 100, fallback } = options;
    
    if (isNavigatingRef.current) {
      console.warn('Navigation already in progress, ignoring replace:', path);
      return false;
    }

    isNavigatingRef.current = true;

    try {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          if (IS_PRODUCTION) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Navigation timeout'));
              }, 5000);

              try {
                router.replace(cleanPath as any);
                clearTimeout(timeout);
                resolve();
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            });
          } else {
            router.replace(cleanPath as any);
          }

          isNavigatingRef.current = false;
          return true;

        } catch (error) {
          if (attempt === retries) {
            if (fallback) {
              try {
                router.replace(fallback as any);
                isNavigatingRef.current = false;
                return true;
              } catch (fallbackError) {
                console.error('Fallback replace failed:', fallbackError);
              }
            }
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    } catch (error) {
      console.error('Critical replace error:', error);
      isNavigatingRef.current = false;
      return false;
    }
  }, [router]);

  const safeBack = useCallback(() => {
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        console.warn('Cannot go back, navigating to home');
        safeNavigate('/(tabs)/home', { fallback: '/home' });
      }
    } catch (error) {
      console.error('Back navigation failed:', error);
      safeNavigate('/(tabs)/home', { fallback: '/home' });
    }
  }, [router, safeNavigate]);

  return {
    navigate: safeNavigate,
    replace: safeReplace,
    back: safeBack,
    canGoBack: router.canGoBack,
    segments
  };
}