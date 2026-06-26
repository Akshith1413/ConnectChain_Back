import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);

  constructor(private supabaseService: SupabaseService) {}

  async searchWorkers(
    serviceId: string,
    lat?: number,
    lng?: number,
    maxDistance = 15, // default 15km
    minRating?: number,
    maxPrice?: number,
    sortBy: 'rating' | 'distance' | 'price' = 'rating',
  ) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Fetch service name by ID to filter by skills
    const { data: service, error: serviceError } = await adminClient
      .from('services')
      .select('name')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      this.logger.warn(`Could not find service details for search: ${serviceError?.message}`);
    }
    const serviceName = service?.name || '';

    // 2. Fetch all workers joined with user details
    const { data: workers, error } = await adminClient
      .from('workers')
      .select('id, rating, hourly_rate, skills, users:id(name, phone, photo_url, latitude, longitude)');

    if (error) {
      this.logger.error(`Failed to fetch workers: ${error.message}`);
      throw new BadRequestException(`Failed to retrieve workers: ${error.message}`);
    }

    let filtered = workers || [];

    // 3. Filter workers who possess the requested service name in their skills
    if (serviceName) {
      filtered = filtered.filter(w =>
        w.skills && w.skills.some(skill => skill.toLowerCase().includes(serviceName.toLowerCase())),
      );
    }

    // 4. Calculate distances and map to clean DTOs
    let results = filtered.map(w => {
      const user = Array.isArray(w.users) ? w.users[0] : w.users;
      let distance: number | null = null;

      if (lat !== undefined && lng !== undefined && user?.latitude !== undefined && user?.longitude !== undefined) {
        distance = this.calculateDistance(lat, lng, Number(user.latitude), Number(user.longitude));
      }

      return {
        id: w.id,
        name: user?.name || 'Unknown Worker',
        phone: user?.phone || '',
        photoUrl: user?.photo_url || '',
        rating: Number(w.rating) || 5.0,
        hourlyRate: Number(w.hourly_rate) || 0.0,
        skills: w.skills || [],
        distance,
      };
    });

    // 5. Apply filters
    if (lat !== undefined && lng !== undefined && maxDistance) {
      results = results.filter(r => r.distance === null || r.distance <= maxDistance);
    }
    if (minRating !== undefined) {
      results = results.filter(r => r.rating >= minRating);
    }
    if (maxPrice !== undefined) {
      results = results.filter(r => r.hourlyRate <= maxPrice);
    }

    // 6. Apply sorting
    if (sortBy === 'distance' && lat !== undefined && lng !== undefined) {
      results.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else if (sortBy === 'price') {
      results.sort((a, b) => a.hourlyRate - b.hourlyRate);
    } else {
      // Default: sort by rating desc
      results.sort((a, b) => b.rating - a.rating);
    }

    return results;
  }

  // Haversine distance formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async findOne(workerId: string) {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Fetch worker and joined user profile details
    const { data: worker, error: workerError } = await adminClient
      .from('workers')
      .select('id, rating, hourly_rate, skills, users:id(name, phone, photo_url, latitude, longitude)')
      .eq('id', workerId)
      .single();

    if (workerError || !worker) {
      throw new NotFoundException('Worker profile not found');
    }

    const user = Array.isArray(worker.users) ? worker.users[0] : worker.users;

    // 2. Fetch reviews associated with this worker
    const { data: reviews, error: reviewsError } = await adminClient
      .from('reviews')
      .select('id, rating, comment, created_at, users:customer_id(name)')
      .eq('worker_id', workerId);

    if (reviewsError) {
      this.logger.warn(`Could not fetch reviews for worker ${workerId}: ${reviewsError.message}`);
    }

    const mappedReviews = (reviews || []).map(r => {
      const customer = Array.isArray(r.users) ? r.users[0] : r.users;
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        customerName: customer?.name || 'Anonymous Customer',
      };
    });

    return {
      id: worker.id,
      name: user?.name || 'Unknown Worker',
      phone: user?.phone || '',
      photoUrl: user?.photo_url || '',
      rating: Number(worker.rating) || 5.0,
      hourlyRate: Number(worker.hourly_rate) || 0.0,
      skills: worker.skills || [],
      reviews: mappedReviews,
      bookNowEndpoint: `/bookings`,
    };
  }

  async seedMockData() {
    const adminClient = this.supabaseService.getAdminClient();

    // 1. Seed Services
    const mockServices = [
      { id: '1', name: 'Plumber', icon: 'plumbing', description: 'Fixes pipes, leaks, and drainage issues.' },
      { id: '2', name: 'Electrician', icon: 'bolt', description: 'Installs wiring, fixes switches, and repairs electrical appliances.' },
      { id: '3', name: 'Carpenter', icon: 'build', description: 'Repairs furniture, installs shelves, and handles wood craft.' },
      { id: '4', name: 'Painter', icon: 'format_paint', description: 'Interior and exterior wall painting services.' },
    ];

    const { error: serviceError } = await adminClient.from('services').upsert(mockServices);
    if (serviceError) {
      this.logger.error(`Seeding services failed: ${serviceError.message}`);
      throw new BadRequestException(`Failed to seed services: ${serviceError.message}`);
    }

    // 2. Seed Mock Users (1 Customer + 5 Workers)
    const mockUsers = [
      { id: '99999999-9999-9999-9999-999999999999', name: 'Jane Customer', email: 'customer@example.com', role: 'HOUSEHOLD', phone: '+1234567890', latitude: 12.9716, longitude: 77.5946 },
      { id: '11111111-1111-1111-1111-111111111111', name: 'Vince Plumber', email: 'vince@example.com', role: 'WORKER', phone: '+1111111111', latitude: 12.9720, longitude: 77.5950 },
      { id: '22222222-2222-2222-2222-222222222222', name: 'Alice Electrician', email: 'alice@example.com', role: 'WORKER', phone: '+2222222222', latitude: 12.9780, longitude: 77.5980 },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Bob Carpenter', email: 'bob@example.com', role: 'WORKER', phone: '+3333333333', latitude: 12.9650, longitude: 77.5850 },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Charlie Painter', email: 'charlie@example.com', role: 'WORKER', phone: '+4444444444', latitude: 12.9800, longitude: 77.6000 },
      { id: '55555555-5555-5555-5555-555555555555', name: 'Dave JackOfAll', email: 'dave@example.com', role: 'WORKER', phone: '+5555555555', latitude: 12.9680, longitude: 77.5900 },
    ];

    const { error: userError } = await adminClient.from('users').upsert(mockUsers);
    if (userError) {
      this.logger.error(`Seeding users failed: ${userError.message}`);
      throw new BadRequestException(`Failed to seed users: ${userError.message}`);
    }

    // 3. Seed Mock Workers details
    const mockWorkers = [
      { id: '11111111-1111-1111-1111-111111111111', skills: ['plumbing', 'drain clean'], rating: 4.8, hourly_rate: 45.00 },
      { id: '22222222-2222-2222-2222-222222222222', skills: ['electrical', 'wiring'], rating: 4.5, hourly_rate: 55.00 },
      { id: '33333333-3333-3333-3333-333333333333', skills: ['carpentry', 'furniture'], rating: 4.2, hourly_rate: 40.00 },
      { id: '44444444-4444-4444-4444-444444444444', skills: ['painting', 'walls'], rating: 4.9, hourly_rate: 50.00 },
      { id: '55555555-5555-5555-5555-555555555555', skills: ['plumbing', 'electrical'], rating: 4.7, hourly_rate: 60.00 },
    ];

    const { error: workerError } = await adminClient.from('workers').upsert(mockWorkers);
    if (workerError) {
      this.logger.error(`Seeding workers failed: ${workerError.message}`);
      throw new BadRequestException(`Failed to seed workers details: ${workerError.message}`);
    }

    // 4. Seed Mock Reviews
    const mockReviews = [
      { id: '10101010-1010-1010-1010-101010101010', customer_id: '99999999-9999-9999-9999-999999999999', worker_id: '11111111-1111-1111-1111-111111111111', rating: 5, comment: 'Vince did an amazing job fixing our kitchen sink! Highly recommended.' },
      { id: '20202020-2020-2020-2020-202020202020', customer_id: '99999999-9999-9999-9999-999999999999', worker_id: '22222222-2222-2222-2222-222222222222', rating: 4, comment: 'Alice resolved our short circuit problem quickly. Very professional.' },
    ];

    const { error: reviewError } = await adminClient.from('reviews').upsert(mockReviews);
    if (reviewError) {
      this.logger.error(`Seeding reviews failed: ${reviewError.message}`);
      throw new BadRequestException(`Failed to seed reviews: ${reviewError.message}`);
    }

    return {
      message: 'Database seeded with mock services, workers, and reviews successfully!',
    };
  }
}
