import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableTop } from './table-top';

describe('TableTop', () => {
  let component: TableTop;
  let fixture: ComponentFixture<TableTop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableTop]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TableTop);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
