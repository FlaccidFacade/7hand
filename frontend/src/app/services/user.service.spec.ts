import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService, CreateUserRequest, User } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a user', () => {
    const createUserRequest: CreateUserRequest = {
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com'
    };

    const mockUser: User = {
      id: '123',
      username: 'testuser',
      displayName: 'Test User',
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: '2025-10-22T00:00:00.000Z',
      lastActive: '2025-10-22T00:00:00.000Z'
    };

    service.createUser(createUserRequest).subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/user');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createUserRequest);
    req.flush(mockUser);
  });

  it('should get user by ID', () => {
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      displayName: 'Test User',
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: '2025-10-22T00:00:00.000Z',
      lastActive: '2025-10-22T00:00:00.000Z'
    };

    service.getUserById('123').subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/user/123');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('should get user by username', () => {
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      displayName: 'Test User',
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: '2025-10-22T00:00:00.000Z',
      lastActive: '2025-10-22T00:00:00.000Z'
    };

    service.getUserByUsername('testuser').subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/user/username/testuser');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('should update user', () => {
    const mockUser: User = {
      id: '123',
      username: 'testuser',
      displayName: 'Updated Name',
      stats: { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 },
      createdAt: '2025-10-22T00:00:00.000Z',
      lastActive: '2025-10-22T00:00:00.000Z'
    };

    service.updateUser('123', { displayName: 'Updated Name' }).subscribe(user => {
      expect(user).toEqual(mockUser);
    });

    const req = httpMock.expectOne('/api/user/123');
    expect(req.request.method).toBe('PATCH');
    req.flush(mockUser);
  });

  it('should delete user', () => {
    service.deleteUser('123').subscribe(response => {
      expect(response.success).toBe(true);
    });

    const req = httpMock.expectOne('/api/user/123');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });
  });
});
