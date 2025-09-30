import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error, retry: () => void}>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error details for debugging
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.log('Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // You can also send error to crash reporting service here
    // Example: Crashlytics.recordError(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />;
      }

      return (
        <StyledView className="flex-1 justify-center items-center p-6 bg-white">
          <StyledView className="items-center mb-6">
            <StyledText className="text-6xl mb-4">😵</StyledText>
            <StyledText className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Oops! Something went wrong
            </StyledText>
            <StyledText className="text-base text-gray-600 text-center mb-4">
              The app encountered an unexpected error
            </StyledText>
          </StyledView>

          <StyledView className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 w-full">
            <StyledText className="text-sm font-semibold text-red-800 mb-2">
              Error Details:
            </StyledText>
            <StyledText className="text-sm text-red-700 font-mono">
              {this.state.error?.name}: {this.state.error?.message}
            </StyledText>
          </StyledView>

          <StyledView className="flex-row gap-3">
            <StyledTouchableOpacity
              className="bg-[#BC4A4D] px-6 py-3 rounded-lg"
              onPress={this.handleRetry}
            >
              <StyledText className="text-white font-semibold">Try Again</StyledText>
            </StyledTouchableOpacity>
            
            <StyledTouchableOpacity
              className="bg-gray-200 px-6 py-3 rounded-lg"
              onPress={() => {
                Alert.alert(
                  'Error Details',
                  `${this.state.error?.name}: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack?.substring(0, 200)}...`,
                  [{ text: 'OK' }]
                );
              }}
            >
              <StyledText className="text-gray-700 font-semibold">Details</StyledText>
            </StyledTouchableOpacity>
          </StyledView>
        </StyledView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;