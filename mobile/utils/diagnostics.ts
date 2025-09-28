// Quick diagnostic for white screen issues
// Add this to your problematic screens temporarily

export const diagnoseScreen = (screenName: string) => {
  console.log(`=== DIAGNOSING ${screenName} ===`);
  
  // Check if critical dependencies are available
  const checks = {
    React: typeof React !== 'undefined',
    AsyncStorage: typeof AsyncStorage !== 'undefined',
    router: typeof router !== 'undefined',
    axios: typeof axios !== 'undefined',
    API_URL: typeof API_URL !== 'undefined',
  };
  
  console.log('Dependency checks:', checks);
  
  // Check AsyncStorage data
  const checkAsyncStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('AsyncStorage keys:', keys);
      
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      console.log('Auth token exists:', !!token);
      
      const userData = await AsyncStorage.getItem('userData');
      console.log('User data exists:', !!userData);
      
    } catch (error) {
      console.error('AsyncStorage check failed:', error);
    }
  };
  
  checkAsyncStorage();
  
  // Check network connectivity
  const checkNetwork = async () => {
    try {
      const response = await fetch(API_URL, { method: 'HEAD' });
      console.log('Network check - API reachable:', response.ok);
    } catch (error) {
      console.error('Network check failed:', error);
    }
  };
  
  checkNetwork();
  
  console.log(`=== END DIAGNOSIS ${screenName} ===`);
};

// Error boundary for individual components
export const withErrorBoundary = (WrappedComponent: React.ComponentType<any>) => {
  return class extends React.Component {
    state = { hasError: false, error: null };
    
    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: any) {
      console.error(`Error in ${WrappedComponent.name}:`, error, errorInfo);
    }
    
    render() {
      if (this.state.hasError) {
        return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
              Component Error
            </Text>
            <Text style={{ fontSize: 14, textAlign: 'center', color: 'red' }}>
              {this.state.error?.toString()}
            </Text>
          </View>
        );
      }
      
      return <WrappedComponent {...this.props} />;
    }
  };
};