import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingConfirm } from './booking-confirm';

describe('BookingConfirm', () => {
  let component: BookingConfirm;
  let fixture: ComponentFixture<BookingConfirm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingConfirm],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingConfirm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
