import { TestBed } from '@angular/core/testing';

import { AgentStreamService } from './agent-stream.service';

describe('AgentStreamService', () => {
  let service: AgentStreamService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AgentStreamService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
