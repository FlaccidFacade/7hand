import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProfile } from './user-profile';
import { CookieService } from '../../services/cookie.service';

describe('UserProfile', () => {
  let component: UserProfile;
  let fixture: ComponentFixture<UserProfile>;
  let cookieService: jasmine.SpyObj<CookieService>;

  beforeEach(async () => {
    const cookieServiceSpy = jasmine.createSpyObj('CookieService', [
      'hasCookie',
      'setCookie',
      'deleteCookie'
    ]);

    await TestBed.configureTestingModule({
      imports: [UserProfile],
      providers: [
        { provide: CookieService, useValue: cookieServiceSpy }
      ]
    }).compileComponents();

    cookieService = TestBed.inject(CookieService) as jasmine.SpyObj<CookieService>;
    fixture = TestBed.createComponent(UserProfile);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user information when user is provided', () => {
    component.user = {
      id: '1',
      username: 'testuser',
      displayName: 'Test User',
      coins: 0,
      stats: { gamesPlayed: 10, gamesWon: 6, gamesLost: 4 },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.username')?.textContent).toContain('Test User');
    expect(compiled.querySelector('.user-id')?.textContent).toContain('@testuser');
  });

  it('should calculate win rate correctly', () => {
    component.user = {
      id: '1',
      username: 'testuser',
      displayName: 'Test User',
      coins: 0,
      stats: { gamesPlayed: 10, gamesWon: 7, gamesLost: 3 },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    expect(component.getWinRate()).toBe(70);
  });

  it('should return 0 win rate when no games played', () => {
    component.user = {
      id: '1',
      username: 'testuser',
      displayName: 'Test User',
      coins: 0,
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    expect(component.getWinRate()).toBe(0);
  });

  it('should toggle cookies on and off', () => {
    component.cookiesEnabled = false;
    cookieService.hasCookie.and.returnValue(false);

    component.toggleCookies();

    expect(cookieService.setCookie).toHaveBeenCalledWith('cookie_consent', 'accepted');
    expect(component.cookiesEnabled).toBe(true);

    component.toggleCookies();

    expect(cookieService.deleteCookie).toHaveBeenCalledWith('cookie_consent');
    expect(component.cookiesEnabled).toBe(false);
  });

  it('should emit logout event', () => {
    spyOn(component.logout, 'emit');
    component.onLogout();
    expect(component.logout.emit).toHaveBeenCalled();
  });

  it('should show empty state when no user', () => {
    component.user = null;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('.empty-message')?.textContent).toContain('Not logged in');
  });
});
