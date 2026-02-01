import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RulesDisplay } from './rules-display';

describe('RulesDisplay', () => {
  let component: RulesDisplay;
  let fixture: ComponentFixture<RulesDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RulesDisplay]
    }).compileComponents();

    fixture = TestBed.createComponent(RulesDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the rules header', () => {
    const compiled = fixture.nativeElement;
    const header = compiled.querySelector('.rules-header h2');
    expect(header.textContent).toContain('Game Rules');
  });

  it('should display all rule sections', () => {
    const compiled = fixture.nativeElement;
    const sections = compiled.querySelectorAll('.rules-body section');
    expect(sections.length).toBeGreaterThan(0);
  });
});
