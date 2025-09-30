import { router } from 'expo-router';
import { Alert } from 'react-native';

interface NavigationOptions {
  fallback?: string;
  onError?: (error: Error) => void;
}

export const safeNavigate = (path: string, options: NavigationOptions = {}) => {
  try {
    console.log(`Attempting to navigate to: ${path}`);
    
    // Add a small delay to ensure current state is stable
    setTimeout(() => {
      try {
        router.push(path as any);
        console.log(`Successfully navigated to: ${path}`);
      } catch (navError) {
        console.error(`Navigation error to ${path}:`, navError);
        
        if (options.onError) {
          options.onError(navError as Error);
        } else {
          Alert.alert(
            'Navigation Error',
            `Unable to navigate to ${path}. Please try again.`,
            [
              { text: 'OK' },
              options.fallback && {
                text: 'Go Home',
                onPress: () => {
                  try {
                    router.replace(options.fallback as any);
                  } catch (fallbackError) {
                    console.error('Fallback navigation failed:', fallbackError);
                  }
                }
              }
            ].filter(Boolean)
          );
        }
      }
    }, 100);
    
  } catch (error) {
    console.error(`Pre-navigation error for ${path}:`, error);
    Alert.alert('Error', 'Unable to navigate. Please try again.');
  }
};

export const safeReplace = (path: string, options: NavigationOptions = {}) => {
  try {
    console.log(`Attempting to replace with: ${path}`);
    
    setTimeout(() => {
      try {
        router.replace(path as any);
        console.log(`Successfully replaced with: ${path}`);
      } catch (navError) {
        console.error(`Replace error to ${path}:`, navError);
        
        if (options.onError) {
          options.onError(navError as Error);
        } else {
          Alert.alert('Navigation Error', `Unable to navigate to ${path}. Please try again.`);
        }
      }
    }, 100);
    
  } catch (error) {
    console.error(`Pre-replace error for ${path}:`, error);
    Alert.alert('Error', 'Unable to navigate. Please try again.');
  }
};

export const safeGoBack = (fallback: string = '/') => {
  try {
    console.log('Attempting to go back');
    
    setTimeout(() => {
      try {
        if (router.canGoBack()) {
          router.back();
          console.log('Successfully navigated back');
        } else {
          console.log('Cannot go back, using fallback');
          router.replace(fallback as any);
        }
      } catch (navError) {
        console.error('Go back error:', navError);
        try {
          router.replace(fallback as any);
        } catch (fallbackError) {
          console.error('Fallback navigation failed:', fallbackError);
        }
      }
    }, 100);
    
  } catch (error) {
    console.error('Pre-back error:', error);
    try {
      router.replace(fallback as any);
    } catch (fallbackError) {
      console.error('Final fallback failed:', fallbackError);
    }
  }
};