import {
  Component, OnInit, signal, computed, inject,
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { RouterModule }  from '@angular/router';
import { ApiService }    from '../../../../core/services/api/api.service';
import { ENDPOINTS }     from '../../../../core/services/api/endpoints';

export interface ArtistCard {
  id:           number;
  slug:         string;
  name:         string;
  handle:       string;
  city:         string;
  hero_image_url: string | null;
  rating_avg:   number;
  total_reviews:number;
  total_tattoos:number;
  is_available: boolean;
  styles:       { id: number; name: string }[];
}

const CITIES  = ['Bogotá','Medellín','Cali','Cartagena','Barranquilla','Bucaramanga','Pereira'];
const STYLES  = ['Realismo','Blackwork','Fine Line','Old School','Minimalista','Lettering','Color','Cover Up'];

// Mock data — replace with API call
const MOCK_ARTISTS: ArtistCard[] = [
  { id:1, slug:'josetatto',   name:'Jose Tatto',      handle:'@josetatto',   city:'Bogotá',      hero_image_url:null, rating_avg:4.97, total_reviews:312, total_tattoos:1240, is_available:true,  styles:[{id:1,name:'Realismo'},{id:2,name:'Blackwork'}] },
  { id:2, slug:'inkbycamila', name:'Camila Ink',       handle:'@inkbycamila', city:'Medellín',    hero_image_url:null, rating_avg:4.85, total_reviews:198, total_tattoos:876,  is_available:true,  styles:[{id:3,name:'Fine Line'},{id:7,name:'Color'}] },
  { id:3, slug:'valcruztattoo',name:'Valentina Cruz', handle:'@valcruztattoo',city:'Cali',        hero_image_url:null, rating_avg:5.00, total_reviews:89,  total_tattoos:412,  is_available:false, styles:[{id:7,name:'Color'},{id:8,name:'Cover Up'}] },
  { id:4, slug:'andresherrera',name:'Andrés Herrera', handle:'@andresherrera',city:'Cartagena',   hero_image_url:null, rating_avg:4.72, total_reviews:445, total_tattoos:1890, is_available:true,  styles:[{id:4,name:'Old School'}] },
  { id:5, slug:'santivargas',  name:'Santiago Vargas', handle:'@santivargas', city:'Barranquilla', hero_image_url:null, rating_avg:4.90, total_reviews:203, total_tattoos:654,  is_available:true,  styles:[{id:6,name:'Lettering'},{id:5,name:'Minimalista'}] },
  { id:6, slug:'lauratattoo',  name:'Laura Pinzón',    handle:'@lauratattoo', city:'Bogotá',      hero_image_url:null, rating_avg:4.88, total_reviews:267, total_tattoos:980,  is_available:false, styles:[{id:1,name:'Realismo'}] },
];

@Component({
  selector:    'app-landing',
  standalone:  true,
  imports:     [CommonModule, FormsModule, RouterModule],
  templateUrl: './landing.html',
  styleUrls:   ['./landing.scss'],
})
export class Landing implements OnInit {

  private api = inject(ApiService);

  // ── Data
  allArtists = signal<ArtistCard[]>([]);

  // ── Filters
  searchQuery  = signal('');
  filterCity   = signal('');
  filterStyle  = signal('');
  filterAvail  = signal(false);

  readonly cities = CITIES;
  readonly styles = STYLES;

  // ── Filtered artists
  filteredArtists = computed(() => {
    const q     = this.searchQuery().toLowerCase().trim();
    const city  = this.filterCity();
    const style = this.filterStyle();
    const avail = this.filterAvail();

    return this.allArtists().filter(a => {
      const matchQ     = !q
        || a.name.toLowerCase().includes(q)
        || a.handle.toLowerCase().includes(q)
        || a.city.toLowerCase().includes(q)
        || a.styles.some(s => s.name.toLowerCase().includes(q));
      const matchCity  = !city  || a.city === city;
      const matchStyle = !style || a.styles.some(s => s.name === style);
      const matchAvail = !avail || a.is_available;
      return matchQ && matchCity && matchStyle && matchAvail;
    });
  });

  // ── Stats for hero
  totalArtists  = computed(() => this.allArtists().length);
  totalCities   = computed(() => new Set(this.allArtists().map(a => a.city)).size);

  // Loading state
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  // ── Lifecycle
  ngOnInit(): void {
    this.loadArtists();
  }

  private loadArtists(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.get<ArtistCard[]>(ENDPOINTS.artists.list, { is_active: 'true' })
      .subscribe({
        next: (list) => {
          this.allArtists.set(list);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudieron cargar los artistas.');
          this.isLoading.set(false);
        },
      });
  }

  // ── Helpers
  clearFilters(): void {
    this.searchQuery.set('');
    this.filterCity.set('');
    this.filterStyle.set('');
    this.filterAvail.set(false);
  }

  hasFilters = computed(() =>
    !!this.searchQuery() || !!this.filterCity() || !!this.filterStyle() || this.filterAvail()
  );

  starsArray(rating: number): boolean[] {
    return [1,2,3,4,5].map(i => i <= Math.round(rating));
  }

  formatRating(r: number): string {
    return r.toFixed(2);
  }

  trackBySlug(_: number, a: ArtistCard): string { return a.slug; }
  trackByIdx(i: number): number { return i; }
}