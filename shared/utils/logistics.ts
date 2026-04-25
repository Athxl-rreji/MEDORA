import { calculateDistance } from '../utils';

export class DeliveryService {
    /**
     * Determines whether an order should be dispatched locally or flagged for quick-commerce.
     */
    static analyzeDeliveryLogistics(pickupLat: number, pickupLon: number, dropLat: number, dropLon: number) {
        const distance = calculateDistance(pickupLat, pickupLon, dropLat, dropLon);
        // Assuming unit of distance here is kilometers
        if (distance > 10) {
            return {
                status: 'WARNING',
                message: 'Distance exceeds standard quick-commerce radius. Searching extended delivery net.',
                distance_km: distance
            }
        }
        return {
            status: 'OK',
            message: 'Eligible for 15-minute quick-commerce delivery.',
            distance_km: distance
        }
    }
}
