import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { HealthService, HealthStatus } from './services/health.service';
import { of } from 'rxjs';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        {
          provide: HealthService,
          useValue: {
            getHealth: () => of<HealthStatus>({
              api: 'ok',
              apiVersion: '1.0.0',
              db: 'ok',
              dbVersion: '14'
            })
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render landing component by default', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-landing')).not.toBeNull();
    expect(compiled.querySelector('app-header')).toBeNull();
  });

  it('should render header component when showLogin is false', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.showLogin = false;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-header')).not.toBeNull();
    expect(compiled.querySelector('app-landing')).toBeNull();
  });

  it('should have showLogin property set to true by default', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.showLogin).toBe(true);
  });
});
