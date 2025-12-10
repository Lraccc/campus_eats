import { Audio } from 'expo-av';

let sound: Audio.Sound | null = null;
let isPlaying = false;

/**
 * Play a notification sound for incoming orders
 * Uses a system sound that loops until manually stopped
 */
export const playOrderNotificationSound = async () => {
  try {
    // Don't play if already playing
    if (isPlaying) {
      console.log('🔔 Notification sound already playing');
      return;
    }

    // Set audio mode for proper playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true, // Play even in silent mode
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    // Create and load the sound
    const { sound: newSound } = await Audio.Sound.createAsync(
      // Using a built-in notification sound URI
      // You can replace this with your custom sound file
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' }, // Default notification sound
      { 
        shouldPlay: true,
        isLooping: true, // Loop until manually stopped
        volume: 1.0,
      }
    );

    sound = newSound;
    isPlaying = true;

    console.log('🔔 Playing order notification sound');

    // Set up playback status update
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish && !status.isLooping) {
        isPlaying = false;
      }
    });

  } catch (error) {
    console.error('Error playing notification sound:', error);
    isPlaying = false;
  }
};

/**
 * Stop the notification sound
 */
export const stopOrderNotificationSound = async () => {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      sound = null;
      isPlaying = false;
      console.log('🔕 Stopped order notification sound');
    }
  } catch (error) {
    console.error('Error stopping notification sound:', error);
    isPlaying = false;
  }
};

/**
 * Play a single beep notification (non-looping)
 */
export const playSingleNotificationBeep = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const { sound: beepSound } = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
      { 
        shouldPlay: true,
        isLooping: false,
        volume: 1.0,
      }
    );

    // Auto-unload after playing
    beepSound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        await beepSound.unloadAsync();
      }
    });

    console.log('🔔 Playing single notification beep');
  } catch (error) {
    console.error('Error playing notification beep:', error);
  }
};

/**
 * Check if notification sound is currently playing
 */
export const isNotificationPlaying = () => {
  return isPlaying;
};
