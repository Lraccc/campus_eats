import AsyncStorage from '@react-native-async-storage/async-storage';

export class PersistenceTest {
  static async testLogPersistence() {
    console.log('🧪 Testing log persistence...');
    
    // Simulate some logs and crashes
    const testCrash = {
      timestamp: new Date().toISOString(),
      error: 'Test crash for persistence verification',
      screen: 'PersistenceTest',
      additionalInfo: { test: true, beforeRestart: true }
    };
    
    const testLogs = [
      `[${new Date().toISOString()}] TEST: App about to crash/restart`,
      `[${new Date().toISOString()}] TEST: This log should survive restart`,
      `[${new Date().toISOString()}] ERROR: Simulated error before restart`
    ];
    
    try {
      // Save test data
      const existingCrashes = await AsyncStorage.getItem('@CampusEats:CrashReports');
      const crashes = existingCrashes ? JSON.parse(existingCrashes) : [];
      crashes.push(testCrash);
      await AsyncStorage.setItem('@CampusEats:CrashReports', JSON.stringify(crashes));
      
      const existingLogs = await AsyncStorage.getItem('@CampusEats:ConsoleLogs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(...testLogs);
      await AsyncStorage.setItem('@CampusEats:ConsoleLogs', JSON.stringify(logs));
      
      console.log('✅ Test data saved. Now restart the app and check debug panel!');
      console.log('🔍 Look for "Test crash for persistence verification" in crash reports');
      console.log('🔍 Look for "This log should survive restart" in console logs');
      
    } catch (error) {
      console.error('❌ Persistence test failed:', error);
    }
  }
  
  static async verifyPersistence() {
    console.log('🔍 Verifying log persistence after restart...');
    
    try {
      const crashes = await AsyncStorage.getItem('@CampusEats:CrashReports');
      const logs = await AsyncStorage.getItem('@CampusEats:ConsoleLogs');
      
      const crashData = crashes ? JSON.parse(crashes) : [];
      const logData = logs ? JSON.parse(logs) : [];
      
      const testCrash = crashData.find((c: any) => c.error?.includes('Test crash for persistence verification'));
      const testLog = logData.find((l: string) => l.includes('This log should survive restart'));
      
      console.log('📊 Persistence Verification Results:');
      console.log(`- Total crashes stored: ${crashData.length}`);
      console.log(`- Total logs stored: ${logData.length}`);
      console.log(`- Test crash found: ${testCrash ? '✅ YES' : '❌ NO'}`);
      console.log(`- Test log found: ${testLog ? '✅ YES' : '❌ NO'}`);
      
      if (testCrash && testLog) {
        console.log('🎉 PERSISTENCE TEST PASSED - Logs survive app restart!');
      } else {
        console.log('⚠️ Some test data missing - check debug panel manually');
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error);
    }
  }
}

// Auto-verify on import (runs when app starts)
PersistenceTest.verifyPersistence();