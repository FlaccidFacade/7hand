import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
        provideRouter([]),
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


  it('should have showLogin property set to true by default', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.showLogin).toBe(true);
  });
});
