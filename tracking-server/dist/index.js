"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const mongoose_1 = __importDefault(require("mongoose"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const geofences_js_1 = __importDefault(require("./routes/geofences.js"));
const UserLocation_js_1 = require("./models/UserLocation.js");
const Geofence_js_1 = require("./models/Geofence.js");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: '*' }));
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/geofences', geofences_js_1.default);
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, { cors: { origin: '*' } });
io.on('connection', (socket) => {
    // client identifies themselves
    socket.on('identify', (payload) => {
        socket.data.userId = payload.userId;
        socket.data.name = payload.name;
        socket.data.role = payload.role;
    });
    // optional: join a room (e.g., per order)
    socket.on('room:join', (payload) => {
        const { roomId } = payload || {};
        if (roomId) {
            socket.join(roomId);
            socket.data.roomId = roomId;
        }
    });
    // incoming location updates from client
    socket.on('location:update', async (payload) => {
        const userId = socket.data.userId || socket.id;
        const name = socket.data.name;
        const role = payload.role || socket.data.role;
        const { lng, lat } = payload;
        // upsert user location
        await UserLocation_js_1.UserLocation.findOneAndUpdate({ userId }, { userId, name, location: { type: 'Point', coordinates: [lng, lat] }, updatedAt: new Date() }, { upsert: true, new: true });
        // geofence checks
        const point = { type: 'Point', coordinates: [lng, lat] };
        const fences = await Geofence_js_1.Geofence.find({ location: { $geoIntersects: { $geometry: point } } }).lean();
        // broadcast update (to room if joined, else global)
        const message = { userId, name, role, lng, lat, insideGeofences: fences.map((f) => ({ id: f._id, name: f.name })) };
        const roomId = socket.data.roomId;
        if (roomId) {
            io.to(roomId).emit('location:broadcast', message);
        }
        else {
            io.emit('location:broadcast', message);
        }
    });
    socket.on('disconnect', () => { });
});
async function start() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_eats_tracking';
    await mongoose_1.default.connect(mongoUri);
    const port = Number(process.env.PORT || 4001);
    httpServer.listen(port, () => console.log(`tracking-server listening on :${port}`));
}
start().catch((e) => {
    console.error('Failed to start server', e);
    process.exit(1);
});
