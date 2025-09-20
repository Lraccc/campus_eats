"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Geofence_js_1 = require("../models/Geofence.js");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const items = await Geofence_js_1.Geofence.find().lean();
    res.json(items);
});
router.post('/', async (req, res) => {
    try {
        const { name, coordinates } = req.body;
        if (!name || !coordinates)
            return res.status(400).json({ error: 'name and coordinates required' });
        // Ensure closed polygon (first == last)
        const ring = coordinates[0];
        if (!ring || ring.length < 3)
            return res.status(400).json({ error: 'polygon needs >=3 points' });
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push(first);
        }
        const created = await Geofence_js_1.Geofence.create({
            name,
            location: { type: 'Polygon', coordinates }
        });
        res.status(201).json(created);
    }
    catch (e) {
        console.error(e);
        res.status(500).json({ error: 'failed to create geofence' });
    }
});
exports.default = router;
