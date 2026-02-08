import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayingCardComponent, Suit, Rank } from './playing-card.component';

describe('PlayingCardComponent', () => {
  let component: PlayingCardComponent;
  let fixture: ComponentFixture<PlayingCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayingCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayingCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Card properties', () => {
    it('should have default values', () => {
      expect(component.suit).toBe('hearts');
      expect(component.rank).toBe('A');
      expect(component.faceUp).toBe(true);
      expect(component.draggable).toBe(true);
    });

    it('should generate correct card ID', () => {
      component.suit = 'spades';
      component.rank = 'K';
      expect(component.cardId).toBe('K-spades');
    });

    it('should return correct suit symbol for hearts', () => {
      component.suit = 'hearts';
      expect(component.suitSymbol).toBe('♥');
    });

    it('should return correct suit symbol for diamonds', () => {
      component.suit = 'diamonds';
      expect(component.suitSymbol).toBe('♦');
    });

    it('should return correct suit symbol for clubs', () => {
      component.suit = 'clubs';
      expect(component.suitSymbol).toBe('♣');
    });

    it('should return correct suit symbol for spades', () => {
      component.suit = 'spades';
      expect(component.suitSymbol).toBe('♠');
    });

    it('should return correct suit symbol for joker', () => {
      component.suit = 'joker';
      expect(component.suitSymbol).toBe('🃏');
    });

    it('should identify red suits correctly', () => {
      component.suit = 'hearts';
      expect(component.suitColor).toBe('red');
      
      component.suit = 'diamonds';
      expect(component.suitColor).toBe('red');
    });

    it('should identify black suits correctly', () => {
      component.suit = 'clubs';
      expect(component.suitColor).toBe('black');
      
      component.suit = 'spades';
      expect(component.suitColor).toBe('black');
      
      component.suit = 'joker';
      expect(component.suitColor).toBe('black');
    });

    it('should identify joker correctly', () => {
      component.suit = 'joker';
      component.rank = 'JOKER';
      expect(component.isJoker).toBe(true);
    });

    it('should not identify non-joker as joker', () => {
      component.suit = 'hearts';
      component.rank = 'A';
      expect(component.isJoker).toBe(false);
    });
  });

  describe('All 53 card types', () => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    it('should support all 52 standard cards', () => {
      let cardCount = 0;
      suits.forEach(suit => {
        ranks.forEach(rank => {
          component.suit = suit;
          component.rank = rank;
          expect(component.cardId).toBe(`${rank}-${suit}`);
          expect(component.isJoker).toBe(false);
          cardCount++;
        });
      });
      expect(cardCount).toBe(52);
    });

    it('should support joker as 53rd card', () => {
      component.suit = 'joker';
      component.rank = 'JOKER';
      expect(component.cardId).toBe('JOKER-joker');
      expect(component.isJoker).toBe(true);
    });
  });

  describe('Face toggle', () => {
    it('should toggle face from up to down', () => {
      component.faceUp = true;
      component.toggleFace();
      expect(component.faceUp).toBe(false);
    });

    it('should toggle face from down to up', () => {
      component.faceUp = false;
      component.toggleFace();
      expect(component.faceUp).toBe(true);
    });
  });

  describe('Rotation', () => {
    it('should start with zero rotation', () => {
      expect(component.rotation).toBe(0);
    });

    it('should reset rotation to zero', () => {
      component.rotation = 45;
      component.resetRotation();
      expect(component.rotation).toBe(0);
    });
  });

  describe('Mouse drag functionality', () => {
    it('should not start dragging if not draggable', () => {
      component.draggable = false;
      const event = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      spyOn(event, 'preventDefault');
      
      component.onMouseDown(event);
      
      expect(component.isDragging).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should start dragging on mouse down when draggable', () => {
      component.draggable = true;
      const event = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      spyOn(event, 'preventDefault');
      
      component.onMouseDown(event);
      
      expect(component.isDragging).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should update rotation on mouse move while dragging', () => {
      component.draggable = true;
      component.isDragging = true;
      component['startX'] = 100;
      component['startRotation'] = 0;
      
      const event = new MouseEvent('mousemove', { clientX: 200, clientY: 100 });
      component.onMouseMove(event);
      
      expect(component.rotation).not.toBe(0);
    });

    it('should not update rotation on mouse move when not dragging', () => {
      component.draggable = true;
      component.isDragging = false;
      component.rotation = 0;
      
      const event = new MouseEvent('mousemove', { clientX: 200, clientY: 100 });
      component.onMouseMove(event);
      
      expect(component.rotation).toBe(0);
    });

    it('should stop dragging on mouse up', () => {
      component.isDragging = true;
      component.onMouseUp();
      expect(component.isDragging).toBe(false);
    });
  });

  describe('Touch drag functionality', () => {
    it('should not start dragging on touch if not draggable', () => {
      component.draggable = false;
      const touch = { clientX: 100, clientY: 100 } as Touch;
      const event = { touches: [touch], preventDefault: jasmine.createSpy('preventDefault') } as any;
      
      component.onTouchStart(event);
      
      expect(component.isDragging).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('should start dragging on touch start when draggable', () => {
      component.draggable = true;
      const touch = { clientX: 100, clientY: 100 } as Touch;
      const event = { touches: [touch], preventDefault: jasmine.createSpy('preventDefault') } as any;
      
      component.onTouchStart(event);
      
      expect(component.isDragging).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should update rotation on touch move while dragging', () => {
      component.draggable = true;
      component.isDragging = true;
      component['startX'] = 100;
      component['startRotation'] = 0;
      
      const touch = { clientX: 200, clientY: 100 } as Touch;
      const event = { touches: [touch] } as any;
      component.onTouchMove(event);
      
      expect(component.rotation).not.toBe(0);
    });

    it('should not update rotation on touch move when not dragging', () => {
      component.draggable = true;
      component.isDragging = false;
      component.rotation = 0;
      
      const touch = { clientX: 200, clientY: 100 } as Touch;
      const event = { touches: [touch] } as any;
      component.onTouchMove(event);
      
      expect(component.rotation).toBe(0);
    });

    it('should stop dragging on touch end', () => {
      component.isDragging = true;
      component.onTouchEnd();
      expect(component.isDragging).toBe(false);
    });
  });
});
