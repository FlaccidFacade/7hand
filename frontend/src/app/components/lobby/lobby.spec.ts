import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Lobby } from './lobby';
import { of } from 'rxjs';

describe('Lobby', () => {
  let component: Lobby;
  let fixture: ComponentFixture<Lobby>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('test-lobby-id')
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [Lobby],
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Lobby);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load lobby id from route', () => {
    fixture.detectChanges();
    expect(component.lobbyId).toBe('test-lobby-id');
  });

  it('should identify empty seats', () => {
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 },
      { id: '2', username: 'player2', displayName: 'Player 2', position: 2 }
    ];

    const emptySeats = component.getEmptySeats();
    expect(emptySeats).toEqual([1, 3, 4, 5]);
  });

  it('should get player at position', () => {
    const player = { id: '1', username: 'player1', displayName: 'Player 1', position: 0 };
    component.players = [player];

    expect(component.getPlayerAtPosition(0)).toEqual(player);
    expect(component.getPlayerAtPosition(1)).toBeNull();
  });

  it('should check if position is occupied', () => {
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 }
    ];

    expect(component.isPositionOccupied(0)).toBe(true);
    expect(component.isPositionOccupied(1)).toBe(false);
  });

  it('should navigate away on leave', () => {
    component.leaveLobby();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should identify host correctly', () => {
    component.currentUserId = '1';
    component.players = [
      { id: '1', username: 'player1', displayName: 'Player 1', position: 0 },
      { id: '2', username: 'player2', displayName: 'Player 2', position: 1 }
    ];
    component.loadLobby();
    
    expect(component.isHost).toBe(true);
  });
});
