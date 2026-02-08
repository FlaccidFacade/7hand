import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardDemo } from './card-demo.component';

describe('CardDemo', () => {
  let component: CardDemo;
  let fixture: ComponentFixture<CardDemo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardDemo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardDemo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have all 53 cards', () => {
    const cards = component.allCards;
    expect(cards.length).toBe(53);
  });

  it('should have default values', () => {
    expect(component.selectedSuit).toBe('hearts');
    expect(component.selectedRank).toBe('A');
    expect(component.showFaceUp).toBe(true);
    expect(component.isDraggable).toBe(true);
  });
});
