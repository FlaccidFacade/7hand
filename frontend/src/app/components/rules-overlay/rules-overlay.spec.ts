import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RulesOverlay } from './rules-overlay';

describe('RulesOverlay', () => {
  let component: RulesOverlay;
  let fixture: ComponentFixture<RulesOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RulesOverlay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RulesOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not be visible by default', () => {
    expect(component.isVisible).toBeFalsy();
  });

  it('should emit closeOverlay when onClose is called', () => {
    spyOn(component.closeOverlay, 'emit');
    component.onClose();
    expect(component.closeOverlay.emit).toHaveBeenCalled();
  });

  it('should emit closeOverlay when overlay background is clicked', () => {
    spyOn(component.closeOverlay, 'emit');
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: event.currentTarget });
    component.onOverlayClick(event);
    expect(component.closeOverlay.emit).toHaveBeenCalled();
  });

  it('should not emit closeOverlay when clicking on content', () => {
    spyOn(component.closeOverlay, 'emit');
    const event = new Event('click');
    const target = document.createElement('div');
    const currentTarget = document.createElement('div');
    Object.defineProperty(event, 'target', { value: target });
    Object.defineProperty(event, 'currentTarget', { value: currentTarget });
    component.onOverlayClick(event);
    expect(component.closeOverlay.emit).not.toHaveBeenCalled();
  });
});