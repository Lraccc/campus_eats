import cors from 'cors';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { Geofence } from './models/Geofence';
import { UserLocation } from './models/UserLocation';
import geofenceRoutes from './routes/geofences';

const app = express();
app.use(cors({ origin: '*'}));
app.use(helmet());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
app.use('/api/geofences', geofenceRoutes);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*'} });

io.on('connection', (socket: any) => {
  console.log('socket connected', socket.id);
  // client identifies themselves
  socket.on('identify', (payload: { userId: string; name?: string; role?: 'user' | 'dasher' | 'shop' }) => {
    socket.data.userId = payload.userId;
    socket.data.name = payload.name;
    socket.data.role = payload.role;
  });

  // optional: join a room (e.g., per order)
  socket.on('room:join', (payload: { roomId: string }) => {
    const { roomId } = payload || ({} as any);
    if (roomId) {
      socket.join(roomId);
      socket.data.roomId = roomId;
    }
  });

  // incoming location updates from client
  socket.on('location:update', async (payload: { lng: number; lat: number; role?: string }) => {
    const userId = socket.data.userId || socket.id;
    const name = socket.data.name;
    const role = payload.role || socket.data.role;
    const { lng, lat } = payload;

    let fences: any[] = [];
    if ((global as any).__MONGO_READY__) {
      try {
        await UserLocation.findOneAndUpdate(
          { userId },
          { userId, name, location: { type: 'Point', coordinates: [lng, lat] }, updatedAt: new Date() },
          { upsert: true, new: true }
        );
        const point = { type: 'Point', coordinates: [lng, lat] } as any;
        fences = await Geofence.find({ location: { $geoIntersects: { $geometry: point } } }).lean();
      } catch (err) {
        console.warn('DB not ready, skipping persistence/geofence checks');
      }
    }

    // broadcast update (to room if joined, else global)
  const message = { userId, name, role, lng, lat, insideGeofences: fences.map((f: any) => ({ id: f._id, name: f.name })) };
    const roomId = socket.data.roomId as string | undefined;
    if (roomId) {
      io.to(roomId).emit('location:broadcast', message);
    } else {
      io.emit('location:broadcast', message);
    }
  });

  socket.on('disconnect', () => {});
});

async function start() {
  (global as any).__MONGO_READY__ = false;
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_eats_tracking';
  try {
    await mongoose.connect(mongoUri);
    (global as any).__MONGO_READY__ = true;
    console.log('MongoDB connected');
  } catch (e) {
    console.warn('MongoDB not available, continuing without DB (geofences disabled)');
  }
  const port = Number(process.env.PORT || 4001);
  httpServer.listen(port, () => console.log(`tracking-server listening on :${port}`));
}

start().catch((e) => {
  console.error('Failed to start server', e);
  process.exit(1);
});
