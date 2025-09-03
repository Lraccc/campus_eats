import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

class RealtimeLocationClient {
  constructor({ sessionId, onLocation, onNotification }) {
    this.sessionId = sessionId;
    this.onLocation = onLocation;
    this.onNotification = onNotification;
    this.stomp = null;
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      const sock = new SockJS('/ws');
      this.stomp = Stomp.over(sock);
      this.stomp.debug = () => {};
      this.stomp.connect(
        { Authorization: token ? `Bearer ${token}` : '' },
        () => {
          this.stomp.subscribe(`/topic/locations/${this.sessionId}`, msg => {
            try { const data = JSON.parse(msg.body); this.onLocation && this.onLocation(data); } catch {}
          });
          this.stomp.subscribe(`/user/queue/notifications`, msg => {
            try { const data = JSON.parse(msg.body); this.onNotification && this.onNotification(data); } catch {}
          });
          resolve();
        },
        err => reject(err)
      );
    });
  }

  sendUpdate(payload) {
    if (!this.stomp || !this.stomp.connected) return;
    this.stomp.send('/app/track', {}, JSON.stringify(payload));
  }

  disconnect() { if (this.stomp) this.stomp.disconnect(); }
}

export default RealtimeLocationClient;