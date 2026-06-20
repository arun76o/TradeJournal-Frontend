import { TestBed } from '@angular/core/testing';

import { DashboardRefreshService } from './dashboard-refresh.service';

describe('DashboardRefreshService', () => {
  let service: DashboardRefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DashboardRefreshService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
