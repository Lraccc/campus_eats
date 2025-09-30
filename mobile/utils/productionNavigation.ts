import { router } from 'expo-router';
import { Alert } from 'react-native';

// Production-safe navigation that prevents common navigation crashes
export class ProductionNavigation {
  private static retryCount = 0;
  private static maxRetries = 3;

  static async navigate(path: string, options: { replace?: boolean; params?: any } = {}) {
    const { replace = false, params } = options;
    
    try {
      console.log(`[ProductionNav] Attempting to navigate to: ${path}`);
      
      // Ensure we're in a stable state before navigation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (replace) {
        if (params) {
          router.replace({ pathname: path as any, params });
        } else {
          router.replace(path as any);
        }
      } else {
        if (params) {
          router.push({ pathname: path as any, params });
        } else {
          router.push(path as any);
        }
      }
      
      console.log(`[ProductionNav] Successfully navigated to: ${path}`);
      this.retryCount = 0; // Reset retry count on success
      
    } catch (error) {
      console.error(`[ProductionNav] Navigation failed to ${path}:`, error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`[ProductionNav] Retrying navigation (${this.retryCount}/${this.maxRetries})`);
        
        // Wait a bit longer before retry
        await new Promise(resolve => setTimeout(resolve, 200 * this.retryCount));
        return this.navigate(path, options);
      } else {
        this.retryCount = 0;
        Alert.alert(
          'Navigation Error',
          `Unable to navigate to ${path}. Please try again or restart the app.`,
          [
            { text: 'OK' },
            {
              text: 'Go Home',
              onPress: () => {
                try {
                  router.replace('/');
                } catch (homeError) {
                  console.error('Failed to navigate home:', homeError);
                }
              }
            }
          ]
        );
      }
    }
  }

  static async goBack(fallback: string = '/') {
    try {
      console.log('[ProductionNav] Attempting to go back');
      
      if (router.canGoBack()) {
        router.back();
        console.log('[ProductionNav] Successfully went back');
      } else {
        console.log('[ProductionNav] Cannot go back, using fallback');
        await this.navigate(fallback, { replace: true });
      }
    } catch (error) {
      console.error('[ProductionNav] Go back failed:', error);
      await this.navigate(fallback, { replace: true });
    }
  }
}

// Convenience exports
export const navigate = ProductionNavigation.navigate.bind(ProductionNavigation);
export const goBack = ProductionNavigation.goBack.bind(ProductionNavigation);
export const replace = (path: string, params?: any) => 
  ProductionNavigation.navigate(path, { replace: true, params });