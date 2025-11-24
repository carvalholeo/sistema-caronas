// Adicione este tipo para a rota de busca de caronas
export interface IRideSearchQuery {
  from?: string; // Coordenadas 'lng,lat'
  to?: string;   // Coordenadas 'lng,lat'
  date?: string; // Formato ISO: 'YYYY-MM-DD'
  minSeats?: string; // '1', '2', etc.
  maxPrice?: string; // '50', '100', etc.
  departureTimeStart?: string; // '08:00'
  departureTimeEnd?: string;   // '10:00'
}

export interface IMyRidesQuery {
  status?: RideStatus | RideStatus[];
  dateRange?: 'upcoming' | 'past_week' | 'past_month' | 'all';
}

export interface IRideCreation extends Document<IRideCreation> {
  driver: IUser;
  vehicle: IVehicle;
  origin: { location: string; point: ILocation };
  destination: { location: string; point: ILocation };
  intermediateStops: { location: string; point: object }[];
  departureTime: Date;
  availableSeats: number;
  price: number;
  status: RideStatus;
  distanceKm?: number;
}

export interface IRideRecurrentCreation extends Document<IRideRecurrentCreation> {
  driver: IUser;
  vehicle: IVehicle;
  origin: { location: string; point: ILocation };
  destination: { location: string; point: ILocation };
  intermediateStops: { location: string; point: object }[];
  departureTime: Date;
  availableSeats: number;
  price: number;
  status: RideStatus;
  isRecurrent: boolean;
  recurrenceId?: string;
  distanceKm?: number;
}