import mongoose, { Document, Schema } from 'mongoose';

export interface IUserLocation extends Document {
  userId: string;
  name?: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  updatedAt: Date;
}

const userLocationSchema = new Schema<IUserLocation>({
  userId: { type: String, required: true, index: true },
  name: { type: String },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) => arr.length === 2,
        message: 'coordinates must be [lng, lat]'
      }
    }
  },
  updatedAt: { type: Date, default: Date.now }
});

userLocationSchema.index({ location: '2dsphere' });

export const UserLocation = mongoose.model<IUserLocation>('UserLocation', userLocationSchema);
