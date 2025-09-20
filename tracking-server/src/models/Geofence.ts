import mongoose, { Document, Schema } from 'mongoose';

export interface IGeofence extends Document {
  name: string;
  location: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng, lat], ...]]
  };
  createdBy?: string;
}

const geofenceSchema = new Schema<IGeofence>({
  name: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  createdBy: { type: String }
});

geofenceSchema.index({ location: '2dsphere' });

export const Geofence = mongoose.model<IGeofence>('Geofence', geofenceSchema);
