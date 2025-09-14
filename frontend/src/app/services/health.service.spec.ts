import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HealthService, HealthStatus } from './health.service';
import { take } from 'rxjs/operators';

describe('HealthService', () => {
  let service: HealthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
        HealthService
      ]
    });

    service = TestBed.inject(HealthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should emit health status immediately', (done) => {
    service.getHealth(10000) // large interval so only initial emission
      .pipe(take(1))
      .subscribe(value => {
        expect(value).toEqual({
          api: 'ok',
          apiVersion: '1.2.3',
          db: 'ok',
          dbVersion: '14'
        });
        done();
      });

    const req = httpMock.expectOne('/api/health');
    expect(req.request.method).toBe('GET');
    const payload: HealthStatus = {
      api: 'ok',
      apiVersion: '1.2.3',
      db: 'ok',
      dbVersion: '14'
    };
    req.flush(payload);
  });
});
